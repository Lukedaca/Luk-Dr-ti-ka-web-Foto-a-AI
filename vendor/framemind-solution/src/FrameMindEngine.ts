import { ActionResolver } from './ActionResolver.js';
import { ConversationContext } from './ConversationContext.js';
import { DiscourseContext } from './DiscourseContext.js';
import { IntentEngine } from './IntentEngine.js';
import { KnowledgeStore } from './KnowledgeStore.js';
import { NoopLearningSink } from './NoopLearningSink.js';
import { PrivacyGuard } from './PrivacyGuard.js';
import { ProviderRouter } from './ProviderRouter.js';
import { ResponseComposer } from './ResponseComposer.js';
import { SourceResolver } from './SourceResolver.js';
import { SafetyShield } from './SafetyShield.js';
import type {
  FrameMindConfig,
  FrameMindRequest,
  FrameMindResponse,
  IntentResponseRule,
  KnowledgeSnapshot,
} from './types.js';

function hasAnySlot(rule: IntentResponseRule, slots: Record<string, unknown>): boolean {
  if (!rule.requiredAnySlots?.length) return true;
  return rule.requiredAnySlots.some((key) => slots[key] !== undefined && slots[key] !== '');
}

export class FrameMindEngine {
  readonly context = new ConversationContext();
  readonly discourse = new DiscourseContext();
  private readonly sessionContexts = new Map<string, { context: ConversationContext; discourse: DiscourseContext; touchedAt: number }>();
  readonly privacyGuard: PrivacyGuard;
  readonly learningSink;
  private readonly intentEngine: IntentEngine;
  private readonly composer = new ResponseComposer();
  private readonly sourceResolver: SourceResolver;
  private readonly actionResolver: ActionResolver;
  private readonly providerRouter: ProviderRouter;

  constructor(
    private readonly config: FrameMindConfig,
    snapshot: KnowledgeSnapshot,
  ) {
    this.privacyGuard = new PrivacyGuard(config.mode);
    this.intentEngine = new IntentEngine(config.intents);
    const store = new KnowledgeStore(snapshot);
    this.sourceResolver = new SourceResolver(store, undefined, config.sourceLabel ?? 'Ověřený zdroj');
    this.actionResolver = new ActionResolver(config.actions, this.privacyGuard);
    const adapter = config.provider?.enabled ? config.provider.adapter : undefined;
    this.providerRouter = new ProviderRouter(adapter, this.privacyGuard);
    this.learningSink = config.learningSink ?? new NoopLearningSink();
  }

  private requestContext(sessionId: string | undefined): { context: ConversationContext; discourse: DiscourseContext } {
    const settings = this.config.sessions;
    if (!sessionId) {
      if (settings?.requireSessionId) throw new Error('sessionId is required by session isolation policy');
      return { context: this.context, discourse: this.discourse };
    }
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(sessionId)) throw new Error('sessionId format is invalid');

    const now = Date.now();
    const idleTtlMs = Math.max(1_000, settings?.idleTtlMs ?? 30 * 60_000);
    for (const [id, entry] of this.sessionContexts) {
      if (now - entry.touchedAt >= idleTtlMs) this.sessionContexts.delete(id);
    }
    const existing = this.sessionContexts.get(sessionId);
    if (existing) {
      existing.touchedAt = now;
      return { context: existing.context, discourse: existing.discourse };
    }

    const maxSessions = Math.max(1, settings?.maxSessions ?? 1_000);
    if (this.sessionContexts.size >= maxSessions) {
      let oldestId: string | undefined;
      let oldestAt = Infinity;
      for (const [id, entry] of this.sessionContexts) {
        if (entry.touchedAt < oldestAt) {
          oldestId = id;
          oldestAt = entry.touchedAt;
        }
      }
      if (oldestId) this.sessionContexts.delete(oldestId);
    }
    const context = new ConversationContext();
    const discourse = new DiscourseContext();
    this.sessionContexts.set(sessionId, { context, discourse, touchedAt: now });
    return { context, discourse };
  }

  async respond(request: FrameMindRequest): Promise<FrameMindResponse> {
    const sessionCtx = this.requestContext(request.sessionId);

    // 1. Safety Shield: block profanity, insults and prompt injections immediately
    const safety = SafetyShield.checkSafety(request.text);
    if (!safety.isSafe) {
      if (this.learningSink) {
        await this.learningSink.record({
          kind: 'safety-dropped',
          payload: { reason: safety.reason || 'toxicity' },
        });
      }
      return {
        text: 'Tento dotaz nemohu zpracovat. Komunikuji slušně a věnuji se pouze tématům tohoto webu.',
        intent: 'safety_refusal',
        confidence: 1.0,
        local: true,
        providerUsed: false,
        actions: [],
        context: sessionCtx.context.snapshot(),
        reason: 'known',
        suggestions: [],
        discourse: sessionCtx.discourse.snapshot(),
      };
    }

    // 2. Discourse repair & clarification handling
    let queryText = request.text;
    const pendingClarification = sessionCtx.discourse.getAwaitingClarification();
    if (pendingClarification) {
      const norm = queryText.toLowerCase().trim();
      let mappedIntent: string | undefined;

      if (pendingClarification.context?.intentMap) {
        const map = pendingClarification.context.intentMap as Record<string, string>;
        for (const [key, target] of Object.entries(map)) {
          if (norm.includes(key.toLowerCase()) || key.toLowerCase().includes(norm)) {
            mappedIntent = target;
            break;
          }
        }
      }

      if (mappedIntent) {
        sessionCtx.discourse.clearAwaitingClarification();
        queryText = mappedIntent;
      }
    } else if (sessionCtx.discourse.isRepairQuery(request.text)) {
      const subject = sessionCtx.discourse.extractRepairSubject(request.text);
      if (subject) {
        queryText = subject;
      }
    }

    const before = sessionCtx.context.snapshot();
    const match = this.intentEngine.detect(queryText, before, request.now, sessionCtx.discourse.snapshot());
    const context = sessionCtx.context.apply(match);

    // Match profile entity if configured
    if (this.config.profile?.entities) {
      const norm = queryText.toLowerCase();
      const entityDef = this.config.profile.entities.find((e) =>
        e.keywords.some((k) => norm.includes(k.toLowerCase())) ||
        norm.includes(e.name.toLowerCase()),
      );
      if (entityDef) {
        sessionCtx.discourse.setEntity(entityDef.type, entityDef.name);
      }
    }

    const rule = this.config.responses.find((candidate) => candidate.intentId === match.id);

    // If rule requires clarification (e.g. general pricing without active entity)
    if (rule?.clarification && !sessionCtx.discourse.getEntity()) {
      sessionCtx.discourse.setAwaitingClarification({
        type: match.id,
        question: rule.clarification.question,
        options: rule.clarification.options,
        context: { intentMap: rule.clarification.intentMap },
      });
      sessionCtx.discourse.advanceTurn(request.text, rule.clarification.question, match.id);
      return {
        text: rule.clarification.question,
        intent: match.id,
        confidence: match.confidence,
        local: true,
        providerUsed: false,
        actions: [],
        context: sessionCtx.context.snapshot(),
        reason: 'known',
        suggestions: rule.clarification.options,
        discourse: sessionCtx.discourse.snapshot(),
      };
    }

    const suggestions = sessionCtx.discourse.resolveSuggestions(match.id, this.config.profile);

    if (rule?.sourceRequired === false) {
      const text = this.composer.compose(rule.template, undefined, context, rule.cadence, request.text);
      if (text) {
        sessionCtx.discourse.advanceTurn(request.text, text, match.id);
        return {
          text,
          intent: match.id,
          confidence: match.confidence,
          local: true,
          providerUsed: false,
          actions: this.actionResolver.resolve(match.id, context, request.availablePaths, match.slots.navigationRequested === true),
          context: sessionCtx.context.snapshot(),
          reason: 'known',
          suggestions,
          discourse: sessionCtx.discourse.snapshot(),
        };
      }
    }

    if (rule) {
      const missingSlot = !hasAnySlot(rule, context.slots);
      const resolved = this.sourceResolver.resolve(rule, context, request.now, missingSlot);
      if (resolved.record && resolved.freshness === 'fresh') {
        sessionCtx.context.markSource(resolved.record.id);
        const text = this.composer.compose(
          missingSlot ? rule.missingTemplate : rule.template,
          resolved.record,
          context,
          rule.cadence,
          request.text,
        );
        const actions = missingSlot ? [] : this.actionResolver.resolve(match.id, context, request.availablePaths, match.slots.navigationRequested === true);
        sessionCtx.discourse.advanceTurn(request.text, text, match.id);
        return {
          text,
          intent: match.id,
          confidence: match.confidence,
          local: true,
          providerUsed: false,
          ...(resolved.reference ? { source: resolved.reference } : {}),
          actions,
          context: sessionCtx.context.snapshot(),
          reason: missingSlot ? 'missing-slot' : 'known',
          suggestions,
          discourse: sessionCtx.discourse.snapshot(),
        };
      }
      if (resolved.record && resolved.freshness !== 'fresh') {
        const text = this.composer.compose(
          rule.staleTemplate ?? this.config.staleResponse,
          resolved.record,
          context,
          rule.cadence,
          request.text,
        );
        sessionCtx.discourse.advanceTurn(request.text, text, match.id);
        return {
          text,
          intent: match.id,
          confidence: match.confidence,
          local: true,
          providerUsed: false,
          ...(resolved.reference ? { source: resolved.reference } : {}),
          actions: [],
          context: sessionCtx.context.snapshot(),
          reason: 'stale',
          suggestions,
          discourse: sessionCtx.discourse.snapshot(),
        };
      }
    }

    if (
      this.config.mode === 'managed'
      && this.config.provider?.enabled
      && request.allowManagedProvider === true
      && typeof request.providerText === 'string'
    ) {
      const provider = await this.providerRouter.generate(
        request.providerText,
        this.config.locale,
        context,
        true,
        this.config.provider.allowedContextSlots,
        this.config.provider.maxInputChars,
      );
      if (provider?.text) {
        sessionCtx.discourse.advanceTurn(request.text, provider.text, match.id);
        return {
          text: provider.text,
          intent: match.id,
          confidence: match.confidence,
          local: false,
          providerUsed: true,
          actions: [],
          context: sessionCtx.context.snapshot(),
          reason: 'provider',
          suggestions,
          discourse: sessionCtx.discourse.snapshot(),
        };
      }
    }

    if (this.learningSink) {
      const sanitized = SafetyShield.sanitizePii(request.text);
      const words = sanitized
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !['chci', 'jak', 'kde', 'kdy', 'prosim', 'nebo', 'tento', 'tuto', 'jsem'].includes(w))
        .slice(0, 3)
        .join('_');
      if (words) {
        await this.learningSink.record({
          kind: 'unmatched-topic',
          payload: { topic: words },
        });
      }
    }

    const unknownText = this.config.unknownResponse;
    sessionCtx.discourse.advanceTurn(request.text, unknownText, match.id);
    return {
      text: unknownText,
      intent: match.id,
      confidence: match.confidence,
      local: true,
      providerUsed: false,
      actions: [],
      context: sessionCtx.context.snapshot(),
      reason: 'unknown',
      suggestions,
      discourse: sessionCtx.discourse.snapshot(),
    };
  }

  reset(sessionId?: string): void {
    if (sessionId) {
      this.sessionContexts.delete(sessionId);
      return;
    }
    this.context.reset();
    this.discourse.reset();
    this.sessionContexts.clear();
  }
}
