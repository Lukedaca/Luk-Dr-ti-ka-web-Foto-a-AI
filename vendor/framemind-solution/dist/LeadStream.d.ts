import type { ExtractedLead, LeadDispatchResult, LeadRecord, LearningEvent, LearningSink } from './types.js';
export interface LeadDispatcher {
    readonly id: string;
    dispatch(lead: LeadRecord): Promise<LeadDispatchResult>;
}
export declare class InMemoryLeadDispatcher implements LeadDispatcher {
    readonly id = "in-memory-lead-dispatcher";
    readonly dispatched: LeadRecord[];
    dispatch(lead: LeadRecord): Promise<LeadDispatchResult>;
}
export declare class LeadStream {
    private readonly domain;
    private readonly dispatcher;
    private readonly learningSink?;
    constructor(domain: string, dispatcher: LeadDispatcher, learningSink?: LearningSink | undefined);
    /**
     * Transforms an extracted lead into a structured LeadRecord with full details
     * for authorized delivery (Stream 1).
     */
    createRecord(extracted: ExtractedLead, metadata?: Record<string, unknown>): LeadRecord;
    /**
     * Transforms a LeadRecord into a 100% PII-free LearningEvent (Stream 2).
     * Strips all personal names, phone numbers, and emails.
     */
    static toSafeLearningEvent(lead: LeadRecord): LearningEvent;
    /**
     * Dual-stream processing:
     * 1. Stream 1: Delivers full contact info directly to club/business owner.
     * 2. Stream 2: Emits anonymized conversion metrics to learning sink (Zero PII).
     */
    processInput(text: string, contextHint?: string): Promise<{
        handled: boolean;
        lead?: LeadRecord;
    }>;
}
//# sourceMappingURL=LeadStream.d.ts.map