import type { AgentProfile } from './AgentProfile.js';
import type { DiscourseClarification, DiscourseEntity, DiscourseSnapshot } from './types.js';
export interface DiscourseContextOptions {
    maxRecentEntities?: number;
}
export declare class DiscourseContext {
    private turn;
    private activeEntity;
    private recentEntities;
    private lastIntent;
    private lastQuery;
    private lastReply;
    private awaitingClarification;
    private readonly maxRecent;
    constructor(options?: DiscourseContextOptions);
    setEntity(type: string, name: string, data?: Record<string, unknown>): DiscourseEntity;
    getEntity(type?: string): DiscourseEntity | null;
    clearEntity(): void;
    setAwaitingClarification(clarification: DiscourseClarification): void;
    clearAwaitingClarification(): void;
    getAwaitingClarification(): DiscourseClarification | null;
    advanceTurn(query?: string, reply?: string, intent?: string): void;
    isAnaphoraQuery(query: string): boolean;
    isRepairQuery(query: string): boolean;
    extractRepairSubject(query: string): string | null;
    resolveSuggestions(intentId: string, profile?: AgentProfile): string[];
    snapshot(): DiscourseSnapshot;
    reset(): void;
}
//# sourceMappingURL=DiscourseContext.d.ts.map