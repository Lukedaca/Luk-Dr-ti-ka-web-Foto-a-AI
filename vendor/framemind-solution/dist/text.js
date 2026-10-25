export const CZECH_MONTHS = {
    leden: 1,
    lednu: 1,
    unor: 2,
    unoru: 2,
    brezen: 3,
    breznu: 3,
    duben: 4,
    dubnu: 4,
    kveten: 5,
    kvetnu: 5,
    cerven: 6,
    cervnu: 6,
    cervenec: 7,
    cervenci: 7,
    srpen: 8,
    srpnu: 8,
    zari: 9,
    rijen: 10,
    rijnu: 10,
    listopad: 11,
    listopadu: 11,
    prosinec: 12,
    prosinci: 12,
};
export function normalizeText(value) {
    return String(value !== null && value !== void 0 ? value : '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
export function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export function monthFromText(normalized, prefix) {
    for (const [name, month] of Object.entries(CZECH_MONTHS)) {
        if (prefix) {
            const expression = new RegExp(`${escapeRegExp(prefix)}\\s+${name}\\b`);
            if (expression.test(normalized))
                return month;
        }
        else if (new RegExp(`\\b${name}\\b`).test(normalized)) {
            return month;
        }
    }
    return undefined;
}
export function hasExplicitNavigation(normalized) {
    return /\b(otevr|otevri|ukaz|ukazat|prejdi|prejit|naviguj|najdi|zobraz|rozbal)\w*\b/.test(normalized);
}
export function stemCzechWord(word) {
    let s = String(word || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    if (s.length <= 3)
        return s;
    s = s.replace(/(?:kem|ice|ici|ich|ovem|eho|emu|ymi|emi|ovi|ami|ach|ych|im|ym|em|am|um|ou|es|as|os|ov|ku|ka|ce|ky|ek|ke|ko|e|i|u|a|o|y)$/, '');
    return s.length >= 3 ? s : String(word || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
export function stemText(normalized) {
    return String(normalized || '')
        .split(/\s+/)
        .map((word) => stemCzechWord(word))
        .join(' ');
}
/**
 * True when two normalized tokens (length >= 5, sharing a 2-char prefix) are within
 * Damerau-Levenshtein distance 1 (single substitution, insertion, deletion or adjacent swap).
 */
export function isWithinOneEdit(a, b) {
    if (a === b)
        return true;
    if (a.length < 5 || b.length < 5)
        return false;
    if (Math.abs(a.length - b.length) > 1)
        return false;
    if (a[0] !== b[0] || a[1] !== b[1])
        return false;
    if (a.length === b.length) {
        let diffCount = 0;
        let firstDiff = -1;
        for (let i = 0; i < a.length; i += 1) {
            if (a[i] !== b[i]) {
                diffCount += 1;
                if (firstDiff === -1)
                    firstDiff = i;
                if (diffCount > 2)
                    return false;
            }
        }
        if (diffCount === 1)
            return true;
        if (diffCount === 2 && firstDiff >= 0 && firstDiff + 1 < a.length) {
            return a[firstDiff] === b[firstDiff + 1] && a[firstDiff + 1] === b[firstDiff];
        }
        return false;
    }
    const shorter = a.length < b.length ? a : b;
    const longer = a.length < b.length ? b : a;
    let i = 0;
    let j = 0;
    let skipped = false;
    while (i < shorter.length && j < longer.length) {
        if (shorter[i] === longer[j]) {
            i += 1;
            j += 1;
        }
        else {
            if (skipped)
                return false;
            skipped = true;
            j += 1;
        }
    }
    return true;
}
const CZECH_COLLOQUIAL_SYNONYMS = [
    { pattern: /\b(?:za kolik|kolik kostuj[a-z]*|na kolik vyjd[a-z]*|kolik vyjd[a-z]*|cenovk[a-z]*)\b/, expansion: 'cena kolik stoji' },
    { pattern: /\b(?:letni\s+)?tabor[a-z]*\b/, expansion: 'kemp soustredeni' },
    { pattern: /\b(?:spil|mac|utkani)\b/, expansion: 'zapas' },
    { pattern: /\b(?:kopou|kopeme|hrajem)\b/, expansion: 'hraji zapas' },
    { pattern: /\b(?:prcek|prcka|prckovi|kluk|kluka|klukovi|holka|holku|holce|decko|decka|ratolest)\b/, expansion: 'dite' },
    { pattern: /\b(?:webovk[a-z]*|sajt[a-z]*)\b/, expansion: 'web' },
    { pattern: /\b(?:(?:na\s+)?ruku|(?:v\s+)?hotovosti)\b/, expansion: 'hotove platba' },
    { pattern: /\b(?:(?:na\s+)?zkousku|vyzkouset|zkusebn[a-z]*)\b/, expansion: 'zkousku zdarma prvni' },
    { pattern: /\b(?:kdyz prsi|v desti|za deste|desti|pres zimu|v zime|zime)\b/, expansion: 'zimni destive umt telocvicna' },
];
const CONVERSATIONAL_BRIDGE_RE = /^(?:(?:dobry\s+den|ahoj|zdravim|cau|super|skvele|perfektni|parada|fajn|dobre|dobry|jasne|jasny|aha|jo|ano|ok|rozumim|chapu|dik|diky|dekuji|dekuju|mockrat\s+dekuji|diky\s+moc|dekuji\s+moc|to\s+je\s+super|to\s+zni\s+dobre|bezva|prima|tak\s+jo|hele|poslys|prosim\s+te|prosim\s+vas|jeste\s+se\s+zeptam|jeste\s+by\s+me\s+zajimalo|zajimalo\s+by\s+me)[\s,!.:;-]+)+/i;
/**
 * Strips leading conversational acknowledgements and discourse bridges ("Super, díky, a...",
 * "Aha rozumím, ještě se zeptám...") when followed by an actual follow-up question or topic,
 * while leaving pure standalone social turns untouched.
 */
export function stripConversationalBridge(text) {
    const raw = String(text !== null && text !== void 0 ? text : '').trim();
    if (!raw)
        return '';
    const norm = normalizeText(raw);
    const match = CONVERSATIONAL_BRIDGE_RE.exec(norm);
    if (!match || match[0].length >= norm.length)
        return raw;
    const remainderNorm = norm.slice(match[0].length).trim();
    if (remainderNorm.length < 3)
        return raw;
    if (/^za\s+(?:info\w*|odpoved\w*|pomoc\w*|rad\w*|ochot\w*|cas\w*|vse\w*|zprav\w*)\b/i.test(remainderNorm)) {
        return raw;
    }
    // Strip corresponding leading clauses/words from raw text
    const rawStripped = raw
        .replace(/^(?:(?:dobrý\s+den|dobry\s+den|ahoj|zdravím|zdravim|čau|cau|super|skvělé|skvele|perfektní|perfektni|paráda|parada|fajn|dobře|dobre|dobrý|dobry|jasně|jasne|jasný|jasny|aha|jo|ano|ok|rozumím|rozumim|chápu|chapu|dík|dik|díky|diky|děkuji|dekuji|děkuju|dekuju|mockrát\s+děkuji|mockrat\s+dekuji|díky\s+moc|diky\s+moc|děkuji\s+moc|dekuji\s+moc|to\s+je\s+super|to\s+zní\s+dobře|to\s+zni\s+dobre|bezva|prima|tak\s+jo|hele|poslyš|poslys|prosím\s+tě|prosim\s+te|prosím\s+vás|prosim\s+vas|ještě\s+se\s+zeptám|jeste\s+se\s+zeptam|ještě\s+by\s+mě\s+zajímalo|jeste\s+by\s+me\s+zajimalo|zajímalo\s+by\s+mě|zajimalo\s+by\s+me)[\s,!.:;–-]+)+/i, '')
        .trim();
    return rawStripped.length >= 3 ? rawStripped : raw;
}
/**
 * Appends canonical Czech domain terms for colloquial expressions that do not share
 * a morphological stem with standard keywords, preserving original tokens intact.
 */
export function expandCzechSynonyms(normalized) {
    if (!normalized)
        return '';
    const extras = [];
    for (const rule of CZECH_COLLOQUIAL_SYNONYMS) {
        if (rule.pattern.test(normalized)) {
            extras.push(rule.expansion);
        }
    }
    return extras.length > 0 ? `${normalized} ${extras.join(' ')}` : normalized;
}
//# sourceMappingURL=text.js.map