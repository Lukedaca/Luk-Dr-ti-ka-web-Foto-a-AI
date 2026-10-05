import { FreshnessPolicy } from './FreshnessPolicy.js';
export function selectorsOf(rule) {
    if (!rule.selectBy)
        return [];
    return Array.isArray(rule.selectBy) ? rule.selectBy : [rule.selectBy];
}
export class SourceResolver {
    constructor(store, freshnessPolicy = new FreshnessPolicy(), sourceLabel = 'Ověřený zdroj') {
        this.store = store;
        this.freshnessPolicy = freshnessPolicy;
        this.sourceLabel = sourceLabel;
    }
    resolve(rule, context, now = new Date(), useMissingRecord = false) {
        let record;
        if (useMissingRecord && rule.missingRecordId)
            record = this.store.get(rule.missingRecordId);
        else {
            // First selector whose slot the context holds decides; without such a slot the rule's
            // recordId is the default. A present slot without a matching record is not replaced
            // by the default — that would answer a different product than the visitor asked about.
            const selector = selectorsOf(rule).find((item) => context.slots[item.slot] !== undefined);
            if (selector)
                record = this.store.findByData(selector.dataField, context.slots[selector.slot], selector.recordType);
            else if (rule.recordId)
                record = this.store.get(rule.recordId);
        }
        if (!record)
            return { freshness: 'missing' };
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
//# sourceMappingURL=SourceResolver.js.map