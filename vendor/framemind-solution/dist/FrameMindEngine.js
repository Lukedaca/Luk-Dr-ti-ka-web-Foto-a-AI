import { ActionResolver } from './ActionResolver.js';
import { ConversationContext } from './ConversationContext.js';
import { IntentEngine } from './IntentEngine.js';
import { KnowledgeStore } from './KnowledgeStore.js';
import { NoopLearningSink } from './NoopLearningSink.js';
import { PrivacyGuard } from './PrivacyGuard.js';
import { ProviderRouter } from './ProviderRouter.js';
import { ResponseComposer } from './ResponseComposer.js';
import { SourceResolver } from './SourceResolver.js';
import { SafetyShield } from './SafetyShield.js';
function hasAnySlot(rule, slots) {
    var _a;
    if (!((_a = rule.requiredAnySlots) === null || _a === void 0 ? void 0 : _a.length))
        return true;
    return rule.requiredAnySlots.some((key) => slots[key] !== undefined && slots[key] !== '');
}
export class FrameMindEngine {
    constructor(config, snapshot) {
        var _a, _b, _c;
        this.config = config;
        this.context = new ConversationContext();
        this.sessionContexts = new Map();
        this.composer = new ResponseComposer();
        this.privacyGuard = new PrivacyGuard(config.mode);
        this.intentEngine = new IntentEngine(config.intents);
        const store = new KnowledgeStore(snapshot);
        this.sourceResolver = new SourceResolver(store, undefined, (_a = config.sourceLabel) !== null && _a !== void 0 ? _a : 'Ověřený zdroj');
        this.actionResolver = new ActionResolver(config.actions, this.privacyGuard);
        const adapter = ((_b = config.provider) === null || _b === void 0 ? void 0 : _b.enabled) ? config.provider.adapter : undefined;
        this.providerRouter = new ProviderRouter(adapter, this.privacyGuard);
        this.learningSink = (_c = config.learningSink) !== null && _c !== void 0 ? _c : new NoopLearningSink();
    }
    requestContext(sessionId) {
        var _a, _b;
        const settings = this.config.sessions;
        if (!sessionId) {
            if (settings === null || settings === void 0 ? void 0 : settings.requireSessionId)
                throw new Error('sessionId is required by session isolation policy');
            return this.context;
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
            return existing.context;
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
        const context = new ConversationContext();
        this.sessionContexts.set(sessionId, { context, touchedAt: now });
        return context;
    }
    async respond(request) {
        var _a, _b;
        const sessionContext = this.requestContext(request.sessionId);
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
                context: sessionContext.snapshot(),
                reason: 'known',
            };
        }
        const before = sessionContext.snapshot();
        const match = this.intentEngine.detect(request.text, before, request.now);
        const context = sessionContext.apply(match);
        const rule = this.config.responses.find((candidate) => candidate.intentId === match.id);
        if ((rule === null || rule === void 0 ? void 0 : rule.sourceRequired) === false) {
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
                const text = this.composer.compose((_a = rule.staleTemplate) !== null && _a !== void 0 ? _a : this.config.staleResponse, resolved.record, context);
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
        if (this.config.mode === 'managed'
            && ((_b = this.config.provider) === null || _b === void 0 ? void 0 : _b.enabled)
            && request.allowManagedProvider === true
            && typeof request.providerText === 'string') {
            const provider = await this.providerRouter.generate(request.providerText, this.config.locale, context, true, this.config.provider.allowedContextSlots, this.config.provider.maxInputChars);
            if (provider === null || provider === void 0 ? void 0 : provider.text) {
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
    reset(sessionId) {
        if (sessionId) {
            this.sessionContexts.delete(sessionId);
            return;
        }
        this.context.reset();
        this.sessionContexts.clear();
    }
}
//# sourceMappingURL=FrameMindEngine.js.map