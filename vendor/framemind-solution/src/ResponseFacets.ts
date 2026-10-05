import { escapeRegExp, normalizeText, stemText } from './text.js';
import type { ResponseFacet } from './types.js';

function bounded(value: string): RegExp {
  return new RegExp(`(?:^|\\s|-)${escapeRegExp(value)}(?:$|\\s|-)`);
}

function hasTerm(normalized: string, stemmed: string, term: string): boolean {
  const plain = normalizeText(term);
  if (!plain) return false;
  return bounded(plain).test(normalized) || bounded(stemText(plain)).test(stemmed);
}

/** Exactly one facet whose keyword occurs in the message; otherwise undefined. */
export function pickFacet(facets: ResponseFacet[] | undefined, text: string): ResponseFacet | undefined {
  if (!facets?.length) return undefined;
  const normalized = normalizeText(text);
  const stemmed = stemText(normalized);
  const hits = facets.filter((facet) => facet.keywords.some((term) => hasTerm(normalized, stemmed, term)));
  return hits.length === 1 ? hits[0] : undefined;
}
