import { escapeRegExp, expandCzechSynonyms, hasExplicitNavigation, isWithinOneEdit, monthFromText, normalizeText, stemText } from './text.js';
function includesTerm(text, term) {
    const normalized = normalizeText(term);
    if (!normalized)
        return false;
    return new RegExp(`(?:^|\\s|-)${escapeRegExp(normalized)}(?:$|\\s|-)`).test(text);
}
function includesStemmedTerm(stemmedText, term) {
    const stemmedTerm = stemText(normalizeText(term));
    if (!stemmedTerm)
        return false;
    return new RegExp(`(?:^|\\s|-)${escapeRegExp(stemmedTerm)}(?:$|\\s|-)`).test(stemmedText);
}
/**
 * Same-length 1-edit typo tolerance (single substitution or adjacent transposition) on
 * words >= 6 chars sharing a 2-char prefix. Same-length constraint prevents matching
 * different grammatical number/case endings (e.g. "trenink" vs "treninky").
 */
function includesFuzzyTerm(text, term) {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm || normalizedTerm.includes(' ') || normalizedTerm.length < 6)
        return false;
    const words = text.split(/[\s-]+/).filter(Boolean);
    return words.some((word) => word.length === normalizedTerm.length && isWithinOneEdit(word, normalizedTerm));
}
function isSafePattern(pattern) {
    if (!pattern || pattern.length > 200)
        return false;
    // Tenant patterns intentionally support only a linear-time regex subset.
    // Repetition, lookarounds and backreferences are rejected to prevent ReDoS.
    if (/[+*{]/.test(pattern))
        return false;
    if (/\\[1-9]|\\k<|\(\?/.test(pattern))
        return false;
    return true;
}
// Czech age words (normalized, no diacritics): cardinal ("je mu osm") and the stem of the
// adjective ("osmiletý" → "osmilet"). Only read in an age context, never as a bare number.
const AGE_WORDS = {
    ctyri: 4, pet: 5, sest: 6, sedm: 7, osm: 8, devet: 9, deset: 10, jedenact: 11, dvanact: 12,
    trinact: 13, ctrnact: 14, patnact: 15, sestnact: 16, sedmnact: 17, osmnact: 18, devatenact: 19,
};
const AGE_ADJECTIVE_STEMS = {
    ctyr: 4, peti: 5, sesti: 6, sedmi: 7, osmi: 8, deviti: 9, deseti: 10, jedenacti: 11, dvanacti: 12,
    trinacti: 13, ctrnacti: 14, patnacti: 15, sestnacti: 16, sedmnacti: 17, osmnacti: 18, devatenacti: 19,
};
const AGE_WORD_ALTERNATION = Object.keys(AGE_WORDS).join('|');
const AGE_WORD_RE = new RegExp(`\\b(?:ma|je mu|je ji|je|jsou mu)\\s+(${AGE_WORD_ALTERNATION})\\b|\\b(${AGE_WORD_ALTERNATION})\\s+let\\b`);
const AGE_ADJECTIVE_RE = new RegExp(`\\b(${Object.keys(AGE_ADJECTIVE_STEMS).join('|')})let[a-z]*\\b`);
function extractAge(normalized) {
    var _a, _b, _c;
    const digits = (_a = normalized.match(/\b(?:ma|je mu|je ji|je)\s+(\d{1,2})\b/)) !== null && _a !== void 0 ? _a : normalized.match(/\b(\d{1,2})\s+let\b/);
    if (digits === null || digits === void 0 ? void 0 : digits[1])
        return Number(digits[1]);
    const word = normalized.match(AGE_WORD_RE);
    const cardinal = (_b = word === null || word === void 0 ? void 0 : word[1]) !== null && _b !== void 0 ? _b : word === null || word === void 0 ? void 0 : word[2];
    if (cardinal)
        return AGE_WORDS[cardinal];
    const adjective = (_c = normalized.match(AGE_ADJECTIVE_RE)) === null || _c === void 0 ? void 0 : _c[1];
    return adjective ? AGE_ADJECTIVE_STEMS[adjective] : undefined;
}
function extractBudgetKc(normalized) {
    const thousands = normalized.match(/\b(?:do|max|maximalne|rozpocet|kolem|cca|za)\s+(\d{1,3})\s*(?:tisic|tis)\b/);
    if (thousands === null || thousands === void 0 ? void 0 : thousands[1])
        return Number(thousands[1]) * 1000;
    const explicitKc = normalized.match(/\b(\d{1,3}(?:\s\d{3})+|\d{3,6})\s*(?:kc|korun|czk)\b/);
    if (explicitKc === null || explicitKc === void 0 ? void 0 : explicitKc[1])
        return Number(explicitKc[1].replace(/\s+/g, ''));
    const prefixed = normalized.match(/\b(?:do|max|maximalne|rozpocet)\s+(\d{1,3}(?:\s\d{3})+|\d{4,6})\b/);
    if (prefixed === null || prefixed === void 0 ? void 0 : prefixed[1])
        return Number(prefixed[1].replace(/\s+/g, ''));
    return undefined;
}
function extractPatternSlots(normalized, patterns) {
    var _a, _b;
    const slots = {};
    const positions = {};
    for (const item of patterns) {
        if (!(item === null || item === void 0 ? void 0 : item.slot) || typeof item.value !== 'string' || !isSafePattern(item.pattern))
            continue;
        try {
            const expression = new RegExp(item.pattern, 'g');
            let match;
            while ((match = expression.exec(normalized)) !== null) {
                if (match.index >= ((_a = positions[item.slot]) !== null && _a !== void 0 ? _a : -1)) {
                    slots[item.slot] = item.value.replace(/\$1/g, (_b = match[1]) !== null && _b !== void 0 ? _b : '');
                    positions[item.slot] = match.index;
                }
                // Optional-only patterns can match an empty string. Never loop on them.
                if (match[0].length === 0)
                    expression.lastIndex += 1;
            }
        }
        catch {
            // Invalid tenant patterns must not break local answers.
        }
    }
    return slots;
}
function extractSlots(normalized, now) {
    const slots = {};
    const yearMatch = normalized.match(/\b(20\d{2})\b/);
    if (yearMatch === null || yearMatch === void 0 ? void 0 : yearMatch[1])
        slots.birthYear = Number(yearMatch[1]);
    const age = extractAge(normalized);
    if (age !== undefined)
        slots.childAge = age;
    const budgetKc = extractBudgetKc(normalized);
    if (budgetKc !== undefined && Number.isFinite(budgetKc) && budgetKc > 0) {
        slots.budgetKc = budgetKc;
    }
    const nextAgeMatch = normalized.match(/\bv\s+[a-z]+\s+(\d{1,2})\b/);
    if (nextAgeMatch === null || nextAgeMatch === void 0 ? void 0 : nextAgeMatch[1])
        slots.nextAge = Number(nextAgeMatch[1]);
    const birthdayMonth = monthFromText(normalized, 'v');
    if (birthdayMonth)
        slots.birthdayMonth = birthdayMonth;
    const statedCurrentMonth = monthFromText(normalized, 'ted je');
    const currentMonth = statedCurrentMonth !== null && statedCurrentMonth !== void 0 ? statedCurrentMonth : now.getUTCMonth() + 1;
    slots.currentMonth = currentMonth;
    slots.currentYear = now.getUTCFullYear();
    if (!slots.birthYear && typeof slots.nextAge === 'number' && typeof slots.childAge === 'number') {
        const nextAge = slots.nextAge;
        const childAge = slots.childAge;
        if (nextAge === childAge + 1 && typeof slots.birthdayMonth === 'number' && currentMonth < slots.birthdayMonth) {
            slots.birthYear = now.getUTCFullYear() - nextAge;
        }
    }
    if (!slots.birthYear && typeof slots.childAge === 'number' && /\bro[cč]n[ií]k\b/.test(normalized)) {
        slots.birthYear = slots.childAge;
        delete slots.childAge;
    }
    if (hasExplicitNavigation(normalized))
        slots.navigationRequested = true;
    return slots;
}
function scoreIntent(definition, normalized, stemmed) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    if (definition.standalone) {
        const phrases = [
            ...((_a = definition.examples) !== null && _a !== void 0 ? _a : []),
            ...((_b = definition.keywords) !== null && _b !== void 0 ? _b : []),
            ...((_c = definition.keywordGroups) !== null && _c !== void 0 ? _c : []).map((group) => group.join(' ')),
        ];
        return phrases.some((phrase) => normalized === normalizeText(phrase))
            ? 120 + ((_d = definition.priority) !== null && _d !== void 0 ? _d : 0)
            : 0;
    }
    let evidence = 0;
    for (const example of (_e = definition.examples) !== null && _e !== void 0 ? _e : []) {
        const candidate = normalizeText(example);
        if (candidate && normalized === candidate)
            evidence += 120;
        else if (candidate && normalized.includes(candidate))
            evidence += 60;
    }
    for (const keyword of (_f = definition.keywords) !== null && _f !== void 0 ? _f : []) {
        if (includesTerm(normalized, keyword)) {
            evidence += 18;
        }
        else if (includesStemmedTerm(stemmed, keyword)) {
            evidence += 16;
        }
        else if (includesFuzzyTerm(normalized, keyword)) {
            evidence += 15;
        }
    }
    for (const group of (_g = definition.keywordGroups) !== null && _g !== void 0 ? _g : []) {
        const allMatch = group.every((keyword) => includesTerm(normalized, keyword)
            || includesStemmedTerm(stemmed, keyword)
            || includesFuzzyTerm(normalized, keyword));
        if (allMatch)
            evidence += 55 + group.length * 5;
    }
    for (const pattern of (_h = definition.patterns) !== null && _h !== void 0 ? _h : []) {
        if (!isSafePattern(pattern))
            continue;
        try {
            if (new RegExp(pattern, 'i').test(normalized))
                evidence += 70;
        }
        catch {
            // Invalid tenant patterns must not break local answers.
        }
    }
    return evidence > 0 ? evidence + ((_j = definition.priority) !== null && _j !== void 0 ? _j : 0) : 0;
}
export class IntentEngine {
    constructor(definitions, slotPatterns = []) {
        var _a;
        this.trainedExamples = new Map();
        this.definitions = definitions.slice();
        this.slotPatterns = slotPatterns.slice();
        for (const definition of this.definitions) {
            for (const example of (_a = definition.exactExamples) !== null && _a !== void 0 ? _a : []) {
                const normalized = normalizeText(example);
                if (!normalized || normalized.length > 2000)
                    throw new Error('Invalid exact intent example');
                const previous = this.trainedExamples.get(normalized);
                if (previous && previous.id !== definition.id)
                    throw new Error(`Conflicting exact intent example: ${previous.id} / ${definition.id}`);
                this.trainedExamples.set(normalized, definition);
            }
        }
    }
    hasExactExample(text) {
        const normalized = normalizeText(text);
        return normalized.length <= 2000 && this.trainedExamples.has(normalized);
    }
    detect(text, context, now = new Date(), discourseSnapshot) {
        var _a, _b, _c, _d, _e, _f, _g;
        const normalizedText = normalizeText(text).slice(0, 2000);
        const stemmedText = stemText(normalizedText);
        const slots = { ...extractSlots(normalizedText, now), ...extractPatternSlots(normalizedText, this.slotPatterns) };
        if (discourseSnapshot === null || discourseSnapshot === void 0 ? void 0 : discourseSnapshot.activeEntity) {
            slots.activeEntityType = discourseSnapshot.activeEntity.type;
            slots.activeEntityName = discourseSnapshot.activeEntity.name;
        }
        // Corrections choose an existing intent; normal safety, knowledge freshness,
        // response composition and action permissions still run in FrameMindEngine.
        const trained = this.trainedExamples.get(normalizedText);
        if (trained && normalizeText(text).length <= 2000) {
            return {
                id: trained.id,
                confidence: 1,
                normalizedText,
                slots,
                isFollowUp: Boolean(context.activeIntent && ((_a = trained.followUpFor) === null || _a === void 0 ? void 0 : _a.includes(context.activeIntent))),
            };
        }
        let best;
        let bestScore = 0;
        let followUp = false;
        for (const definition of this.definitions) {
            const lexical = scoreIntent(definition, normalizedText, stemmedText);
            let score = lexical;
            const follows = Boolean(context.activeIntent && ((_b = definition.followUpFor) === null || _b === void 0 ? void 0 : _b.includes(context.activeIntent)));
            if (follows && (slots.childAge || slots.birthYear || slots.nextAge))
                score += 95;
            // Anaphora boost only breaks ties between intents the message itself supports.
            // Without own lexical evidence it hijacked unrelated questions ("Kdy je trénink?"
            // after a recruitment question) — those belong to unknown, i.e. the managed model.
            if (lexical > 0 && (discourseSnapshot === null || discourseSnapshot === void 0 ? void 0 : discourseSnapshot.lastIntent) && ((_c = definition.followUpFor) === null || _c === void 0 ? void 0 : _c.includes(discourseSnapshot.lastIntent))) {
                if (/^(?:a\s+)?(?:kolik|kde|kdy|jak|proc|cena|rozpis|trener|adresa)\b/i.test(normalizedText)) {
                    score += 65;
                }
            }
            if (score > bestScore) {
                best = definition;
                bestScore = score;
                followUp = follows;
            }
        }
        // Fallback pass: colloquial Czech synonyms when strict lexical did not match.
        if (!best || bestScore < ((_d = best.minScore) !== null && _d !== void 0 ? _d : 20)) {
            const expandedNormalized = expandCzechSynonyms(normalizedText);
            if (expandedNormalized !== normalizedText) {
                const expandedStemmed = stemText(expandedNormalized);
                for (const definition of this.definitions) {
                    if (definition.standalone)
                        continue;
                    const lexical = scoreIntent(definition, expandedNormalized, expandedStemmed);
                    let score = lexical;
                    const follows = Boolean(context.activeIntent && ((_e = definition.followUpFor) === null || _e === void 0 ? void 0 : _e.includes(context.activeIntent)));
                    if (follows && (slots.childAge || slots.birthYear || slots.nextAge))
                        score += 95;
                    if (lexical > 0 && (discourseSnapshot === null || discourseSnapshot === void 0 ? void 0 : discourseSnapshot.lastIntent) && ((_f = definition.followUpFor) === null || _f === void 0 ? void 0 : _f.includes(discourseSnapshot.lastIntent))) {
                        if (/^(?:a\s+)?(?:kolik|kde|kdy|jak|proc|cena|rozpis|trener|adresa)\b/i.test(normalizedText)) {
                            score += 65;
                        }
                    }
                    if (score > bestScore) {
                        best = definition;
                        bestScore = score;
                        followUp = follows;
                    }
                }
            }
        }
        if (!best || bestScore < ((_g = best.minScore) !== null && _g !== void 0 ? _g : 20)) {
            return { id: 'unknown', confidence: 0, normalizedText, slots, isFollowUp: false };
        }
        return {
            id: best.id,
            confidence: Math.min(1, bestScore / 120),
            normalizedText,
            slots,
            isFollowUp: followUp,
        };
    }
}
//# sourceMappingURL=IntentEngine.js.map