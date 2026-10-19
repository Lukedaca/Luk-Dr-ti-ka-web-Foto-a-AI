import type { IntentDefinition } from './types.js';
import { normalizeText, stemText } from './text.js';

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
export const DEFAULT_SEMANTIC_MIN_SCORE = 0.88;
export const DEFAULT_SEMANTIC_MIN_MARGIN = 0.04;

export interface SemanticExample {
  intentId: string;
  vector: ArrayLike<number>;
}

function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const length = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < length; i += 1) sum += (a[i] ?? 0) * (b[i] ?? 0);
  return sum;
}

function norm(a: ArrayLike<number>): number {
  return Math.sqrt(dot(a, a));
}

/** Cosine similarity of every intent's closest example to a query vector. */
export class SemanticIntentIndex {
  private readonly examples: { intentId: string; vector: ArrayLike<number>; length: number }[];

  constructor(examples: SemanticExample[]) {
    this.examples = examples
      .filter((example) => example.intentId && example.vector && example.vector.length > 0)
      .map((example) => ({ ...example, length: norm(example.vector) }))
      .filter((example) => example.length > 0);
  }

  get size(): number {
    return this.examples.length;
  }

  rank(query: ArrayLike<number>): SemanticIntentScore[] {
    const queryLength = norm(query);
    if (!queryLength) return [];
    const best = new Map<string, number>();
    for (const example of this.examples) {
      const score = dot(query, example.vector) / (queryLength * example.length);
      if (score > (best.get(example.intentId) ?? -Infinity)) best.set(example.intentId, score);
    }
    return [...best.entries()]
      .map(([intentId, score]) => ({ intentId, score }))
      .sort((a, b) => b.score - a.score);
  }
}

/** Texts the host should embed: intent examples plus approved exact examples. */
export function collectIntentExamples(intents: IntentDefinition[]): { intentId: string; text: string }[] {
  const out: { intentId: string; text: string }[] = [];
  for (const intent of intents) {
    for (const text of [...(intent.examples ?? []), ...(intent.exactExamples ?? [])]) {
      if (typeof text === 'string' && text.trim()) out.push({ intentId: intent.id, text });
    }
  }
  return out;
}

/** Applies thresholds; returns null whenever the decision is not confident. */
export function selectSemanticIntent(
  scores: SemanticIntentScore[],
  knownIntents: Set<string>,
  config: Pick<SemanticIntentConfig, 'minScore' | 'minMargin' | 'excludeIntents'> = {},
): SemanticIntentDecision | null {
  const minScore = config.minScore ?? DEFAULT_SEMANTIC_MIN_SCORE;
  const minMargin = config.minMargin ?? DEFAULT_SEMANTIC_MIN_MARGIN;
  const excluded = new Set(config.excludeIntents ?? []);
  const ranked = (Array.isArray(scores) ? scores : [])
    .filter((item) => item && typeof item.intentId === 'string' && Number.isFinite(item.score))
    .filter((item) => knownIntents.has(item.intentId))
    .sort((a, b) => b.score - a.score);
  const [best, second] = ranked;
  if (!best || excluded.has(best.intentId)) return null;
  const margin = best.score - (second?.score ?? -1);
  if (best.score < minScore || margin < minMargin) return null;
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

function charGrams(text: string, minN: number, maxN: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const word of stemText(normalizeText(text)).split(' ').filter(Boolean)) {
    const padded = ` ${word} `;
    for (let n = minN; n <= maxN; n += 1) {
      for (let i = 0; i + n <= padded.length; i += 1) {
        const gram = padded.slice(i, i + n);
        out.set(gram, (out.get(gram) ?? 0) + 1);
      }
    }
  }
  return out;
}

export function createNgramIntentResolver(
  intents: IntentDefinition[],
  options: { minN?: number; maxN?: number } = {},
): SemanticIntentResolver {
  const minN = options.minN ?? 3;
  const maxN = options.maxN ?? 5;
  const examples = collectIntentExamples(intents);
  const exampleGrams = examples.map((example) => charGrams(example.text, minN, maxN));
  const documentFrequency = new Map<string, number>();
  for (const grams of exampleGrams) {
    for (const gram of grams.keys()) documentFrequency.set(gram, (documentFrequency.get(gram) ?? 0) + 1);
  }
  const idf = (gram: string) => Math.log((1 + examples.length) / (1 + (documentFrequency.get(gram) ?? 0))) + 1;
  const weigh = (grams: Map<string, number>) => {
    const weights = new Map<string, number>();
    let sum = 0;
    for (const [gram, tf] of grams) {
      const weight = (1 + Math.log(tf)) * idf(gram);
      weights.set(gram, weight);
      sum += weight * weight;
    }
    return { weights, length: Math.sqrt(sum) };
  };
  const exampleVectors = exampleGrams.map(weigh);

  return async (text: string) => {
    const query = weigh(charGrams(text, minN, maxN));
    if (!query.length) return [];
    const best = new Map<string, number>();
    exampleVectors.forEach((example, index) => {
      if (!example.length) return;
      let dotProduct = 0;
      for (const [gram, weight] of query.weights) {
        const other = example.weights.get(gram);
        if (other) dotProduct += weight * other;
      }
      const score = dotProduct / (query.length * example.length);
      const intentId = examples[index]!.intentId;
      if (score > (best.get(intentId) ?? -Infinity)) best.set(intentId, score);
    });
    return [...best.entries()].map(([intentId, score]) => ({ intentId, score }));
  };
}

/** Ready-to-use `semanticIntents` config with the built-in n-gram resolver and its thresholds. */
export function ngramSemanticIntents(
  intents: IntentDefinition[],
  options: { excludeIntents?: string[] } = {},
): SemanticIntentConfig {
  return {
    processing: 'local',
    resolver: createNgramIntentResolver(intents),
    minScore: NGRAM_SEMANTIC_MIN_SCORE,
    minMargin: NGRAM_SEMANTIC_MIN_MARGIN,
    ...(options.excludeIntents ? { excludeIntents: options.excludeIntents } : {}),
  };
}
