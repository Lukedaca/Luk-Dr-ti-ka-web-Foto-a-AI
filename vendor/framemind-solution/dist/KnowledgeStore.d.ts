import type { KnowledgeRecord, KnowledgeSnapshot, SlotValue } from './types.js';
/** Browser-safe synchronous SHA-256 used to verify immutable knowledge snapshots. */
export declare function sha256Hex(value: string): string;
export declare function validateKnowledgeSnapshot(snapshot: KnowledgeSnapshot): string[];
export declare class KnowledgeStore {
    private readonly byId;
    private readonly records;
    constructor(snapshot: KnowledgeSnapshot);
    get(id: string): KnowledgeRecord | undefined;
    findByData(field: string, value: SlotValue, type?: string): KnowledgeRecord | undefined;
    forIntent(intentId: string): KnowledgeRecord[];
    all(): KnowledgeRecord[];
}
//# sourceMappingURL=KnowledgeStore.d.ts.map