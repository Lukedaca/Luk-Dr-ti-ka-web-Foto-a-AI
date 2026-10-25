import type { IntentDefinition, ResponseFacet, SlotPattern } from './types.js';
/** Jak jádro na záměr přišlo. */
export type IntentOrigin = 'exact' | 'lexical' | 'facet' | 'pivot' | 'semantic' | 'deduced';
/** Proč jádro odpověď předalo modelu. */
export type DeferralReason = 'deduced' | 'negation' | 'uncovered' | 'repeat';
export declare function isNegatedRequest(text: string): boolean;
export declare function isOpenEndedAdvisory(text: string): boolean;
interface GateTermOptions {
    slotPatterns?: SlotPattern[] | undefined;
    mentionValues?: string[] | undefined;
    neutralTerms?: string[] | undefined;
    recordTerms?: string[] | undefined;
}
/** Slova, kterými záměr, jeho aspekty a ověřený záznam mluví o svém tématu. */
export declare function intentVocabulary(definition: IntentDefinition | undefined, facets?: ResponseFacet[], recordTerms?: string[]): string[];
/**
 * Obsahová slova dotazu, která slovník záměru nepokrývá. Prázdné pole = jádro smí
 * odpovědět samo. Hovorové slovo platí za pokryté, když jeho spisovný ekvivalent je ve slovníku.
 */
export declare function uncoveredTerms(text: string, vocabulary: string[], options?: GateTermOptions): string[];
export interface GateInput {
    text: string;
    origin: IntentOrigin;
    definition: IntentDefinition | undefined;
    facets?: ResponseFacet[] | undefined;
    slotPatterns?: SlotPattern[] | undefined;
    mentionValues?: string[] | undefined;
    neutralTerms?: string[] | undefined;
    recordTerms?: string[] | undefined;
}
/** Důvod, proč jádro nesmí odpovědět samo, nebo `null`, když smí. */
export declare function deferralReason(input: GateInput): DeferralReason | null;
export {};
//# sourceMappingURL=AnswerGate.d.ts.map