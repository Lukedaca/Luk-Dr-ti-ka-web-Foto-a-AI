import { escapeRegExp, normalizeText, stemText } from './text.js';
function bounded(value) {
    return new RegExp(`(?:^|\\s|-)${escapeRegExp(value)}(?:$|\\s|-)`);
}
function hasTerm(normalized, stemmed, term) {
    const plain = normalizeText(term);
    if (!plain)
        return false;
    return bounded(plain).test(normalized) || bounded(stemText(plain)).test(stemmed);
}
/** Exactly one facet whose keyword occurs in the message; otherwise undefined. */
export function pickFacet(facets, text) {
    if (!(facets === null || facets === void 0 ? void 0 : facets.length))
        return undefined;
    const normalized = normalizeText(text);
    const stemmed = stemText(normalized);
    const hits = facets.filter((facet) => facet.keywords.some((term) => hasTerm(normalized, stemmed, term)));
    return hits.length === 1 ? hits[0] : undefined;
}
//# sourceMappingURL=ResponseFacets.js.map