import type { LearningEvent, LearningSink } from './types.js';
export interface LearningSinkStats {
    totalEvents: number;
    conversionsByType: Record<string, number>;
    topUnmatchedTopics: Array<{
        topic: string;
        count: number;
    }>;
    safetyDropsCount: number;
    localPreferencesRecorded: number;
    zeroPiiGuaranteed: boolean;
}
export declare class PrivacyLearningSink implements LearningSink {
    readonly id = "privacy-preserving-learning-sink";
    private totalEvents;
    private conversionsByType;
    private unmatchedTopics;
    private safetyDropsCount;
    private localPreferencesRecorded;
    record(event: LearningEvent): Promise<void>;
    getStats(): LearningSinkStats;
    reset(): void;
}
//# sourceMappingURL=PrivacyLearningSink.d.ts.map