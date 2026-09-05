import type { KnowledgeRecord } from './types.js';

export type FreshnessResult = 'fresh' | 'stale' | 'unverified';

export class FreshnessPolicy {
  evaluate(record: KnowledgeRecord, now = new Date()): FreshnessResult {
    if (!record.lastVerifiedAt || Number.isNaN(Date.parse(record.lastVerifiedAt))) return 'unverified';
    if (record.expiresAt) {
      const expires = Date.parse(record.expiresAt);
      if (Number.isNaN(expires)) return 'unverified';
      if (now.getTime() > expires) return 'stale';
    }
    return 'fresh';
  }

  canStateAsFact(record: KnowledgeRecord, now = new Date()): boolean {
    return this.evaluate(record, now) === 'fresh';
  }
}
