import { ActionResolver } from './ActionResolver.js';
import { ConversationContext } from './ConversationContext.js';
import { DataPolicy } from './DataPolicy.js';
import { DiscourseContext } from './DiscourseContext.js';
import { IntentEngine } from './IntentEngine.js';
import { KnowledgeStore } from './KnowledgeStore.js';
import { NoopLearningSink } from './NoopLearningSink.js';
import { PrivacyGuard } from './PrivacyGuard.js';
import { ProviderRouter } from './ProviderRouter.js';
import { ResponseComposer } from './ResponseComposer.js';
import { resolveRuleFacet, stripLeadingRecordContent } from './ResponseFacets.js';
import { SourceResolver, selectorsOf } from './SourceResolver.js';
import { knownValues, selectMentioned, withoutMentions } from './MentionedRecords.js';
import { SafetyShield } from './SafetyShield.js';
import { selectSemanticIntent, type SemanticIntentDecision } from './SemanticIntents.js';
import { normalizeText } from './text.js';
import type {
  ContextSnapshot,
  FrameMindConfig,
  FrameMindRequest,
  FrameMindResponse,
  IntentMatch,
  IntentResponseRule,
  KnowledgeRecord,
  KnowledgeSnapshot,
  ResponseFacet,
} from './types.js';

const MIN_CHILD_AGE = 3;
const MAX_CHILD_AGE = 19;
/** Replayed prior user turns; older turns rarely carry slots that still matter. */
const MAX_HISTORY_TURNS = 6;
/** "A kde?", "A co je v ceně?" — longer messages without an intent are a new topic. */
const MAX_FACET_FOLLOW_UP_WORDS = 6;

const COMPOUND_SPLIT_RE = /\?\s+(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽa-záčďéěíňóřšťúůýž]{2,})|\s+(?:a\s+zároveň|a\s+taky|a\s+také|a\s+(?=(?:kolik|kdy|kde|kam|kdo|jak|jaký|jaká|jaké|co|za\s+kolik)\b))\s*/i;

function splitCompoundClauses(text: string): [string, string] | null {
  const match = COMPOUND_SPLIT_RE.exec(text);
  if (!match || match.index <= 0) return null;
  const left = text.slice(0, match.index).trim();
  const separator = match[0];
  const rightRaw = text.slice(match.index + separator.length).trim();
  if (!left || !rightRaw) return null;
  const leftWords = normalizeText(left).split(' ').filter(Boolean);
  const rightWords = normalizeText(rightRaw).split(' ').filter(Boolean);
  if (leftWords.length < 2 || rightWords.length < 2) return null;
  return [left, rightRaw];
}

function hasAnySlot(rule: IntentResponseRule, slots: Record<string, unknown>): boolean {
  if (!rule.requiredAnySlots?.length) return true;
  return rule.requiredAnySlots.some((key) => slots[key] !== undefined && slots[key] !== '');
}

export class FrameMindEngine {
  readonly context: ConversationContext;
  readonly discourse = new DiscourseContext();
  private readonly sessionContexts = new Map<string, { context: ConversationContext; discourse: DiscourseContext; touchedAt: number }>();
  readonly privacyGuard: PrivacyGuard;
  readonly dataPolicy: DataPolicy;
  readonly learningSink;
  private readonly intentEngine: IntentEngine;
  private readonly composer = new ResponseComposer();
  private readonly sourceResolver: SourceResolver;
  private readonly actionResolver: ActionResolver;
  private readonly providerRouter: ProviderRouter;
  private readonly store: KnowledgeStore;

  constructor(
    private readonly config: FrameMindConfig,
    snapshot: KnowledgeSnapshot,
  ) {
    this.context = new ConversationContext(config.slotDependencies);
    this.privacyGuard = new PrivacyGuard(config.mode);
    this.dataPolicy = new DataPolicy(config.tenantPolicy ? [config.tenantPolicy] : [], config.providerCompliance ?? []);
    this.intentEngine = new IntentEngine(config.intents, config.slotPatterns);
    this.store = new KnowledgeStore(snapshot);
    this.sourceResolver = new SourceResolver(this.store, undefined, config.sourceLabel ?? 'Ověřený zdroj');
    this.actionResolver = new ActionResolver(config.actions, this.privacyGuard);
    const adapter = config.provider?.enabled ? config.provider.adapter : undefined;
    this.providerRouter = new ProviderRouter(adapter, this.privacyGuard, undefined, this.dataPolicy, config.tenantPolicy);
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
    const context = new ConversationContext(this.config.slotDependencies);
    const discourse = new DiscourseContext();
    this.sessionContexts.set(sessionId, { context, discourse, touchedAt: now });
    return { context, discourse };
  }

  /** Both birth years an age can mean, each grounded in a fresh record; otherwise undefined. */
  private resolveAgeRange(rule: IntentResponseRule, context: ContextSnapshot, now = new Date()) {
    const age = context.slots.childAge;
    const birthYearSelector = selectorsOf(rule).find((selector) => selector.slot);
    if (!rule.ageRangeTemplate || !birthYearSelector?.slot || typeof age !== 'number') return undefined;
    if (age < MIN_CHILD_AGE || age > MAX_CHILD_AGE) return undefined;
    const slot = birthYearSelector.slot;
    const yearA = (typeof context.slots.currentYear === 'number' ? context.slots.currentYear : now.getUTCFullYear()) - age;
    const yearB = yearA - 1;
    const withYear = (year: number): ContextSnapshot => ({ ...context, slots: { ...context.slots, [slot]: year } });
    const a = this.sourceResolver.resolve(rule, withYear(yearA), now);
    const b = this.sourceResolver.resolve(rule, withYear(yearB), now);
    if (!a.record || !b.record || a.freshness !== 'fresh' || b.freshness !== 'fresh') return undefined;
    return {
      a: { record: a.record, reference: a.reference },
      values: { slots: { ...context.slots, yearA, yearB, a: a.record.data ?? {}, b: b.record.data ?? {} } },
    };
  }

  /**
   * Slot-pivot & mention-pivot ellipsis resolution (2.1.0):
   * When a short follow-up message has no lexical intent of its own ("A béčko?", "A U-11?",
   * "A se Slavonínem?", "A u webů?"), checks whether it supplies a slot or mentioned entity
   * consumed by the active intent's response rule (or its generic pricing sibling).
   */
  private resolvePivotIntent(
    before: ContextSnapshot,
    detected: IntentMatch,
    queryText: string,
  ): string | undefined {
    if (!before.activeIntent) return undefined;
    const previousRule = this.config.responses.find((candidate) => candidate.intentId === before.activeIntent);
    if (!previousRule) return undefined;

    const ruleConsumesSlot = (rule: IntentResponseRule): boolean => {
      const ruleSlots = new Set<string>();
      for (const s of rule.requiredAnySlots ?? []) ruleSlots.add(s);
      for (const sel of selectorsOf(rule)) {
        if (sel.slot) ruleSlots.add(sel.slot);
      }
      if (rule.ageRangeTemplate) {
        ruleSlots.add('childAge');
        ruleSlots.add('nextAge');
      }
      if (this.config.slotDependencies) {
        for (const [parentSlot, dependents] of Object.entries(this.config.slotDependencies)) {
          if (dependents.some((dep) => ruleSlots.has(dep))) ruleSlots.add(parentSlot);
        }
      }
      return [...ruleSlots].some((slot) => detected.slots[slot] !== undefined);
    };

    if (ruleConsumesSlot(previousRule)) {
      return previousRule.intentId;
    }

    const selectors = selectorsOf(previousRule);
    if (selectors.some((s) => s.mentioned)) {
      const mention = selectMentioned(
        queryText,
        selectors,
        this.store.all(),
        { ...before.slots, ...detected.slots },
      );
      if (mention.kind === 'record') {
        return previousRule.intentId;
      }
    }

    // If active intent is a specific *_pricing rule (e.g. web_pricing) and the visitor pivots
    // to another product slot ("A za agenta?"), route to the generic pricing rule that selects by slot.
    if (before.activeIntent.endsWith('_pricing') || before.activeIntent === 'websites' || before.activeIntent === 'hybrid_agent') {
      const genericPricing = this.config.responses.find(
        (candidate) => candidate.intentId === 'pricing' && ruleConsumesSlot(candidate),
      );
      if (genericPricing && before.activeIntent.endsWith('_pricing')) {
        return genericPricing.intentId;
      }
    }

    return undefined;
  }

  /**
   * Stateless hosts (serverless) create the engine per request, so the dialogue context
   * would be lost between turns. Prior user turns rebuild slots and the active intent.
   * Only a fresh context is rebuilt; unsafe turns are skipped.
   */
  private async replayHistory(
    sessionCtx: { context: ConversationContext; discourse: DiscourseContext },
    history: string[] | undefined,
    now?: Date,
  ): Promise<void> {
    if (!Array.isArray(history) || history.length === 0) return;
    if (sessionCtx.context.snapshot().turn > 0) return;
    for (const past of history.slice(-MAX_HISTORY_TURNS)) {
      if (typeof past !== 'string' || !past.trim()) continue;
      if (!SafetyShield.checkSafety(past).isSafe) continue;
      const before = sessionCtx.context.snapshot();
      let match = this.intentEngine.detect(past, before, now, sessionCtx.discourse.snapshot());
      if (
        match.id === 'unknown'
        && before.activeIntent
        && match.normalizedText.split(' ').filter(Boolean).length <= MAX_FACET_FOLLOW_UP_WORDS
      ) {
        const previousRule = this.config.responses.find((candidate) => candidate.intentId === before.activeIntent);
        if (resolveRuleFacet(previousRule, past)) {
          match = { ...match, id: before.activeIntent, confidence: 0.5, isFollowUp: true };
        } else {
          const pivot = this.resolvePivotIntent(before, match, past);
          if (pivot) {
            match = { ...match, id: pivot, confidence: 0.75, isFollowUp: true };
          }
        }
      }
      if (match.id === 'unknown' && this.config.semanticIntents) {
        const semantic = await this.resolveSemanticIntent(past);
        if (semantic) {
          match = { ...match, id: semantic.intentId, confidence: semantic.score, isFollowUp: false };
        }
      }
      sessionCtx.context.apply(match);
      sessionCtx.discourse.advanceTurn(past, '', match.id);
    }
  }

  /**
   * Opt-in semantic decision for messages the lexical detector does not know.
   * Only intents with a response rule are eligible; any resolver failure means
   * "not confident" and the request continues as before.
   */
  private async resolveSemanticIntent(text: string): Promise<SemanticIntentDecision | null> {
    const settings = this.config.semanticIntents;
    if (!settings || settings.processing !== 'local' || typeof settings.resolver !== 'function') return null;
    try {
      const answerable = new Set(this.config.responses.map((rule) => rule.intentId));
      const known = new Set(this.config.intents.map((intent) => intent.id).filter((id) => answerable.has(id)));
      const mentionFields = new Set(this.config.responses.flatMap((rule) => selectorsOf(rule))
        .filter((selector) => selector.mentioned).map((selector) => selector.dataField));
      const evidence = mentionFields.size ? withoutMentions(text, knownValues(this.store.all(), mentionFields)) : text;
      return selectSemanticIntent(await settings.resolver(evidence), known, settings);
    } catch {
      return null;
    }
  }

  /**
   * Resolves the second factual clause of a compound question when the message asks two
   * distinct factual intents in a single turn ("Kolik stojí příspěvky a kdy je školička?").
   */
  private resolveSecondaryClause(
    queryText: string,
    primaryIntentId: string,
    primaryRecordId: string | undefined,
    primaryText: string,
    context: ContextSnapshot,
    now?: Date,
  ): { intentId: string; text: string; recordId: string } | undefined {
    if (this.intentEngine.hasExactExample(queryText)) return undefined;
    const clauses = splitCompoundClauses(queryText);
    if (!clauses) return undefined;
    const [leftClause, rightClause] = clauses;

    const leftMatch = this.intentEngine.detect(leftClause, context, now);
    const rightMatch = this.intentEngine.detect(rightClause, context, now);
    if (rightMatch.id === 'unknown') return undefined;

    // Choose whichever clause was not already answered by primaryIntentId.
    const secondaryClause = rightMatch.id !== primaryIntentId
      ? { text: rightClause, match: rightMatch }
      : (leftMatch.id !== 'unknown' && leftMatch.id !== primaryIntentId
          ? { text: leftClause, match: leftMatch }
          : undefined);
    if (!secondaryClause) return undefined;

    const secRule = this.config.responses.find((candidate) => candidate.intentId === secondaryClause.match.id);
    if (!secRule || secRule.sourceRequired === false || secRule.clarification) return undefined;

    const secContext: ContextSnapshot = {
      ...context,
      slots: { ...context.slots, ...secondaryClause.match.slots },
    };
    if (!hasAnySlot(secRule, secContext.slots)) return undefined;

    const resolved = this.sourceResolver.resolve(secRule, secContext, now, false, secondaryClause.text);
    if (!resolved.record || resolved.freshness !== 'fresh') return undefined;

    const secFacet = resolveRuleFacet(secRule, secondaryClause.text);
    let rawTemplate = secFacet?.template ?? resolved.template ?? secRule.template;
    if (resolved.record.id === primaryRecordId && rawTemplate) {
      rawTemplate = stripLeadingRecordContent(rawTemplate);
    }
    const secText = this.composer.compose(
      rawTemplate,
      resolved.record,
      secContext,
      secRule.cadence,
      secondaryClause.text,
      this.config.listConjunction,
    );
    if (!secText || primaryText.includes(secText)) return undefined;
    return { intentId: secondaryClause.match.id, text: secText, recordId: resolved.record.id };
  }

  async respond(request: FrameMindRequest): Promise<FrameMindResponse> {
    const trace: { semantic?: SemanticIntentDecision } = {};
    const response = await this.respondInternal(request, trace);
    return trace.semantic && response.intent === trace.semantic.intentId
      ? { ...response, semantic: trace.semantic }
      : response;
  }

  private async respondInternal(
    request: FrameMindRequest,
    trace: { semantic?: SemanticIntentDecision },
  ): Promise<FrameMindResponse> {
    const sessionCtx = this.requestContext(request.sessionId);
    await this.replayHistory(sessionCtx, request.history, request.now);

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
    const detected = this.intentEngine.detect(queryText, before, request.now, sessionCtx.discourse.snapshot());

    // Doptávka bez vlastního záměru („A kde?“, „A béčko?“, „A se Slavonínem?“):
    // odpoví aspekt nebo slot/zmínka pravidla předchozího záměru.
    let match = detected;
    let facet: ResponseFacet | undefined;
    if (
      detected.id === 'unknown'
      && before.activeIntent
      && detected.normalizedText.split(' ').filter(Boolean).length <= MAX_FACET_FOLLOW_UP_WORDS
    ) {
      const previousRule = this.config.responses.find((candidate) => candidate.intentId === before.activeIntent);
      facet = resolveRuleFacet(previousRule, queryText);
      if (facet) {
        match = { ...detected, id: before.activeIntent, confidence: 0.5, isFollowUp: true };
      } else {
        const pivotIntent = this.resolvePivotIntent(before, detected, queryText);
        if (pivotIntent) {
          match = { ...detected, id: pivotIntent, confidence: 0.75, isFollowUp: true };
        }
      }
    }
    // Opt-in semantic layer: only when neither the lexical detector nor a follow-up
    // facet/slot pivot recognised the message. It selects an existing intent; the rule answers.
    if (match.id === 'unknown' && this.config.semanticIntents) {
      const semantic = await this.resolveSemanticIntent(queryText);
      if (semantic) {
        trace.semantic = semantic;
        match = { ...detected, id: semantic.intentId, confidence: semantic.score, isFollowUp: false };
      }
    }
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
    facet ??= resolveRuleFacet(rule, queryText);
    const listConjunction = this.config.listConjunction;

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
      const text = this.composer.compose(facet?.template ?? rule.template, undefined, context, rule.cadence, request.text, listConjunction);
      if (text) {
        sessionCtx.discourse.advanceTurn(request.text, text, match.id);
        return {
          text,
          intent: match.id,
          confidence: match.confidence,
          local: true,
          providerUsed: false,
          ...(facet ? { facet: facet.id } : {}),
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
      const ageRange = missingSlot ? this.resolveAgeRange(rule, context, request.now) : undefined;
      if (ageRange) {
        sessionCtx.context.markSource(ageRange.a.record.id);
        const text = this.composer.compose(rule.ageRangeTemplate, undefined, ageRange.values, rule.cadence, request.text, listConjunction);
        sessionCtx.discourse.advanceTurn(request.text, text, match.id);
        return {
          text,
          intent: match.id,
          confidence: match.confidence,
          local: true,
          providerUsed: false,
          ...(ageRange.a.reference ? { source: ageRange.a.reference } : {}),
          actions: [],
          context: sessionCtx.context.snapshot(),
          reason: 'known',
          suggestions,
          discourse: sessionCtx.discourse.snapshot(),
        };
      }
      const resolved = this.sourceResolver.resolve(rule, context, request.now, missingSlot, request.text);
      if (resolved.record && resolved.freshness === 'fresh') {
        const recordAlreadySeen = before.sourceIds.includes(resolved.record.id);
        sessionCtx.context.markSource(resolved.record.id);
        const answeredFacet = missingSlot ? undefined : facet;
        let effectiveTemplate = missingSlot
          ? rule.missingTemplate
          : (answeredFacet?.template ?? resolved.template ?? rule.template);

        // Progressive disclosure: on a follow-up facet turn for a record the visitor already
        // saw in this session, strip the redundant leading {{record.content}} overview.
        if (
          !missingSlot
          && answeredFacet
          && recordAlreadySeen
          && answeredFacet.template !== rule.template
        ) {
          effectiveTemplate = stripLeadingRecordContent(answeredFacet.template);
        }

        let text = this.composer.compose(
          effectiveTemplate,
          resolved.record,
          context,
          rule.cadence,
          request.text,
          listConjunction,
        );

        let secondaryIntent: string | undefined;
        if (!missingSlot) {
          const secondary = this.resolveSecondaryClause(
            queryText,
            match.id,
            resolved.record.id,
            text,
            context,
            request.now,
          );
          if (secondary) {
            text = `${text} ${secondary.text}`.replace(/\s+/g, ' ').trim();
            secondaryIntent = secondary.intentId;
            sessionCtx.context.markSource(secondary.recordId);
          }
        }

        const actions = missingSlot ? [] : this.actionResolver.resolve(match.id, context, request.availablePaths, match.slots.navigationRequested === true);
        sessionCtx.discourse.advanceTurn(request.text, text, match.id);
        return {
          text,
          intent: match.id,
          confidence: match.confidence,
          local: true,
          providerUsed: false,
          ...(resolved.reference ? { source: resolved.reference } : {}),
          ...(answeredFacet ? { facet: answeredFacet.id } : {}),
          ...(secondaryIntent ? { secondaryIntent } : {}),
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
          listConjunction,
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

  /**
   * Adds or replaces records by id in a running engine, e.g. live club data that arrive
   * after the widget started. Records are validated like a snapshot; invalid ones throw.
   */
  upsertRecords(records: KnowledgeRecord[]): void {
    this.store.upsert(records);
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
