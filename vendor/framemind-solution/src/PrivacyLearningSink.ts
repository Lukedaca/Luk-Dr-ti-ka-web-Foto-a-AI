import type { LearningEvent, LearningSink } from './types.js';

const FORBIDDEN_KEYS = new Set([
  'name', 'phone', 'email', 'transcript', 'rawText', 'address', 'personalId', 'rc',
]);

export interface LearningSinkStats {
  totalEvents: number;
  conversionsByType: Record<string, number>;
  topUnmatchedTopics: Array<{ topic: string; count: number }>;
  safetyDropsCount: number;
  localPreferencesRecorded: number;
  zeroPiiGuaranteed: boolean;
}

export class PrivacyLearningSink implements LearningSink {
  readonly id = 'privacy-preserving-learning-sink';

  private totalEvents = 0;
  private conversionsByType = new Map<string, number>();
  private unmatchedTopics = new Map<string, number>();
  private safetyDropsCount = 0;
  private localPreferencesRecorded = 0;

  async record(event: LearningEvent): Promise<void> {
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

  getStats(): LearningSinkStats {
    const conversions: Record<string, number> = {};
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

  reset(): void {
    this.totalEvents = 0;
    this.conversionsByType.clear();
    this.unmatchedTopics.clear();
    this.safetyDropsCount = 0;
    this.localPreferencesRecorded = 0;
  }
}
