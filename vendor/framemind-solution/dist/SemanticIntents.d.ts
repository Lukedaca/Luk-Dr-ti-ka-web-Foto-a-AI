import type { IntentDefinition } from './types.js';
/**
 * Semantic intent decision layer (opt-in, FrameMind Solution 1.6.0).
 *
 * The lexical IntentEngine stays the primary detector. When it returns `unknown`,
 * a host-supplied resolver (e.g. a local embedding model) may pick one of the
 * EXISTING intents. The answer is still composed by the intent's own response rule
 * from verified knowledge; the semantic layer never generates text. If it is not
 * confident, the request continues exactly as before (managed provider fallback).
 *
 * The core has no model dependency: the host embeds text, the core ranks and decides.
 */
export interface SemanticIntentScore {
    intentId: string;
    /** Similarity in [-1, 1], typically cosine of normalized embeddings. */
    score: number;
}
/** Host-supplied: per-intent best similarity for a message, any order. */
export type SemanticIntentResolver = (text: string) => Promise<SemanticIntentScore[]>;
export interface SemanticIntentConfig {
    /**
     * The resolver receives raw visitor text and bypasses DataPolicy egress checks,
     * so it must run inside the deployment (local model). Hosts declare it explicitly;
     * anything else is ignored.
     */
    processing: 'local';
    resolver: SemanticIntentResolver;
    /** Minimum similarity of the best intent. Model- and prompt-specific. */
    minScore?: number;
    /** Minimum gap between the best and the second-best intent. */
    minMargin?: number;
    /** Intents the semantic layer must never pick (e.g. contact capture). */
    excludeIntents?: string[];
}
export interface SemanticIntentDecision {
    intentId: string;
    score: number;
    margin: number;
}
/**
 * Defaults measured on 11 Oct 2026 for EmbeddingGemma 2 (q8) with the
 * `task: sentence similarity | query: ` prefix on Czech parent/fan questions:
 * margin 0.04 kept wrong picks and false answers on out-of-scope questions at zero
 * across scores 0.80–0.92. Other models or prompts must be re-measured.
 */
export declare const DEFAULT_SEMANTIC_MIN_SCORE = 0.88;
export declare const DEFAULT_SEMANTIC_MIN_MARGIN = 0.04;
export interface SemanticExample {
    intentId: string;
    vector: ArrayLike<number>;
}
/** Cosine similarity of every intent's closest example to a query vector. */
export declare class SemanticIntentIndex {
    private readonly examples;
    constructor(examples: SemanticExample[]);
    get size(): number;
    rank(query: ArrayLike<number>): SemanticIntentScore[];
}
/** Texts the host should embed: intent examples plus approved exact examples. */
export declare function collectIntentExamples(intents: IntentDefinition[]): {
    intentId: string;
    text: string;
}[];
/** Applies thresholds; returns null whenever the decision is not confident. */
export declare function selectSemanticIntent(scores: SemanticIntentScore[], knownIntents: Set<string>, config?: Pick<SemanticIntentConfig, 'minScore' | 'minMargin' | 'excludeIntents'>): SemanticIntentDecision | null;
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
export declare const NGRAM_SEMANTIC_MIN_SCORE = 0.35;
export declare const NGRAM_SEMANTIC_MIN_MARGIN = 0.15;
export declare function createNgramIntentResolver(intents: IntentDefinition[], options?: {
    minN?: number;
    maxN?: number;
}): SemanticIntentResolver;
/** Ready-to-use `semanticIntents` config with the built-in n-gram resolver and its thresholds. */
export declare function ngramSemanticIntents(intents: IntentDefinition[], options?: {
    excludeIntents?: string[];
}): SemanticIntentConfig;
//# sourceMappingURL=SemanticIntents.d.ts.map