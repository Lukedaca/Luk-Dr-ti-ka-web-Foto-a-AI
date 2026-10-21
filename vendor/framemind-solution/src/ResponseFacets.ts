import { escapeRegExp, isWithinOneEdit, normalizeText, stemText } from './text.js';
import type { IntentResponseRule, ResponseFacet } from './types.js';

function bounded(value: string): RegExp {
  return new RegExp(`(?:^|\\s|-)${escapeRegExp(value)}(?:$|\\s|-)`);
}

function hasTerm(normalized: string, stemmed: string, term: string): boolean {
  const plain = normalizeText(term);
  if (!plain) return false;
  return bounded(plain).test(normalized) || bounded(stemText(plain)).test(stemmed);
}

function hasFuzzyTerm(normalized: string, stemmed: string, term: string): boolean {
  const plain = normalizeText(term);
  if (!plain || plain.includes(' ') || plain.length < 5) return false;
  const stemmedTerm = stemText(plain);
  const words = normalized.split(/[\s-]+/).filter(Boolean);
  const stems = stemmed.split(/[\s-]+/).filter(Boolean);
  return words.some((w) => isWithinOneEdit(w, plain))
    || (stemmedTerm.length >= 5 && stems.some((s) => isWithinOneEdit(s, stemmedTerm)));
}

function extractPlaceholders(template: string | undefined): string[] {
  if (!template) return [];
  const out: string[] = [];
  const re = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    const key = m[1]!;
    if (key !== 'record.content' && key !== 'content') out.push(key);
  }
  return out;
}

const CONTENT_PREFIX_RE = /^\{\{\s*(?:record\.)?content\s*\}\}\s*/;

/** Strips redundant leading {{record.content}} when combining multiple facet templates or doing progressive disclosure. */
export function stripLeadingRecordContent(template: string): string {
  const stripped = template.replace(CONTENT_PREFIX_RE, '').trim();
  return stripped.length > 0 ? stripped : template;
}

/** Exactly one facet whose keyword occurs in the message; otherwise undefined. */
export function pickFacet(facets: ResponseFacet[] | undefined, text: string): ResponseFacet | undefined {
  if (!facets?.length) return undefined;
  const normalized = normalizeText(text);
  const stemmed = stemText(normalized);
  const hits = facets.filter((facet) => facet.keywords.some((term) => hasTerm(normalized, stemmed, term)));
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) {
    const fuzzyHits = facets.filter((facet) => facet.keywords.some((term) => hasFuzzyTerm(normalized, stemmed, term)));
    if (fuzzyHits.length === 1) return fuzzyHits[0];
  }
  return undefined;
}

/**
 * Resolves single or multi-facet match for a rule. If multiple facets match and the rule's
 * main template already summarizes their placeholders (e.g. football_school), returns undefined
 * so the summary template answers. If matched facets contain supplementary details not in
 * rule.template, merges them without duplicating {{record.content}}.
 */
export function resolveRuleFacet(
  rule: Pick<IntentResponseRule, 'template' | 'facets'> | undefined,
  text: string,
): ResponseFacet | undefined {
  const facets = rule?.facets;
  if (!facets?.length) return undefined;
  const normalized = normalizeText(text);
  const stemmed = stemText(normalized);
  let hits = facets.filter((facet) => facet.keywords.some((term) => hasTerm(normalized, stemmed, term)));
  if (hits.length === 0) {
    const fuzzyHits = facets.filter((facet) => facet.keywords.some((term) => hasFuzzyTerm(normalized, stemmed, term)));
    if (fuzzyHits.length === 1) hits = fuzzyHits;
  }
  if (hits.length === 0) return undefined;
  if (hits.length === 1) return hits[0];

  const mainTemplate = rule?.template ?? '';
  const allSameAsMain = hits.every((facet) => facet.template.trim() === mainTemplate.trim());
  if (allSameAsMain) return hits[0];

  const mainPlaceholders = new Set(extractPlaceholders(mainTemplate));
  const coveredByMain = hits.every((facet) => {
    const placeholders = extractPlaceholders(facet.template);
    return placeholders.length > 0 && placeholders.every((p) => mainPlaceholders.has(p));
  });
  if (coveredByMain) return undefined;

  const combinedParts = hits.map((facet, idx) =>
    idx === 0 ? facet.template.trim() : stripLeadingRecordContent(facet.template),
  );
  const uniqueParts = [...new Set(combinedParts.filter(Boolean))];
  return {
    id: hits.map((h) => h.id).join('+'),
    keywords: hits.flatMap((h) => h.keywords),
    template: uniqueParts.join(' '),
  };
}
