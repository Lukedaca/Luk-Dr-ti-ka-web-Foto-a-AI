import { ActionResolver } from './ActionResolver.js';
import { deferralReason } from './AnswerGate.js';
import { ConversationContext } from './ConversationContext.js';
import { DataPolicy } from './DataPolicy.js';
import { DiscourseContext } from './DiscourseContext.js';
import { IntentEngine } from './IntentEngine.js';
import { KnowledgeStore } from './KnowledgeStore.js';
import { KnowledgeReasoner } from './KnowledgeReasoner.js';
import { NoopLearningSink } from './NoopLearningSink.js';
import { PrivacyGuard } from './PrivacyGuard.js';
import { ProviderRouter } from './ProviderRouter.js';
import { ResponseComposer } from './ResponseComposer.js';
import { resolveRuleFacet, stripLeadingRecordContent } from './ResponseFacets.js';
import { SourceResolver, selectorsOf } from './SourceResolver.js';
import { knownValues, selectMentioned, withoutMentions } from './MentionedRecords.js';
import { SafetyShield } from './SafetyShield.js';
import { selectSemanticIntent } from './SemanticIntents.js';
import { normalizeText, stripConversationalBridge } from './text.js';
const MIN_CHILD_AGE = 3;
const MAX_CHILD_AGE = 19;
/** Replayed prior user turns; older turns rarely carry slots that still matter. */
const MAX_HISTORY_TURNS = 6;
/** "A kde?", "A co je v ceně?", "A do kdy je splatnost?" — longer messages without an intent are a new topic. */
const MAX_FACET_FOLLOW_UP_WORDS = 8;
const COMPOUND_SPLIT_RE = /\?\s+(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽa-záčďéěíňóřšťúůýž]{2,})|\s+(?:a\s+zároveň|a\s+taky|a\s+také|a\s+(?=(?:kolik|kdy|kde|kam|kdo|jak|jaký|jaká|jaké|co|za\s+kolik)\b))\s*/i;
function splitCompoundClauses(text) {
    const match = COMPOUND_SPLIT_RE.exec(text);
    if (!match || match.index <= 0)
        return null;
    const left = text.slice(0, match.index).trim();
    const separator = match[0];
    const rightRaw = text.slice(match.index + separator.length).trim();
    if (!left || !rightRaw)
        return null;
    const leftWords = normalizeText(left).split(' ').filter(Boolean);
    const rightWords = normalizeText(rightRaw).split(' ').filter(Boolean);
    if (leftWords.length < 2 || rightWords.length < 2)
        return null;
    return [left, rightRaw];
}
function hasAnySlot(rule, slots) {
    var _a;
    if (!((_a = rule.requiredAnySlots) === null || _a === void 0 ? void 0 : _a.length))
        return true;
    return rule.requiredAnySlots.some((key) => slots[key] !== undefined && slots[key] !== '');
}
export class FrameMindEngine {
    constructor(config, snapshot) {
        var _a, _b, _c, _d;
        this.config = config;
        this.discourse = new DiscourseContext();
        this.sessionContexts = new Map();
        this.composer = new ResponseComposer();
        this.context = new ConversationContext(config.slotDependencies);
        this.privacyGuard = new PrivacyGuard(config.mode);
        this.dataPolicy = new DataPolicy(config.tenantPolicy ? [config.tenantPolicy] : [], (_a = config.providerCompliance) !== null && _a !== void 0 ? _a : []);
        this.intentEngine = new IntentEngine(config.intents, config.slotPatterns);
        this.store = new KnowledgeStore(snapshot);
        this.reasoner = new KnowledgeReasoner(config, this.store);
        this.sourceResolver = new SourceResolver(this.store, undefined, (_b = config.sourceLabel) !== null && _b !== void 0 ? _b : 'Ověřený zdroj');
        this.actionResolver = new ActionResolver(config.actions, this.privacyGuard);
        const adapter = ((_c = config.provider) === null || _c === void 0 ? void 0 : _c.enabled) ? config.provider.adapter : undefined;
        this.providerRouter = new ProviderRouter(adapter, this.privacyGuard, undefined, this.dataPolicy, config.tenantPolicy);
        this.learningSink = (_d = config.learningSink) !== null && _d !== void 0 ? _d : new NoopLearningSink();
    }
    requestContext(sessionId) {
        var _a, _b;
        const settings = this.config.sessions;
        if (!sessionId) {
            if (settings === null || settings === void 0 ? void 0 : settings.requireSessionId)
                throw new Error('sessionId is required by session isolation policy');
            return { context: this.context, discourse: this.discourse };
        }
        if (!/^[a-zA-Z0-9_-]{8,128}$/.test(sessionId))
            throw new Error('sessionId format is invalid');
        const now = Date.now();
        const idleTtlMs = Math.max(1000, (_a = settings === null || settings === void 0 ? void 0 : settings.idleTtlMs) !== null && _a !== void 0 ? _a : 30 * 60000);
        for (const [id, entry] of this.sessionContexts) {
            if (now - entry.touchedAt >= idleTtlMs)
                this.sessionContexts.delete(id);
        }
        const existing = this.sessionContexts.get(sessionId);
        if (existing) {
            existing.touchedAt = now;
            return { context: existing.context, discourse: existing.discourse };
        }
        const maxSessions = Math.max(1, (_b = settings === null || settings === void 0 ? void 0 : settings.maxSessions) !== null && _b !== void 0 ? _b : 1000);
        if (this.sessionContexts.size >= maxSessions) {
            let oldestId;
            let oldestAt = Infinity;
            for (const [id, entry] of this.sessionContexts) {
                if (entry.touchedAt < oldestAt) {
                    oldestId = id;
                    oldestAt = entry.touchedAt;
                }
            }
            if (oldestId)
                this.sessionContexts.delete(oldestId);
        }
        const context = new ConversationContext(this.config.slotDependencies);
        const discourse = new DiscourseContext();
        this.sessionContexts.set(sessionId, { context, discourse, touchedAt: now });
        return { context, discourse };
    }
    /** Both birth years an age can mean, each grounded in a fresh record; otherwise undefined. */
    resolveAgeRange(rule, context, now = new Date()) {
        var _a, _b;
        const age = context.slots.childAge;
        const birthYearSelector = selectorsOf(rule).find((selector) => selector.slot);
        if (!rule.ageRangeTemplate || !(birthYearSelector === null || birthYearSelector === void 0 ? void 0 : birthYearSelector.slot) || typeof age !== 'number')
            return undefined;
        if (age < MIN_CHILD_AGE || age > MAX_CHILD_AGE)
            return undefined;
        const slot = birthYearSelector.slot;
        const yearA = (typeof context.slots.currentYear === 'number' ? context.slots.currentYear : now.getUTCFullYear()) - age;
        const yearB = yearA - 1;
        const withYear = (year) => ({ ...context, slots: { ...context.slots, [slot]: year } });
        const a = this.sourceResolver.resolve(rule, withYear(yearA), now);
        const b = this.sourceResolver.resolve(rule, withYear(yearB), now);
        if (!a.record || !b.record || a.freshness !== 'fresh' || b.freshness !== 'fresh')
            return undefined;
        return {
            a: { record: a.record, reference: a.reference },
            values: { slots: { ...context.slots, yearA, yearB, a: (_a = a.record.data) !== null && _a !== void 0 ? _a : {}, b: (_b = b.record.data) !== null && _b !== void 0 ? _b : {} } },
        };
    }
    /**
     * Slot-pivot & mention-pivot ellipsis resolution (2.1.0):
     * When a short follow-up message has no lexical intent of its own ("A béčko?", "A U-11?",
     * "A se Slavonínem?", "A u webů?"), checks whether it supplies a slot or mentioned entity
     * consumed by the active intent's response rule (or its generic pricing sibling).
     */
    resolvePivotIntent(before, detected, queryText) {
        if (!before.activeIntent)
            return undefined;
        const previousRule = this.config.responses.find((candidate) => candidate.intentId === before.activeIntent);
        if (!previousRule)
            return undefined;
        const ruleConsumesSlot = (rule) => {
            var _a;
            const ruleSlots = new Set();
            for (const s of (_a = rule.requiredAnySlots) !== null && _a !== void 0 ? _a : [])
                ruleSlots.add(s);
            for (const sel of selectorsOf(rule)) {
                if (sel.slot)
                    ruleSlots.add(sel.slot);
            }
            if (rule.ageRangeTemplate) {
                ruleSlots.add('childAge');
                ruleSlots.add('nextAge');
            }
            if (this.config.slotDependencies) {
                for (const [parentSlot, dependents] of Object.entries(this.config.slotDependencies)) {
                    if (dependents.some((dep) => ruleSlots.has(dep)))
                        ruleSlots.add(parentSlot);
                }
            }
            return [...ruleSlots].some((slot) => detected.slots[slot] !== undefined);
        };
        if (ruleConsumesSlot(previousRule)) {
            return previousRule.intentId;
        }
        const selectors = selectorsOf(previousRule);
        if (selectors.some((s) => s.mentioned)) {
            const mention = selectMentioned(queryText, selectors, this.store.all(), { ...before.slots, ...detected.slots });
            if (mention.kind === 'record') {
                return previousRule.intentId;
            }
        }
        // If active intent is a specific *_pricing rule (e.g. web_pricing) and the visitor pivots
        // to another product slot ("A za agenta?"), route to the generic pricing rule that selects by slot.
        if (before.activeIntent.endsWith('_pricing') || before.activeIntent === 'websites' || before.activeIntent === 'hybrid_agent') {
            const genericPricing = this.config.responses.find((candidate) => candidate.intentId === 'pricing' && ruleConsumesSlot(candidate));
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
    async replayHistory(sessionCtx, history, now) {
        if (!Array.isArray(history) || history.length === 0)
            return;
        if (sessionCtx.context.snapshot().turn > 0)
            return;
        for (const past of history.slice(-MAX_HISTORY_TURNS)) {
            if (typeof past !== 'string' || !past.trim())
                continue;
            if (!SafetyShield.checkSafety(past).isSafe)
                continue;
            const before = sessionCtx.context.snapshot();
            // Stejné rozhodnutí jako živý tah: co tehdy šlo na model, nesmí teď nastavit téma.
            const { match } = await this.detectTurn(past, before, sessionCtx.discourse.snapshot(), now);
            sessionCtx.context.apply(match);
            sessionCtx.discourse.advanceTurn(past, '', match.id);
        }
    }
    /**
     * Záměr tahu: lexikální detektor, doptávka (aspekt, slot, zmínka), sémantika, odvození.
     * Brána 2.6.0 pak rozhodne, jestli smí jádro odpovědět samo; když ne, vrací `unknown`
     * a záměr jen jako návrh (`deferral.intent`).
     */
    async detectTurn(queryText, before, discourse, now) {
        var _a;
        const isExactRaw = this.intentEngine.hasExactExample(queryText);
        const coreQuery = isExactRaw ? queryText : stripConversationalBridge(queryText);
        const rawDetected = this.intentEngine.detect(queryText, before, now, discourse);
        const coreDetected = coreQuery !== queryText
            ? this.intentEngine.detect(coreQuery, before, now, discourse)
            : rawDetected;
        const rawIsBridgeSocial = coreQuery !== queryText
            && ['greeting', 'thanks', 'affirmation'].includes(rawDetected.id);
        let effectiveQuery = (coreQuery !== queryText && coreDetected.id !== 'unknown')
            ? coreQuery
            : queryText;
        let detected = effectiveQuery === coreQuery ? coreDetected : rawDetected;
        let match = detected;
        let facet;
        let semantic;
        let origin = isExactRaw
            ? 'exact'
            : (this.intentEngine.hasExactExample(effectiveQuery) ? 'exact' : 'lexical');
        // Doptávka bez vlastního záměru („A kde?“, „A béčko?“, „A do kdy je splatnost?“):
        // odpoví aspekt, slot/zmínka nebo odvozená věta pravidla předchozího záměru.
        const followUpWords = coreDetected.normalizedText.split(' ').filter(Boolean);
        if ((detected.id === 'unknown' || rawIsBridgeSocial)
            && before.activeIntent
            && followUpWords.length <= MAX_FACET_FOLLOW_UP_WORDS) {
            const previousRule = this.config.responses.find((candidate) => candidate.intentId === before.activeIntent);
            facet = resolveRuleFacet(previousRule, coreQuery);
            if (facet) {
                match = { ...coreDetected, id: before.activeIntent, confidence: 0.5, isFollowUp: true };
                origin = 'facet';
                effectiveQuery = coreQuery;
            }
            else {
                const pivotIntent = this.resolvePivotIntent(before, coreDetected, coreQuery);
                if (pivotIntent) {
                    match = { ...coreDetected, id: pivotIntent, confidence: 0.75, isFollowUp: true };
                    origin = 'pivot';
                    effectiveQuery = coreQuery;
                }
                else if (previousRule
                    && this.config.deductiveReasoning !== false
                    && this.reasoner.getRuleRecordTerms(before.activeIntent, now).length > 0) {
                    const mergedContext = {
                        ...before,
                        slots: { ...before.slots, ...coreDetected.slots },
                    };
                    const resolvedPrev = this.sourceResolver.resolve(previousRule, mergedContext, now, false, coreQuery);
                    if (resolvedPrev.record && resolvedPrev.freshness === 'fresh') {
                        const deducedFacet = this.reasoner.deduceFacet(previousRule, resolvedPrev.record, coreQuery, true);
                        if (deducedFacet) {
                            facet = deducedFacet;
                            match = {
                                ...coreDetected,
                                id: before.activeIntent,
                                confidence: 0.72,
                                slots: mergedContext.slots,
                                isFollowUp: true,
                            };
                            origin = 'facet';
                            effectiveQuery = coreQuery;
                        }
                    }
                }
            }
        }
        // If stripping a social bridge did not yield a follow-up or factual intent, fall back to the social intent.
        if (match.id === 'unknown' && rawIsBridgeSocial && rawDetected.id !== 'unknown') {
            match = rawDetected;
            detected = rawDetected;
            effectiveQuery = queryText;
            origin = 'lexical';
        }
        // Opt-in semantic layer: only when neither the lexical detector nor a follow-up
        // facet/slot pivot recognised the message. It selects an existing intent; the rule answers.
        if (match.id === 'unknown' && this.config.semanticIntents) {
            semantic = (_a = (await this.resolveSemanticIntent(effectiveQuery))) !== null && _a !== void 0 ? _a : undefined;
            if (semantic) {
                match = { ...detected, id: semantic.intentId, confidence: semantic.score, isFollowUp: false };
                origin = 'semantic';
            }
        }
        if (match.id === 'unknown' && this.config.deductiveReasoning !== false) {
            const deduced = this.reasoner.deduceIntent(effectiveQuery, before, discourse, now);
            if (deduced) {
                match = {
                    ...detected,
                    id: deduced.intentId,
                    confidence: deduced.confidence,
                    slots: { ...detected.slots, ...deduced.inferredSlots },
                    isFollowUp: deduced.isFollowUp,
                };
                origin = 'deduced';
                if (deduced.facet && !facet)
                    facet = deduced.facet;
            }
        }
        if (match.id === 'unknown')
            return { match };
        const reason = this.gateReason(effectiveQuery, match.id, origin, facet, now);
        if (!reason)
            return { match, facet, semantic };
        return {
            match: { ...detected, id: 'unknown', confidence: 0, isFollowUp: false },
            deferral: { reason, intent: match.id },
        };
    }
    gateEnabled() {
        var _a;
        return ((_a = this.config.answerGate) === null || _a === void 0 ? void 0 : _a.enabled) !== false;
    }
    gateReason(text, intentId, origin, activeFacet, now) {
        var _a, _b;
        if (!this.gateEnabled())
            return null;
        const rule = this.config.responses.find((candidate) => candidate.intentId === intentId);
        const mentionFields = new Set(this.config.responses.flatMap((candidate) => selectorsOf(candidate))
            .filter((selector) => selector.mentioned).map((selector) => selector.dataField));
        const facets = activeFacet
            ? [...((_a = rule === null || rule === void 0 ? void 0 : rule.facets) !== null && _a !== void 0 ? _a : []), activeFacet]
            : rule === null || rule === void 0 ? void 0 : rule.facets;
        return deferralReason({
            text,
            origin,
            definition: this.config.intents.find((definition) => definition.id === intentId),
            facets,
            recordTerms: this.reasoner.getRuleRecordTerms(intentId, now),
            slotPatterns: this.config.slotPatterns,
            mentionValues: mentionFields.size ? knownValues(this.store.all(), mentionFields) : [],
            neutralTerms: (_b = this.config.answerGate) === null || _b === void 0 ? void 0 : _b.neutralTerms,
        });
    }
    /** Stejná odpověď podruhé za sebou znamená, že první nepomohla — rozhodne model. */
    repeatsLastReply(text, discourse) {
        if (!this.gateEnabled() || !text.trim())
            return false;
        return normalizeText(text) === normalizeText(discourse.snapshot().lastReply);
    }
    /**
     * Opt-in semantic decision for messages the lexical detector does not know.
     * Only intents with a response rule are eligible; any resolver failure means
     * "not confident" and the request continues as before.
     */
    async resolveSemanticIntent(text) {
        const settings = this.config.semanticIntents;
        if (!settings || settings.processing !== 'local' || typeof settings.resolver !== 'function')
            return null;
        try {
            const answerable = new Set(this.config.responses.map((rule) => rule.intentId));
            const known = new Set(this.config.intents.map((intent) => intent.id).filter((id) => answerable.has(id)));
            const mentionFields = new Set(this.config.responses.flatMap((rule) => selectorsOf(rule))
                .filter((selector) => selector.mentioned).map((selector) => selector.dataField));
            const evidence = mentionFields.size ? withoutMentions(text, knownValues(this.store.all(), mentionFields)) : text;
            return selectSemanticIntent(await settings.resolver(evidence), known, settings);
        }
        catch {
            return null;
        }
    }
    /**
     * Resolves the second factual clause of a compound question when the message asks two
     * distinct factual intents in a single turn ("Kolik stojí příspěvky a kdy je školička?").
     */
    resolveSecondaryClause(queryText, primaryIntentId, primaryRecordId, primaryText, context, now) {
        var _a, _b;
        if (this.intentEngine.hasExactExample(queryText))
            return undefined;
        const clauses = splitCompoundClauses(queryText);
        if (!clauses)
            return undefined;
        const [leftClause, rightClause] = clauses;
        const leftMatch = this.intentEngine.detect(leftClause, context, now);
        const rightMatch = this.intentEngine.detect(rightClause, context, now);
        if (rightMatch.id === 'unknown')
            return undefined;
        // Choose whichever clause was not already answered by primaryIntentId.
        const secondaryClause = rightMatch.id !== primaryIntentId
            ? { text: rightClause, match: rightMatch }
            : (leftMatch.id !== 'unknown' && leftMatch.id !== primaryIntentId
                ? { text: leftClause, match: leftMatch }
                : undefined);
        if (!secondaryClause)
            return undefined;
        const secRule = this.config.responses.find((candidate) => candidate.intentId === secondaryClause.match.id);
        if (!secRule || secRule.sourceRequired === false || secRule.clarification)
            return undefined;
        const secContext = {
            ...context,
            slots: { ...context.slots, ...secondaryClause.match.slots },
        };
        if (!hasAnySlot(secRule, secContext.slots))
            return undefined;
        const resolved = this.sourceResolver.resolve(secRule, secContext, now, false, secondaryClause.text);
        if (!resolved.record || resolved.freshness !== 'fresh')
            return undefined;
        const secFacet = resolveRuleFacet(secRule, secondaryClause.text);
        let rawTemplate = (_b = (_a = secFacet === null || secFacet === void 0 ? void 0 : secFacet.template) !== null && _a !== void 0 ? _a : resolved.template) !== null && _b !== void 0 ? _b : secRule.template;
        if (resolved.record.id === primaryRecordId && rawTemplate) {
            rawTemplate = stripLeadingRecordContent(rawTemplate);
        }
        const secText = this.composer.compose(rawTemplate, resolved.record, secContext, secRule.cadence, secondaryClause.text, this.config.listConjunction);
        if (!secText || primaryText.includes(secText))
            return undefined;
        return { intentId: secondaryClause.match.id, text: secText, recordId: resolved.record.id };
    }
    async respond(request) {
        const trace = {};
        const response = await this.respondInternal(request, trace);
        return trace.semantic && response.intent === trace.semantic.intentId
            ? { ...response, semantic: trace.semantic }
            : response;
    }
    async respondInternal(request, trace) {
        var _a, _b, _c, _d, _e, _f, _g;
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
        let contrastiveRejectedIntent;
        const pendingClarification = sessionCtx.discourse.getAwaitingClarification();
        if (pendingClarification) {
            const norm = queryText.toLowerCase().trim();
            let mappedIntent;
            if ((_a = pendingClarification.context) === null || _a === void 0 ? void 0 : _a.intentMap) {
                const map = pendingClarification.context.intentMap;
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
        }
        else {
            const contrastive = sessionCtx.discourse.extractContrastiveRepair(request.text);
            if (contrastive) {
                queryText = contrastive.positiveTarget;
                const rejectedDetected = this.intentEngine.detect(contrastive.rejectedTarget, sessionCtx.context.snapshot(), request.now, sessionCtx.discourse.snapshot());
                if (rejectedDetected.id !== 'unknown') {
                    contrastiveRejectedIntent = rejectedDetected.id;
                }
            }
            else if (sessionCtx.discourse.isRepairQuery(request.text)) {
                const subject = sessionCtx.discourse.extractRepairSubject(request.text);
                if (subject) {
                    queryText = subject;
                }
            }
        }
        const before = sessionCtx.context.snapshot();
        const turn = await this.detectTurn(queryText, before, sessionCtx.discourse.snapshot(), request.now);
        let match = turn.match;
        let facet = turn.facet;
        if (turn.semantic)
            trace.semantic = turn.semantic;
        let deferral = turn.deferral;
        if (contrastiveRejectedIntent && this.gateEnabled()) {
            if (match.id === 'unknown' || match.id === contrastiveRejectedIntent) {
                match = { ...match, id: 'unknown', confidence: 0, isFollowUp: false };
                deferral = { reason: 'negation', intent: contrastiveRejectedIntent };
            }
        }
        const context = sessionCtx.context.apply(match);
        // Match profile entity if configured
        if ((_b = this.config.profile) === null || _b === void 0 ? void 0 : _b.entities) {
            const norm = queryText.toLowerCase();
            const entityDef = this.config.profile.entities.find((e) => e.keywords.some((k) => norm.includes(k.toLowerCase())) ||
                norm.includes(e.name.toLowerCase()));
            if (entityDef) {
                sessionCtx.discourse.setEntity(entityDef.type, entityDef.name);
            }
        }
        const rule = this.config.responses.find((candidate) => candidate.intentId === match.id);
        facet !== null && facet !== void 0 ? facet : (facet = resolveRuleFacet(rule, queryText));
        const listConjunction = this.config.listConjunction;
        // If rule requires clarification (e.g. general pricing without active entity)
        if ((rule === null || rule === void 0 ? void 0 : rule.clarification) && !sessionCtx.discourse.getEntity()) {
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
        if ((rule === null || rule === void 0 ? void 0 : rule.sourceRequired) === false) {
            const text = this.composer.compose((_c = facet === null || facet === void 0 ? void 0 : facet.template) !== null && _c !== void 0 ? _c : rule.template, undefined, context, rule.cadence, request.text, listConjunction);
            if (text && this.repeatsLastReply(text, sessionCtx.discourse))
                deferral = { reason: 'repeat', intent: match.id };
            else if (text) {
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
                if (!missingSlot && !facet && recordAlreadySeen && this.config.deductiveReasoning !== false) {
                    facet = this.reasoner.deduceFacet(rule, resolved.record, queryText, recordAlreadySeen);
                }
                const answeredFacet = missingSlot ? undefined : facet;
                let effectiveTemplate = missingSlot
                    ? rule.missingTemplate
                    : ((_e = (_d = answeredFacet === null || answeredFacet === void 0 ? void 0 : answeredFacet.template) !== null && _d !== void 0 ? _d : resolved.template) !== null && _e !== void 0 ? _e : rule.template);
                // Progressive disclosure: on a follow-up facet turn for a record the visitor already
                // saw in this session, strip the redundant leading {{record.content}} overview.
                if (!missingSlot
                    && answeredFacet
                    && recordAlreadySeen
                    && answeredFacet.template !== rule.template) {
                    effectiveTemplate = stripLeadingRecordContent(answeredFacet.template);
                }
                let text = this.composer.compose(effectiveTemplate, resolved.record, context, rule.cadence, request.text, listConjunction);
                if (this.config.deductiveReasoning !== false && context.slots.budgetKc && !missingSlot) {
                    const budgetConclusion = this.reasoner.deduceBudgetConclusion(text, resolved.record, context.slots.budgetKc);
                    if (budgetConclusion && !text.includes('rozpočtu') && !text.includes('rozpočet')) {
                        text = `${text} ${budgetConclusion}`.trim();
                    }
                }
                let secondaryIntent;
                if (!missingSlot) {
                    const secondary = this.resolveSecondaryClause(queryText, match.id, resolved.record.id, text, context, request.now);
                    if (secondary) {
                        text = `${text} ${secondary.text}`.replace(/\s+/g, ' ').trim();
                        secondaryIntent = secondary.intentId;
                        sessionCtx.context.markSource(secondary.recordId);
                    }
                }
                const actions = missingSlot ? [] : this.actionResolver.resolve(match.id, context, request.availablePaths, match.slots.navigationRequested === true);
                const sameSlots = JSON.stringify(before.slots) === JSON.stringify(context.slots);
                const repeatsStaticRecord = this.gateEnabled()
                    && recordAlreadySeen
                    && before.activeIntent === match.id
                    && !answeredFacet
                    && !missingSlot
                    && !secondaryIntent
                    && sameSlots;
                if (this.repeatsLastReply(text, sessionCtx.discourse) || repeatsStaticRecord) {
                    deferral = { reason: 'repeat', intent: match.id };
                }
                else {
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
            }
            if (resolved.record && resolved.freshness !== 'fresh') {
                const text = this.composer.compose((_f = rule.staleTemplate) !== null && _f !== void 0 ? _f : this.config.staleResponse, resolved.record, context, rule.cadence, request.text, listConjunction);
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
        const deferredFields = deferral ? { deferred: deferral.reason, suggestedIntent: deferral.intent } : {};
        if (this.config.mode === 'managed'
            && ((_g = this.config.provider) === null || _g === void 0 ? void 0 : _g.enabled)
            && request.allowManagedProvider === true
            && typeof request.providerText === 'string') {
            const provider = await this.providerRouter.generate(request.providerText, this.config.locale, context, true, this.config.provider.allowedContextSlots, this.config.provider.maxInputChars);
            if (provider === null || provider === void 0 ? void 0 : provider.text) {
                sessionCtx.discourse.advanceTurn(request.text, provider.text, deferral ? 'unknown' : match.id);
                return {
                    text: provider.text,
                    intent: deferral ? 'unknown' : match.id,
                    ...deferredFields,
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
        sessionCtx.discourse.advanceTurn(request.text, unknownText, deferral ? 'unknown' : match.id);
        return {
            text: unknownText,
            intent: deferral ? 'unknown' : match.id,
            ...deferredFields,
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
    upsertRecords(records) {
        this.store.upsert(records);
        this.reasoner.rebuildIndex();
    }
    reset(sessionId) {
        if (sessionId) {
            this.sessionContexts.delete(sessionId);
            return;
        }
        this.context.reset();
        this.discourse.reset();
        this.sessionContexts.clear();
    }
}
//# sourceMappingURL=FrameMindEngine.js.map