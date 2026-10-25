const ANAPHORA_PRONOUNS_CS = new Set([
    'on', 'ona', 'ono', 'oni', 'ony',
    'to', 'ten', 'ta', 'ty', 'ti', 'toto', 'tento', 'tato',
    'jeho', 'jeji', 'jejich', 'jim', 'mu', 'ji', 'ho',
    'tam', 'tady', 'sem', 'odtud',
]);
const REPAIR_PREFIXES_CS = [
    /^ne\b[\s,]+/i,
    /^vlastne\b[\s,]+/i,
    /^myslel\s+(?:jsem|sme)\b/i,
    /^myslela\s+jsem\b/i,
    /^myslim\b/i,
    /^pardon\b[\s,]+/i,
    /^promin\b[\s,]+/i,
    /^oprava\b[\s,:]+/i,
];
function normalizeCzech(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}
export class DiscourseContext {
    constructor(options = {}) {
        var _a;
        this.turn = 0;
        this.activeEntity = null;
        this.recentEntities = [];
        this.lastIntent = null;
        this.lastQuery = '';
        this.lastReply = '';
        this.awaitingClarification = null;
        this.maxRecent = (_a = options.maxRecentEntities) !== null && _a !== void 0 ? _a : 8;
    }
    setEntity(type, name, data = {}) {
        const entity = {
            type: String(type || '').trim(),
            name: String(name || '').trim(),
            data: { ...data },
            turn: this.turn,
            timestamp: Date.now(),
        };
        this.activeEntity = entity;
        this.recentEntities = [
            entity,
            ...this.recentEntities.filter((e) => !(e.type === entity.type && e.name.toLowerCase() === entity.name.toLowerCase())),
        ].slice(0, this.maxRecent);
        return entity;
    }
    getEntity(type) {
        if (this.activeEntity && (!type || this.activeEntity.type === type)) {
            return this.activeEntity;
        }
        if (type) {
            return this.recentEntities.find((e) => e.type === type) || null;
        }
        return this.activeEntity;
    }
    clearEntity() {
        this.activeEntity = null;
    }
    setAwaitingClarification(clarification) {
        this.awaitingClarification = clarification;
    }
    clearAwaitingClarification() {
        this.awaitingClarification = null;
    }
    getAwaitingClarification() {
        return this.awaitingClarification;
    }
    advanceTurn(query = '', reply = '', intent) {
        this.turn += 1;
        this.lastQuery = query;
        this.lastReply = reply;
        if (intent)
            this.lastIntent = intent;
    }
    isAnaphoraQuery(query) {
        const clean = normalizeCzech(query);
        if (!clean)
            return false;
        // Short follow-up queries like "A cena?", "A kde?", "Kolik?"
        if (/^a\s+(?:cena|kolik|kde|kdy|jak|proc|kdo|rozpis|trener|vstupne|termin|adresa)\b/i.test(clean)) {
            return true;
        }
        if (/^(?:kolik|kde|kdy|jak)(?:\s+(?:vlastne|ted|pak|zase))?\s+(?:to|stoji|je|hraji|maji|sidli)\b/i.test(clean)) {
            return true;
        }
        const words = clean.split(/\s+/);
        return words.some((w) => ANAPHORA_PRONOUNS_CS.has(w));
    }
    isRepairQuery(query) {
        if (this.extractContrastiveRepair(query))
            return true;
        const clean = normalizeCzech(query);
        return REPAIR_PREFIXES_CS.some((regex) => regex.test(clean));
    }
    /**
     * Detects Third-Position Contrastive Repairs ("Ne X, ale Y", "Nechci X, chci Y",
     * "Chtěl jsem Y a ne X") and separates the desired positive target from the rejected one.
     * Pure negations without a replacement target ("Nechci sídlo klubu") return null.
     */
    extractContrastiveRepair(query) {
        const clean = normalizeCzech(query);
        if (!clean)
            return null;
        // Pattern 1: Pre-negation ("Ne X, ale Y" / "Nechci X, chci Y" / "Nemyslel jsem X, nýbrž Y")
        const preMatch = /^(?:ne|nechci|nehledam|nezajima\s+me|nemyslel\s+jsem|nemyslim)\s+([^,.;!?]+?)(?:,\s*(?:ale|nybrz|spis|radeji|chci|chtel\s+jsem|chtela\s+jsem|hledam|zajima\s+me|myslel\s+jsem|myslim)\s+|\s+(?:ale|nybrz)\s+)(.+)$/i.exec(clean);
        if ((preMatch === null || preMatch === void 0 ? void 0 : preMatch[1]) && (preMatch === null || preMatch === void 0 ? void 0 : preMatch[2])) {
            const rejected = preMatch[1].trim();
            const positive = preMatch[2]
                .replace(/^(?:(?:jsem|sme)\s+)?(?:myslel|chtel|chtela|myslela|myslim|chci|hledam|zajima\s+me)(?:\s+(?:jsem|sme))?\b[\s,:]*/i, '')
                .trim();
            if (positive.length >= 2 && rejected.length >= 2 && !/\b(?:nechci|nechtel|ne)\b/.test(positive)) {
                return { positiveTarget: positive, rejectedTarget: rejected };
            }
        }
        // Pattern 2: Post-negation ("Chtěl jsem Y a ne X" / "Myslel jsem Y, ne X")
        const postMatch = /^(.+?)(?:,\s*(?:a\s+ne|ale\s+ne|nikoliv|ne)\s+|\s+(?:a\s+ne|ale\s+ne|nikoliv)\s+)([^,.;!?]+)$/i.exec(clean);
        if ((postMatch === null || postMatch === void 0 ? void 0 : postMatch[1]) && (postMatch === null || postMatch === void 0 ? void 0 : postMatch[2])) {
            const rawPositive = postMatch[1].trim();
            const rejected = postMatch[2].trim();
            // Reject if the first clause is itself negated ("To ne, sídlo nechci")
            if (!/\b(?:nechci|nechtel|nechtela|nehledam|nezajima|^ne\b|^to\s+ne\b)/.test(rawPositive)) {
                const positive = rawPositive
                    .replace(/^(?:(?:jsem|sme)\s+)?(?:myslel|chtel|chtela|myslela|myslim|chci|hledam|zajima\s+me)(?:\s+(?:jsem|sme))?\b[\s,:]*/i, '')
                    .trim();
                if (positive.length >= 2 && rejected.length >= 2) {
                    return { positiveTarget: positive, rejectedTarget: rejected };
                }
            }
        }
        return null;
    }
    extractRepairSubject(query) {
        const contrastive = this.extractContrastiveRepair(query);
        if (contrastive)
            return contrastive.positiveTarget;
        const clean = normalizeCzech(query);
        if (/^(?:to\s+ne|ne\s*,?\s*to\s+ne)\b|\b(?:nechci|nechtel|nechtela)\b/.test(clean)) {
            return null;
        }
        for (const regex of REPAIR_PREFIXES_CS) {
            if (regex.test(clean)) {
                const remaining = clean
                    .replace(regex, '')
                    .replace(/^(?:(?:jsem|sme)\s+)?(?:myslel|chtel|chtela|myslela|myslim)(?:\s+(?:jsem|sme))?\b[\s,:]*/i, '')
                    .trim();
                return remaining || null;
            }
        }
        return null;
    }
    resolveSuggestions(intentId, profile) {
        var _a, _b, _c;
        if (!profile)
            return [];
        const lastNorm = normalizeCzech(this.lastQuery).replace(/[?!.]+$/g, '').trim();
        const filterSeen = (items) => items.filter((item) => normalizeCzech(item).replace(/[?!.]+$/g, '').trim() !== lastNorm).slice(0, 4);
        // 1. Check if active entity has custom follow-ups
        if (this.activeEntity && ((_a = profile.entities) === null || _a === void 0 ? void 0 : _a.length)) {
            const matchedEntity = profile.entities.find((e) => { var _a, _b; return e.type === ((_a = this.activeEntity) === null || _a === void 0 ? void 0 : _a.type) && e.name.toLowerCase() === ((_b = this.activeEntity) === null || _b === void 0 ? void 0 : _b.name.toLowerCase()); });
            if ((_b = matchedEntity === null || matchedEntity === void 0 ? void 0 : matchedEntity.suggestedFollowUps) === null || _b === void 0 ? void 0 : _b.length) {
                return filterSeen(matchedEntity.suggestedFollowUps);
            }
        }
        // 2. Check profile suggestedFollowUps by intentId
        if (profile.suggestedFollowUps && ((_c = profile.suggestedFollowUps[intentId]) === null || _c === void 0 ? void 0 : _c.length)) {
            return filterSeen(profile.suggestedFollowUps[intentId]);
        }
        return [];
    }
    snapshot() {
        return {
            turn: this.turn,
            activeEntity: this.activeEntity ? { ...this.activeEntity } : null,
            recentEntities: this.recentEntities.map((e) => ({ ...e })),
            lastIntent: this.lastIntent,
            lastQuery: this.lastQuery,
            lastReply: this.lastReply,
            awaitingClarification: this.awaitingClarification ? { ...this.awaitingClarification } : null,
        };
    }
    reset() {
        this.turn = 0;
        this.activeEntity = null;
        this.recentEntities = [];
        this.lastIntent = null;
        this.lastQuery = '';
        this.lastReply = '';
        this.awaitingClarification = null;
    }
}
//# sourceMappingURL=DiscourseContext.js.map