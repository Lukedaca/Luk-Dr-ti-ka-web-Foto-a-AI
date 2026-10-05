import { FreshnessPolicy, type FreshnessResult } from './FreshnessPolicy.js';
import { KnowledgeStore } from './KnowledgeStore.js';
import type { ContextSnapshot, IntentResponseRule, KnowledgeRecord, SelectBy, SourceReference } from './types.js';

export function selectorsOf(rule: IntentResponseRule): SelectBy[] {
  if (!rule.selectBy) return [];
  return Array.isArray(rule.selectBy) ? rule.selectBy : [rule.selectBy];
}

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
    else {
      // First selector whose slot the context holds decides; without such a slot the rule's
      // recordId is the default. A present slot without a matching record is not replaced
      // by the default — that would answer a different product than the visitor asked about.
      const selector = selectorsOf(rule).find((item) => context.slots[item.slot] !== undefined);
      if (selector) record = this.store.findByData(selector.dataField, context.slots[selector.slot]!, selector.recordType);
      else if (rule.recordId) record = this.store.get(rule.recordId);
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
