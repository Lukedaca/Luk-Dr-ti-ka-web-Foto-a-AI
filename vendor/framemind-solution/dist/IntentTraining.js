import { ngramSemanticIntents } from './SemanticIntents.js';
import { normalizeText } from './text.js';
const DEFAULT_EXCLUDED_SEMANTIC_INTENTS = ['greeting', 'thanks', 'contact_capture', 'recruitment_contact'];
/** Apply owner-reviewed routing corrections without changing facts or permissions. */
export function withIntentTraining(config, raw, tenantId, options) {
    var _a, _b;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw new Error('Intent training must be an object');
    const pack = raw;
    if (pack.schemaVersion !== 1)
        throw new Error('Unsupported intent training schema');
    if (!tenantId || pack.tenantId !== tenantId)
        throw new Error('Intent training tenant mismatch');
    if (!Number.isSafeInteger(pack.revision) || Number(pack.revision) < 1)
        throw new Error('Invalid intent training revision');
    if (!Array.isArray(pack.examples) || pack.examples.length > 1000)
        throw new Error('Invalid intent training examples');
    const intents = config.intents.map(intent => { var _a; return ({ ...intent, exactExamples: [...((_a = intent.exactExamples) !== null && _a !== void 0 ? _a : [])] }); });
    const byId = new Map(intents.map(intent => [intent.id, intent]));
    const owners = new Map();
    for (const intent of intents) {
        for (const text of intent.exactExamples) {
            const normalized = normalizeText(text);
            if (owners.has(normalized) && owners.get(normalized) !== intent.id)
                throw new Error('Conflicting existing intent training');
            owners.set(normalized, intent.id);
        }
    }
    for (const entry of pack.examples) {
        if (!entry || typeof entry.text !== 'string' || typeof entry.intentId !== 'string')
            throw new Error('Invalid intent training entry');
        const text = normalizeText(entry.text);
        if (!text || entry.text.length > 2000)
            throw new Error('Intent training text must contain 1-2000 characters');
        const target = byId.get(entry.intentId);
        if (!target || !config.responses.some(rule => rule.intentId === target.id))
            throw new Error(`Unknown training target: ${entry.intentId}`);
        if (owners.has(text) && owners.get(text) !== target.id)
            throw new Error(`Conflicting intent training targets: ${owners.get(text)} / ${target.id}`);
        if (!owners.has(text))
            target.exactExamples.push(entry.text);
        owners.set(text, target.id);
    }
    const semanticIntents = (_a = config.semanticIntents) !== null && _a !== void 0 ? _a : ((options === null || options === void 0 ? void 0 : options.semanticIntents) === false
        ? undefined
        : ngramSemanticIntents(intents, { excludeIntents: [...((_b = options === null || options === void 0 ? void 0 : options.excludeIntents) !== null && _b !== void 0 ? _b : DEFAULT_EXCLUDED_SEMANTIC_INTENTS)] }));
    return { ...config, intents, ...(semanticIntents ? { semanticIntents } : {}) };
}
//# sourceMappingURL=IntentTraining.js.map