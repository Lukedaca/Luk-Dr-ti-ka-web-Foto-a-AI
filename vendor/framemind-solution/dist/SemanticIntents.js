import { expandCzechSynonyms, normalizeText, stemText } from './text.js';
/**
 * Defaults measured on 11 Oct 2026 for EmbeddingGemma 2 (q8) with the
 * `task: sentence similarity | query: ` prefix on Czech parent/fan questions:
 * margin 0.04 kept wrong picks and false answers on out-of-scope questions at zero
 * across scores 0.80–0.92. Other models or prompts must be re-measured.
 */
export const DEFAULT_SEMANTIC_MIN_SCORE = 0.88;
export const DEFAULT_SEMANTIC_MIN_MARGIN = 0.04;
function dot(a, b) {
    var _a, _b;
    const length = Math.min(a.length, b.length);
    let sum = 0;
    for (let i = 0; i < length; i += 1)
        sum += ((_a = a[i]) !== null && _a !== void 0 ? _a : 0) * ((_b = b[i]) !== null && _b !== void 0 ? _b : 0);
    return sum;
}
function norm(a) {
    return Math.sqrt(dot(a, a));
}
/** Cosine similarity of every intent's closest example to a query vector. */
export class SemanticIntentIndex {
    constructor(examples) {
        this.examples = examples
            .filter((example) => example.intentId && example.vector && example.vector.length > 0)
            .map((example) => ({ ...example, length: norm(example.vector) }))
            .filter((example) => example.length > 0);
    }
    get size() {
        return this.examples.length;
    }
    rank(query) {
        var _a;
        const queryLength = norm(query);
        if (!queryLength)
            return [];
        const best = new Map();
        for (const example of this.examples) {
            const score = dot(query, example.vector) / (queryLength * example.length);
            if (score > ((_a = best.get(example.intentId)) !== null && _a !== void 0 ? _a : -Infinity))
                best.set(example.intentId, score);
        }
        return [...best.entries()]
            .map(([intentId, score]) => ({ intentId, score }))
            .sort((a, b) => b.score - a.score);
    }
}
/** Texts the host should embed: intent examples plus approved exact examples. */
export function collectIntentExamples(intents) {
    var _a, _b;
    const out = [];
    for (const intent of intents) {
        for (const text of [...((_a = intent.examples) !== null && _a !== void 0 ? _a : []), ...((_b = intent.exactExamples) !== null && _b !== void 0 ? _b : [])]) {
            if (typeof text === 'string' && text.trim())
                out.push({ intentId: intent.id, text });
        }
    }
    return out;
}
/** Applies thresholds; returns null whenever the decision is not confident. */
export function selectSemanticIntent(scores, knownIntents, config = {}) {
    var _a, _b, _c, _d;
    const minScore = (_a = config.minScore) !== null && _a !== void 0 ? _a : DEFAULT_SEMANTIC_MIN_SCORE;
    const minMargin = (_b = config.minMargin) !== null && _b !== void 0 ? _b : DEFAULT_SEMANTIC_MIN_MARGIN;
    const excluded = new Set((_c = config.excludeIntents) !== null && _c !== void 0 ? _c : []);
    const ranked = (Array.isArray(scores) ? scores : [])
        .filter((item) => item && typeof item.intentId === 'string' && Number.isFinite(item.score))
        .filter((item) => knownIntents.has(item.intentId))
        .sort((a, b) => b.score - a.score);
    const [best, second] = ranked;
    if (!best || excluded.has(best.intentId))
        return null;
    const margin = best.score - ((_d = second === null || second === void 0 ? void 0 : second.score) !== null && _d !== void 0 ? _d : -1);
    if (best.score < minScore || margin < minMargin)
        return null;
    return { intentId: best.intentId, score: best.score, margin };
}
/**
 * Built-in model-free resolver (1.7.0): TF-IDF over character n-grams (3–5) of the
 * core's normalized and stemmed text. Catches paraphrases that share word stems with
 * the examples ("Do kdy se platí členské?" ~ "Kolik stojí členské příspěvky?") and
 * tolerates Czech endings and small typos. Runs in-process (browser or server) in
 * microseconds; no model download, no network.
 *
 * Measured 11 Oct 2026 on Viktorka's configuration (182 examples): tuning set
 * 29 → 45 correct with +1 ambiguous pick ("Kolik se platí za fotbal?" → admission),
 * independent holdout 23 → 29 correct with no new errors; no answers on
 * out-of-scope messages in either set. Thresholds: NGRAM_SEMANTIC_MIN_SCORE/MARGIN.
 */
export const NGRAM_SEMANTIC_MIN_SCORE = 0.35;
export const NGRAM_SEMANTIC_MIN_MARGIN = 0.15;
function charGrams(text, minN, maxN) {
    var _a;
    const out = new Map();
    for (const word of stemText(normalizeText(text)).split(' ').filter(Boolean)) {
        const padded = ` ${word} `;
        for (let n = minN; n <= maxN; n += 1) {
            for (let i = 0; i + n <= padded.length; i += 1) {
                const gram = padded.slice(i, i + n);
                out.set(gram, ((_a = out.get(gram)) !== null && _a !== void 0 ? _a : 0) + 1);
            }
        }
    }
    return out;
}
export function createNgramIntentResolver(intents, options = {}) {
    var _a, _b, _c;
    const minN = (_a = options.minN) !== null && _a !== void 0 ? _a : 3;
    const maxN = (_b = options.maxN) !== null && _b !== void 0 ? _b : 5;
    const examples = collectIntentExamples(intents);
    const exampleGrams = examples.map((example) => charGrams(example.text, minN, maxN));
    const documentFrequency = new Map();
    for (const grams of exampleGrams) {
        for (const gram of grams.keys())
            documentFrequency.set(gram, ((_c = documentFrequency.get(gram)) !== null && _c !== void 0 ? _c : 0) + 1);
    }
    const idf = (gram) => { var _a; return Math.log((1 + examples.length) / (1 + ((_a = documentFrequency.get(gram)) !== null && _a !== void 0 ? _a : 0))) + 1; };
    const weigh = (grams) => {
        const weights = new Map();
        let sum = 0;
        for (const [gram, tf] of grams) {
            const weight = (1 + Math.log(tf)) * idf(gram);
            weights.set(gram, weight);
            sum += weight * weight;
        }
        return { weights, length: Math.sqrt(sum) };
    };
    const exampleVectors = exampleGrams.map(weigh);
    const scoreGrams = (rawText) => {
        const query = weigh(charGrams(rawText, minN, maxN));
        if (!query.length)
            return [];
        const best = new Map();
        exampleVectors.forEach((example, index) => {
            var _a;
            if (!example.length)
                return;
            let dotProduct = 0;
            for (const [gram, weight] of query.weights) {
                const other = example.weights.get(gram);
                if (other)
                    dotProduct += weight * other;
            }
            const score = dotProduct / (query.length * example.length);
            const intentId = examples[index].intentId;
            if (score > ((_a = best.get(intentId)) !== null && _a !== void 0 ? _a : -Infinity))
                best.set(intentId, score);
        });
        return [...best.entries()].map(([intentId, score]) => ({ intentId, score }));
    };
    return async (text) => {
        const primary = scoreGrams(text);
        const topPrimary = primary.reduce((max, item) => (item.score > max ? item.score : max), -Infinity);
        if (topPrimary >= NGRAM_SEMANTIC_MIN_SCORE)
            return primary;
        const expanded = expandCzechSynonyms(normalizeText(text));
        if (expanded !== normalizeText(text)) {
            const secondary = scoreGrams(expanded);
            const topSecondary = secondary.reduce((max, item) => (item.score > max ? item.score : max), -Infinity);
            if (topSecondary > topPrimary)
                return secondary;
        }
        return primary;
    };
}
/** Ready-to-use `semanticIntents` config with the built-in n-gram resolver and its thresholds. */
export function ngramSemanticIntents(intents, options = {}) {
    return {
        processing: 'local',
        resolver: createNgramIntentResolver(intents),
        minScore: NGRAM_SEMANTIC_MIN_SCORE,
        minMargin: NGRAM_SEMANTIC_MIN_MARGIN,
        ...(options.excludeIntents ? { excludeIntents: options.excludeIntents } : {}),
    };
}
//# sourceMappingURL=SemanticIntents.js.map