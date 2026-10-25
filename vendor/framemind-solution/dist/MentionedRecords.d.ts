import type { KnowledgeRecord, SelectBy, SlotValue } from './types.js';
/**
 * Same word in another case: each form starts with the other's stem. Both directions, so
 * "start" does not name "Staré" although the stems "start"/"star" share a prefix.
 */
export declare function sameWord(a: string, b: string): boolean;
/**
 * Score of every known value the text names. A word naming several values counts
 * proportionally less ("Velkou" fits "Velká Bystřice" and "Velké Losiny"; "Bystřicí" decides).
 */
export declare function mentionScores(text: string, knownValues: Iterable<string>): Map<string, number>;
/** Known values of the given fields across records. */
export declare function knownValues(records: KnowledgeRecord[], fields: Iterable<string>): string[];
/**
 * The text without words that name a known value. A name says what the visitor asks about,
 * not what they want to know, so it must not count as evidence for an intent.
 */
export declare function withoutMentions(text: string, values: Iterable<string>): string;
export type MentionSelection = {
    kind: 'none';
} | {
    kind: 'record';
    record: KnowledgeRecord;
    selector: SelectBy;
} | {
    kind: 'unresolved';
};
/**
 * `none` = the text names no known value (other selectors decide as before), `record` = the
 * first mention selector with a clear winner, `unresolved` = a known value was named but no
 * selector settles it, so the caller must not substitute a default record.
 */
export declare function selectMentioned(text: string, selectors: SelectBy[], records: KnowledgeRecord[], slots: Record<string, SlotValue | undefined>, defaultRecord?: KnowledgeRecord, usable?: (record: KnowledgeRecord) => boolean): MentionSelection;
//# sourceMappingURL=MentionedRecords.d.ts.map