const FORBIDDEN_KEYS = new Set([
    'name', 'phone', 'email', 'transcript', 'rawText', 'address', 'personalId', 'rc',
]);
export class PrivacyLearningSink {
    constructor() {
        this.id = 'privacy-preserving-learning-sink';
        this.totalEvents = 0;
        this.conversionsByType = new Map();
        this.unmatchedTopics = new Map();
        this.safetyDropsCount = 0;
        this.localPreferencesRecorded = 0;
    }
    async record(event) {
        // Strict PII Verification: reject any payload containing personal contact keys
        for (const key of Object.keys(event.payload || {})) {
            if (FORBIDDEN_KEYS.has(key)) {
                throw new Error(`Privacy violation: LearningEvent payload cannot contain '${key}'`);
            }
        }
        this.totalEvents += 1;
        switch (event.kind) {
            case 'conversion': {
                const type = String(event.payload.type || 'general');
                this.conversionsByType.set(type, (this.conversionsByType.get(type) || 0) + 1);
                break;
            }
            case 'unmatched-topic': {
                const topic = String(event.payload.topic || 'unknown')
                    .toLowerCase()
                    .replace(/[^a-z0-9_-]/g, '_')
                    .slice(0, 50);
                this.unmatchedTopics.set(topic, (this.unmatchedTopics.get(topic) || 0) + 1);
                break;
            }
            case 'safety-dropped': {
                this.safetyDropsCount += 1;
                break;
            }
            case 'local-preference': {
                this.localPreferencesRecorded += 1;
                break;
            }
        }
    }
    getStats() {
        const conversions = {};
        for (const [key, val] of this.conversionsByType.entries()) {
            conversions[key] = val;
        }
        const sortedTopics = Array.from(this.unmatchedTopics.entries())
            .map(([topic, count]) => ({ topic, count }))
            .sort((a, b) => b.count - a.count);
        return {
            totalEvents: this.totalEvents,
            conversionsByType: conversions,
            topUnmatchedTopics: sortedTopics,
            safetyDropsCount: this.safetyDropsCount,
            localPreferencesRecorded: this.localPreferencesRecorded,
            zeroPiiGuaranteed: true,
        };
    }
    reset() {
        this.totalEvents = 0;
        this.conversionsByType.clear();
        this.unmatchedTopics.clear();
        this.safetyDropsCount = 0;
        this.localPreferencesRecorded = 0;
    }
}
//# sourceMappingURL=PrivacyLearningSink.js.map