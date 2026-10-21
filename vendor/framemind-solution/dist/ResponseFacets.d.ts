import type { IntentResponseRule, ResponseFacet } from './types.js';
/** Strips redundant leading {{record.content}} when combining multiple facet templates or doing progressive disclosure. */
export declare function stripLeadingRecordContent(template: string): string;
/** Exactly one facet whose keyword occurs in the message; otherwise undefined. */
export declare function pickFacet(facets: ResponseFacet[] | undefined, text: string): ResponseFacet | undefined;
/**
 * Resolves single or multi-facet match for a rule. If multiple facets match and the rule's
 * main template already summarizes their placeholders (e.g. football_school), returns undefined
 * so the summary template answers. If matched facets contain supplementary details not in
 * rule.template, merges them without duplicating {{record.content}}.
 */
export declare function resolveRuleFacet(rule: Pick<IntentResponseRule, 'template' | 'facets'> | undefined, text: string): ResponseFacet | undefined;
//# sourceMappingURL=ResponseFacets.d.ts.map