export class FreshnessPolicy {
    evaluate(record, now = new Date()) {
        if (!record.lastVerifiedAt || Number.isNaN(Date.parse(record.lastVerifiedAt)))
            return 'unverified';
        if (record.expiresAt) {
            const expires = Date.parse(record.expiresAt);
            if (Number.isNaN(expires))
                return 'unverified';
            if (now.getTime() > expires)
                return 'stale';
        }
        return 'fresh';
    }
    canStateAsFact(record, now = new Date()) {
        return this.evaluate(record, now) === 'fresh';
    }
}
//# sourceMappingURL=FreshnessPolicy.js.map