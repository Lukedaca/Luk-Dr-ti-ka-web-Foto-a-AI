import type { AgentProfile } from './AgentProfile.js';
import type {
  DiscourseClarification,
  DiscourseEntity,
  DiscourseSnapshot,
} from './types.js';

export interface DiscourseContextOptions {
  maxRecentEntities?: number;
}

const ANAPHORA_PRONOUNS_CS = new Set([
  'on', 'ona', 'ono', 'oni', 'ony',
  'to', 'ten', 'ta', 'ty', 'ti', 'toto', 'tento', 'tato',
  'jeho', 'jeji', 'jejich', 'jim', 'mu', 'ji', 'ho',
  'tam', 'tady', 'sem', 'odtud',
]);

const REPAIR_PREFIXES_CS = [
  /^ne\b[\s,]+/i,
  /^vlastne\b[\s,]+/i,
  /^myslel\s+(?:jsem|sme)\b/i,
  /^myslela\s+jsem\b/i,
  /^myslim\b/i,
  /^pardon\b[\s,]+/i,
  /^promin\b[\s,]+/i,
  /^oprava\b[\s,:]+/i,
];

function normalizeCzech(text: string): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export class DiscourseContext {
  private turn = 0;
  private activeEntity: DiscourseEntity | null = null;
  private recentEntities: DiscourseEntity[] = [];
  private lastIntent: string | null = null;
  private lastQuery = '';
  private lastReply = '';
  private awaitingClarification: DiscourseClarification | null = null;
  private readonly maxRecent: number;

  constructor(options: DiscourseContextOptions = {}) {
    this.maxRecent = options.maxRecentEntities ?? 8;
  }

  setEntity(type: string, name: string, data: Record<string, unknown> = {}): DiscourseEntity {
    const entity: DiscourseEntity = {
      type: String(type || '').trim(),
      name: String(name || '').trim(),
      data: { ...data },
      turn: this.turn,
      timestamp: Date.now(),
    };
    this.activeEntity = entity;
    this.recentEntities = [
      entity,
      ...this.recentEntities.filter(
        (e) => !(e.type === entity.type && e.name.toLowerCase() === entity.name.toLowerCase()),
      ),
    ].slice(0, this.maxRecent);
    return entity;
  }

  getEntity(type?: string): DiscourseEntity | null {
    if (this.activeEntity && (!type || this.activeEntity.type === type)) {
      return this.activeEntity;
    }
    if (type) {
      return this.recentEntities.find((e) => e.type === type) || null;
    }
    return this.activeEntity;
  }

  clearEntity(): void {
    this.activeEntity = null;
  }

  setAwaitingClarification(clarification: DiscourseClarification): void {
    this.awaitingClarification = clarification;
  }

  clearAwaitingClarification(): void {
    this.awaitingClarification = null;
  }

  getAwaitingClarification(): DiscourseClarification | null {
    return this.awaitingClarification;
  }

  advanceTurn(query = '', reply = '', intent?: string): void {
    this.turn += 1;
    this.lastQuery = query;
    this.lastReply = reply;
    if (intent) this.lastIntent = intent;
  }

  isAnaphoraQuery(query: string): boolean {
    const clean = normalizeCzech(query);
    if (!clean) return false;

    // Short follow-up queries like "A cena?", "A kde?", "Kolik?"
    if (/^a\s+(?:cena|kolik|kde|kdy|jak|proc|kdo|rozpis|trener|vstupne|termin|adresa)\b/i.test(clean)) {
      return true;
    }
    if (/^(?:kolik|kde|kdy|jak)(?:\s+(?:vlastne|ted|pak|zase))?\s+(?:to|stoji|je|hraji|maji|sidli)\b/i.test(clean)) {
      return true;
    }

    const words = clean.split(/\s+/);
    return words.some((w) => ANAPHORA_PRONOUNS_CS.has(w));
  }

  isRepairQuery(query: string): boolean {
    const clean = normalizeCzech(query);
    return REPAIR_PREFIXES_CS.some((regex) => regex.test(clean));
  }

  extractRepairSubject(query: string): string | null {
    const clean = normalizeCzech(query);
    for (const regex of REPAIR_PREFIXES_CS) {
      if (regex.test(clean)) {
        const remaining = clean
          .replace(regex, '')
          .replace(/^(?:(?:jsem|sme)\s+)?(?:myslel|chtel|chtela|myslela|myslim)(?:\s+(?:jsem|sme))?\b[\s,:]*/i, '')
          .trim();
        return remaining || null;
      }
    }
    return null;
  }

  resolveSuggestions(
    intentId: string,
    profile?: AgentProfile,
  ): string[] {
    if (!profile) return [];

    // 1. Check if active entity has custom follow-ups
    if (this.activeEntity && profile.entities?.length) {
      const matchedEntity = profile.entities.find(
        (e) => e.type === this.activeEntity?.type && e.name.toLowerCase() === this.activeEntity?.name.toLowerCase(),
      );
      if (matchedEntity?.suggestedFollowUps?.length) {
        return matchedEntity.suggestedFollowUps.slice(0, 4);
      }
    }

    // 2. Check profile suggestedFollowUps by intentId
    if (profile.suggestedFollowUps && profile.suggestedFollowUps[intentId]?.length) {
      return profile.suggestedFollowUps[intentId].slice(0, 4);
    }

    return [];
  }

  snapshot(): DiscourseSnapshot {
    return {
      turn: this.turn,
      activeEntity: this.activeEntity ? { ...this.activeEntity } : null,
      recentEntities: this.recentEntities.map((e) => ({ ...e })),
      lastIntent: this.lastIntent,
      lastQuery: this.lastQuery,
      lastReply: this.lastReply,
      awaitingClarification: this.awaitingClarification ? { ...this.awaitingClarification } : null,
    };
  }

  reset(): void {
    this.turn = 0;
    this.activeEntity = null;
    this.recentEntities = [];
    this.lastIntent = null;
    this.lastQuery = '';
    this.lastReply = '';
    this.awaitingClarification = null;
  }
}
