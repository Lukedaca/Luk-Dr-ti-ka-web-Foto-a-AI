import { FreshnessPolicy } from './FreshnessPolicy.js';
import { KnowledgeStore } from './KnowledgeStore.js';
import type { ContextSnapshot, DiscourseSnapshot, FrameMindConfig, IntentResponseRule, KnowledgeRecord, ResponseFacet, SlotValue } from './types.js';
export type QueryFocus = 'cost' | 'time' | 'location' | 'contact' | 'age' | 'comparison' | 'process';
export interface PriceTierFact {
    label: string;
    amountKc: number;
    sentence: string;
}
export interface FactSignature {
    hasCurrency: boolean;
    hasSchedule: boolean;
    hasLocation: boolean;
    hasContact: boolean;
    hasAgeOrYear: boolean;
    hasComparison: boolean;
    tiers: PriceTierFact[];
}
export interface DeductiveIntentMatch {
    intentId: string;
    confidence: number;
    recordId?: string | undefined;
    facet?: ResponseFacet | undefined;
    isFollowUp: boolean;
    inferredSlots: Record<string, SlotValue>;
}
export declare function extractPriceTiers(text: string): PriceTierFact[];
export declare function analyzeFactSignature(text: string, data?: Record<string, unknown>): FactSignature;
export declare function detectQueryFocuses(text: string): Set<QueryFocus>;
/**
 * Local Deductive Knowledge Reasoner (FrameMind Solution 2.5.0).
 *
 * Self-indexes the verified KnowledgeStore and IntentResponseRules so the agent can:
 * 1. Deduce intents, records, slots, and facets directly from grounded facts without
 *    relying on manually programmed keyword lists.
 * 2. Resolve 1-edit typos against the entire corpus vocabulary of the tenant.
 * 3. Extract targeted follow-up sentences and evaluate numeric/budget constraints
 *    strictly from fresh, verified records without ever fabricating facts.
 */
export declare class KnowledgeReasoner {
    private readonly config;
    private readonly store;
    private readonly freshnessPolicy;
    private docs;
    private stemIdf;
    private gramIdf;
    private corpusVocabulary;
    constructor(config: FrameMindConfig, store: KnowledgeStore, freshnessPolicy?: FreshnessPolicy);
    /** Rebuilds the deductive index after live records are upserted into KnowledgeStore. */
    rebuildIndex(): void;
    private collectRuleRecords;
    /** Resolves query stems, including 1-edit typo correction against the grounded corpus vocabulary. */
    private resolveQueryStems;
    /**
     * Infers slot values directly from KnowledgeStore record `data` fields referenced by `selectBy`
     * when no explicit `slotPatterns` matched.
     */
    deduceSlots(queryText: string, currentSlots: Record<string, SlotValue>): Record<string, SlotValue>;
    /**
     * Deductively resolves the intent and optional facet from the KnowledgeStore and
     * active dialogue state when lexical/exact matching returned `unknown`.
     */
    deduceIntent(queryText: string, context: ContextSnapshot, discourse?: DiscourseSnapshot, now?: Date): DeductiveIntentMatch | null;
    /**
     * Deductively selects a ResponseFacet from `rule.facets` by analyzing the factual content
     * of each facet template, or synthesizes a single-sentence facet from `record.content`
     * when answering a targeted follow-up on a record already seen in the session.
     */
    deduceFacet(rule: IntentResponseRule | undefined, record: KnowledgeRecord | undefined, queryText: string, recordAlreadySeen?: boolean): ResponseFacet | undefined;
    /**
     * Returns grounded content phrases from the verified KnowledgeStore records linked to `intentId`,
     * used by AnswerGate when the intent has configured lexical definitions so visitors can ask about
     * any fact inside the verified record without pre-programmed facet keywords.
     */
    getRuleRecordTerms(intentId: string, now?: Date): string[];
    /**
     * Evaluates numeric budget constraints (`context.slots.budgetKc`) against grounded price
     * tiers inside the composed response or record content, returning a verified conclusion.
     */
    deduceBudgetConclusion(composedText: string, record: KnowledgeRecord | undefined, budgetKc: unknown): string | undefined;
}
//# sourceMappingURL=KnowledgeReasoner.d.ts.map