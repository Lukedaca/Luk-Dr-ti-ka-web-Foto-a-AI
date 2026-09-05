const CZECH_MONTHS = {
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
//# sourceMappingURL=text.js.map