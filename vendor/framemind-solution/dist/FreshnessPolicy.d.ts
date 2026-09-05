import type { KnowledgeRecord } from './types.js';
export type FreshnessResult = 'fresh' | 'stale' | 'unverified';
export declare class FreshnessPolicy {
    evaluate(record: KnowledgeRecord, now?: Date): FreshnessResult;
    canStateAsFact(record: KnowledgeRecord, now?: Date): boolean;
}
//# sourceMappingURL=FreshnessPolicy.d.ts.map