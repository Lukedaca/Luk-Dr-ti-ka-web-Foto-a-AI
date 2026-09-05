import type { ExtractedLead, SafetyCheckResult } from './types.js';
export declare class SafetyShield {
    /**
     * Checks if user input is safe to process.
     * If toxic or an injection attack, the message MUST be dropped and never learned from.
     */
    static checkSafety(text: string): SafetyCheckResult;
    /**
     * Sanitizes all Personally Identifiable Information (PII) like phone numbers and emails.
     * Safe to pass to analytics or topic clustering without storing user identities.
     */
    static sanitizePii(text: string): string;
    /**
     * Identifies and extracts legitimate lead information (name, phone, email, recruitment child year)
     * so it can be routed directly to the authorized recipient (Stream 1),
     * while never leaking into public model weights or memory (Stream 2).
     */
    static extractLead(text: string, contextHint?: string): ExtractedLead;
}
//# sourceMappingURL=SafetyShield.d.ts.map