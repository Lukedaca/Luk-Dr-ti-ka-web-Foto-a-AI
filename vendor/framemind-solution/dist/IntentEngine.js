import { escapeRegExp, hasExplicitNavigation, monthFromText, normalizeText } from './text.js';
function includesTerm(text, term) {
    const normalized = normalizeText(term);
    if (!normalized)
        return false;
    return new RegExp(`(?:^|\\s|-)${escapeRegExp(normalized)}(?:$|\\s|-)`).test(text);
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
function extractSlots(normalized, now) {
    const slots = {};
    const yearMatch = normalized.match(/\b(20\d{2})\b/);
    if (yearMatch === null || yearMatch === void 0 ? void 0 : yearMatch[1])
        slots.birthYear = Number(yearMatch[1]);
    const ageMatch = normalized.match(/\b(?:ma|je mu|je ji|je)\s+(\d{1,2})\b/);
    if (ageMatch === null || ageMatch === void 0 ? void 0 : ageMatch[1])
        slots.childAge = Number(ageMatch[1]);
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
function scoreIntent(definition, normalized) {
    var _a, _b, _c, _d, _e;
    let evidence = 0;
    for (const example of (_a = definition.examples) !== null && _a !== void 0 ? _a : []) {
        const candidate = normalizeText(example);
        if (candidate && normalized === candidate)
            evidence += 120;
        else if (candidate && normalized.includes(candidate))
            evidence += 60;
    }
    for (const keyword of (_b = definition.keywords) !== null && _b !== void 0 ? _b : []) {
        if (includesTerm(normalized, keyword))
            evidence += 18;
    }
    for (const group of (_c = definition.keywordGroups) !== null && _c !== void 0 ? _c : []) {
        if (group.every((keyword) => includesTerm(normalized, keyword)))
            evidence += 55 + group.length * 5;
    }
    for (const pattern of (_d = definition.patterns) !== null && _d !== void 0 ? _d : []) {
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
    return evidence > 0 ? evidence + ((_e = definition.priority) !== null && _e !== void 0 ? _e : 0) : 0;
}
export class IntentEngine {
    constructor(definitions) {
        this.definitions = definitions.slice();
    }
    detect(text, context, now = new Date()) {
        var _a, _b;
        const normalizedText = normalizeText(text).slice(0, 2000);
        const slots = extractSlots(normalizedText, now);
        let best;
        let bestScore = 0;
        let followUp = false;
        for (const definition of this.definitions) {
            let score = scoreIntent(definition, normalizedText);
            const follows = Boolean(context.activeIntent && ((_a = definition.followUpFor) === null || _a === void 0 ? void 0 : _a.includes(context.activeIntent)));
            if (follows && (slots.childAge || slots.birthYear || slots.nextAge))
                score += 95;
            if (score > bestScore) {
                best = definition;
                bestScore = score;
                followUp = follows;
            }
        }
        if (!best || bestScore < ((_b = best.minScore) !== null && _b !== void 0 ? _b : 20)) {
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