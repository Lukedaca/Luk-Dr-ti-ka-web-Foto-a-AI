import { FreshnessPolicy, type FreshnessResult } from './FreshnessPolicy.js';
import { KnowledgeStore } from './KnowledgeStore.js';
import type { ContextSnapshot, IntentResponseRule, KnowledgeRecord, SourceReference } from './types.js';
export interface ResolvedSource {
    record?: KnowledgeRecord;
    freshness: FreshnessResult | 'missing';
    reference?: SourceReference;
}
export declare class SourceResolver {
    private readonly store;
    private readonly freshnessPolicy;
    private readonly sourceLabel;
    constructor(store: KnowledgeStore, freshnessPolicy?: FreshnessPolicy, sourceLabel?: string);
    resolve(rule: IntentResponseRule, context: ContextSnapshot, now?: Date, useMissingRecord?: boolean): ResolvedSource;
}
//# sourceMappingURL=SourceResolver.d.ts.map