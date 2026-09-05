import { FreshnessPolicy, type FreshnessResult } from './FreshnessPolicy.js';
import { KnowledgeStore } from './KnowledgeStore.js';
import type { ContextSnapshot, IntentResponseRule, KnowledgeRecord, SourceReference } from './types.js';

export interface ResolvedSource {
  record?: KnowledgeRecord;
  freshness: FreshnessResult | 'missing';
  reference?: SourceReference;
}

export class SourceResolver {
  constructor(
    private readonly store: KnowledgeStore,
    private readonly freshnessPolicy = new FreshnessPolicy(),
    private readonly sourceLabel = 'Ověřený zdroj',
  ) {}

  resolve(rule: IntentResponseRule, context: ContextSnapshot, now = new Date(), useMissingRecord = false): ResolvedSource {
    let record: KnowledgeRecord | undefined;
    if (useMissingRecord && rule.missingRecordId) record = this.store.get(rule.missingRecordId);
    else if (rule.recordId) record = this.store.get(rule.recordId);
    else if (rule.selectBy) {
      const value = context.slots[rule.selectBy.slot];
      if (value !== undefined) record = this.store.findByData(rule.selectBy.dataField, value, rule.selectBy.recordType);
    }
    if (!record) return { freshness: 'missing' };
    return {
      record,
      freshness: this.freshnessPolicy.evaluate(record, now),
      reference: {
        id: record.id,
        label: this.sourceLabel,
        url: record.sourceUrl,
        lastVerifiedAt: record.lastVerifiedAt,
      },
    };
  }
}
