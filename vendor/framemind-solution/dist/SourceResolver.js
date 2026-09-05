import { FreshnessPolicy } from './FreshnessPolicy.js';
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
        else if (rule.recordId)
            record = this.store.get(rule.recordId);
        else if (rule.selectBy) {
            const value = context.slots[rule.selectBy.slot];
            if (value !== undefined)
                record = this.store.findByData(rule.selectBy.dataField, value, rule.selectBy.recordType);
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