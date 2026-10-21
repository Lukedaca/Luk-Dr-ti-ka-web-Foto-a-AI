export declare function normalizeText(value: unknown): string;
export declare function escapeRegExp(value: string): string;
export declare function monthFromText(normalized: string, prefix?: string): number | undefined;
export declare function hasExplicitNavigation(normalized: string): boolean;
export declare function stemCzechWord(word: string): string;
export declare function stemText(normalized: string): string;
/**
 * True when two normalized tokens (length >= 5, sharing a 2-char prefix) are within
 * Damerau-Levenshtein distance 1 (single substitution, insertion, deletion or adjacent swap).
 */
export declare function isWithinOneEdit(a: string, b: string): boolean;
/**
 * Appends canonical Czech domain terms for colloquial expressions that do not share
 * a morphological stem with standard keywords, preserving original tokens intact.
 */
export declare function expandCzechSynonyms(normalized: string): string;
//# sourceMappingURL=text.d.ts.map