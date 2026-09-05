import { ActionResolver } from './ActionResolver.js';
import { ConversationContext } from './ConversationContext.js';
import { IntentEngine } from './IntentEngine.js';
import { KnowledgeStore } from './KnowledgeStore.js';
import { NoopLearningSink } from './NoopLearningSink.js';
import { PrivacyGuard } from './PrivacyGuard.js';
import { ProviderRouter } from './ProviderRouter.js';
import { ResponseComposer } from './ResponseComposer.js';
import { SourceResolver } from './SourceResolver.js';
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
  private readonly sessionContexts = new Map<string, { context: ConversationContext; touchedAt: number }>();
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

  private requestContext(sessionId: string | undefined): ConversationContext {
    const settings = this.config.sessions;
    if (!sessionId) {
      if (settings?.requireSessionId) throw new Error('sessionId is required by session isolation policy');
      return this.context;
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
      return existing.context;
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
    this.sessionContexts.set(sessionId, { context, touchedAt: now });
    return context;
  }

  async respond(request: FrameMindRequest): Promise<FrameMindResponse> {
    const sessionContext = this.requestContext(request.sessionId);
    const before = sessionContext.snapshot();
    const match = this.intentEngine.detect(request.text, before, request.now);
    const context = sessionContext.apply(match);
    const rule = this.config.responses.find((candidate) => candidate.intentId === match.id);

    if (rule?.sourceRequired === false) {
      const text = this.composer.compose(rule.template, undefined, context);
      if (text) {
        return {
          text,
          intent: match.id,
          confidence: match.confidence,
          local: true,
          providerUsed: false,
          actions: this.actionResolver.resolve(match.id, context, request.availablePaths, match.slots.navigationRequested === true),
          context: sessionContext.snapshot(),
          reason: 'known',
        };
      }
    }

    if (rule) {
      const missingSlot = !hasAnySlot(rule, context.slots);
      const resolved = this.sourceResolver.resolve(rule, context, request.now, missingSlot);
      if (resolved.record && resolved.freshness === 'fresh') {
        sessionContext.markSource(resolved.record.id);
        const text = this.composer.compose(missingSlot ? rule.missingTemplate : rule.template, resolved.record, context);
        const actions = missingSlot ? [] : this.actionResolver.resolve(match.id, context, request.availablePaths, match.slots.navigationRequested === true);
        return {
          text,
          intent: match.id,
          confidence: match.confidence,
          local: true,
          providerUsed: false,
          ...(resolved.reference ? { source: resolved.reference } : {}),
          actions,
          context: sessionContext.snapshot(),
          reason: missingSlot ? 'missing-slot' : 'known',
        };
      }
      if (resolved.record && resolved.freshness !== 'fresh') {
        const text = this.composer.compose(rule.staleTemplate ?? this.config.staleResponse, resolved.record, context);
        return {
          text,
          intent: match.id,
          confidence: match.confidence,
          local: true,
          providerUsed: false,
          ...(resolved.reference ? { source: resolved.reference } : {}),
          actions: [],
          context: sessionContext.snapshot(),
          reason: 'stale',
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
        return {
          text: provider.text,
          intent: match.id,
          confidence: match.confidence,
          local: false,
          providerUsed: true,
          actions: [],
          context: sessionContext.snapshot(),
          reason: 'provider',
        };
      }
    }

    return {
      text: this.config.unknownResponse,
      intent: match.id,
      confidence: match.confidence,
      local: true,
      providerUsed: false,
      actions: [],
      context: sessionContext.snapshot(),
      reason: 'unknown',
    };
  }

  reset(sessionId?: string): void {
    if (sessionId) {
      this.sessionContexts.delete(sessionId);
      return;
    }
    this.context.reset();
    this.sessionContexts.clear();
  }
}
