import { FreshnessPolicy } from './FreshnessPolicy.js';
import { selectMentioned } from './MentionedRecords.js';
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
    resolve(rule, context, now = new Date(), useMissingRecord = false, text = '') {
        let record;
        let template;
        if (useMissingRecord && rule.missingRecordId)
            record = this.store.get(rule.missingRecordId);
        else {
            const selectors = selectorsOf(rule);
            const defaultRecord = rule.recordId ? this.store.get(rule.recordId) : undefined;
            // A value the visitor names outranks slots and the default; once named, nothing else
            // may answer in its place ("se Slavonínem" must not get the match with Bystřice).
            const mention = selectMentioned(text, selectors, this.store.all(), context.slots, defaultRecord, (candidate) => this.freshnessPolicy.evaluate(candidate, now) === 'fresh');
            if (mention.kind === 'unresolved')
                return { freshness: 'missing' };
            if (mention.kind === 'record') {
                record = mention.record;
                template = mention.selector.template;
            }
            else {
                // First selector whose slot the context holds decides; without such a slot the rule's
                // recordId is the default. A present slot without a matching record is not replaced
                // by the default — that would answer a different product than the visitor asked about.
                const selector = selectors.find((item) => !item.mentioned && item.slot && context.slots[item.slot] !== undefined);
                if (selector) {
                    record = this.store.findByData(selector.dataField, context.slots[selector.slot], selector.recordType);
                    template = selector.template;
                }
                else
                    record = defaultRecord;
            }
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
            ...(template ? { template } : {}),
        };
    }
}
//# sourceMappingURL=SourceResolver.js.map