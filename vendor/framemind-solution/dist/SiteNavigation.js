const MAX_TARGET_LENGTH = 320;
function isHostMatchingApex(hostname, apex) {
    const host = hostname.toLowerCase().replace(/\.$/, '');
    const cleanApex = apex.toLowerCase().replace(/\.$/, '');
    return host === cleanApex || host.endsWith(`.${cleanApex}`);
}
export function normalizeNavTarget(value, baseOrigin = 'https://framemind.invalid', allowedApex) {
    const raw = String(value !== null && value !== void 0 ? value : '').trim();
    if (!raw || raw.length > MAX_TARGET_LENGTH || /[\u0000-\u001f]/.test(raw))
        return null;
    if (raw.includes('/..') || raw.includes('../') || raw.split('/').includes('..'))
        return null;
    // Relative paths without apex restriction
    if (raw.startsWith('/') && !raw.startsWith('//') && !/[?#\\]/.test(raw)) {
        return raw;
    }
    let url;
    try {
        url = new URL(raw, baseOrigin);
    }
    catch {
        return null;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:')
        return null;
    // Disallow insecure HTTP unless local test origin
    if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1')
        return null;
    if (allowedApex) {
        if (!isHostMatchingApex(url.hostname, allowedApex))
            return null;
        const cleanApex = allowedApex.toLowerCase().replace(/\.$/, '');
        const host = url.hostname.toLowerCase();
        if (host === cleanApex || host === `www.${cleanApex}`) {
            const path = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
            return `${path}${url.search}${url.hash}`;
        }
    }
    else {
        // If no apex restriction, allow same origin or relative paths
        try {
            const base = new URL(baseOrigin);
            if (url.origin === base.origin) {
                const path = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
                return `${path}${url.search}${url.hash}`;
            }
        }
        catch { }
    }
    return url.href;
}
export function sanitizeNavLinks(raw, maxLinks = 160, normalizer) {
    if (!Array.isArray(raw))
        return [];
    const seen = new Set();
    const out = [];
    const normalize = normalizer !== null && normalizer !== void 0 ? normalizer : ((p) => normalizeNavTarget(p));
    for (const item of raw) {
        if (!item || typeof item.path !== 'string')
            continue;
        const path = normalize(item.path);
        if (!path || path === '/' || path.startsWith('/embed') || seen.has(path))
            continue;
        const label = typeof item.label === 'string'
            ? item.label.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
            : '';
        if (!label)
            continue;
        seen.add(path);
        out.push({ label, path });
        if (out.length >= maxLinks)
            break;
    }
    return out;
}
export function normalizeNavText(value) {
    return String(value !== null && value !== void 0 ? value : '')
        .toLocaleLowerCase('cs-CZ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\be[\s-]*shop(?=[a-z]*\b)/g, 'eshop')
        .replace(/\bu[\s-]+(\d{1,2})\b/g, 'u$1')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
const DEFAULT_STOP_WORDS = new Set([
    'a', 'aby', 'ale', 'by', 'bych', 'chci', 'chtel', 'chtela', 'chteli', 'do', 'doved', 'dovedte',
    'je', 'ja', 'ji', 'jsem', 'k', 'kam', 'co', 'jak', 'jaka', 'jake', 'jaky', 'kde', 'kdo', 'kdy',
    'kolik', 'klub', 'klubu', 'klubovy', 'ma', 'mate', 'mi', 'me', 'mohl', 'mohla', 'muze', 'muzete',
    'myslel', 'myslela', 'na', 'nabizi', 'nabidka', 'nabidce', 'nabidku', 'o', 'najdi', 'najde', 'najdes',
    'najdete', 'nam', 'naviguj', 'navigujte', 'odkaz', 'otevri', 'otevrit', 'otevrete', 'prosim',
    'prehled', 'prejdi', 'prejdete', 'se', 'sekce', 'sekci', 'stoji', 'stranka', 'stranku', 'ukaz',
    'ukazat', 'ukazte', 'tam', 'uvnitr', 'v', 've', 'vsechno', 'web', 'webu', 'zobraz', 'zobrazit',
    'zobrazte', 'proklikni', 'prokliknete', 'sroluj', 'srolujte', 'scrolluj', 'scrollujte',
    'menu', 'to', 'ten', 'ta', 'ty', 'tom', 'tomu', 'tento', 'tuto', 'tahle',
    'videt', 'otevrit', 'prejit', 'prohlidnout', 'najit',
]);
const DEFAULT_TOKEN_ALIASES = {
    obchod: 'eshop',
    fanshop: 'eshop',
    shop: 'eshop',
    merch: 'eshop',
    fotky: 'galerie',
    fotografie: 'galerie',
    foto: 'galerie',
    galerii: 'galerie',
    cenik: 'cenik',
    ceny: 'cenik',
    tarify: 'cenik',
};
function meaningfulTokens(value, aliases = DEFAULT_TOKEN_ALIASES, stopWords = DEFAULT_STOP_WORDS) {
    return normalizeNavText(value)
        .split(' ')
        .map((token) => aliases[token] || token)
        .filter((token) => token && !stopWords.has(token) && (token.length >= 2 || /^\d+$/.test(token)));
}
function tokenMatches(query, candidate) {
    if (query === candidate)
        return true;
    if (query.length < 4 || candidate.length < 4)
        return false;
    if (query.startsWith(candidate) || candidate.startsWith(query))
        return true;
    let shared = 0;
    while (shared < query.length && shared < candidate.length && query[shared] === candidate[shared])
        shared += 1;
    return shared >= 5 && shared >= Math.min(query.length, candidate.length) - 2;
}
export function hasExplicitUiActionIntent(value) {
    const text = normalizeNavText(value);
    return /\b(otevri|otevrete|ukaz|ukazte|prejdi|prejdete|doved|dovedte|naviguj|navigujte|proklikni|prokliknete|zobraz|zobrazte|sroluj|srolujte|scrolluj|scrollujte|rozbal|rozbalte)\b/.test(text)
        || /^(?:prosim\s+)?(?:najdi|najdete)\b/.test(text)
        || /\bchci\b.{0,20}\b(videt|otevrit|prejit)\b/.test(text);
}
export function findSiteLinkIntent(userText, siteLinks, options) {
    var _a, _b;
    const queryText = normalizeNavText(userText);
    const aliases = (options === null || options === void 0 ? void 0 : options.aliases) ? { ...DEFAULT_TOKEN_ALIASES, ...options.aliases } : DEFAULT_TOKEN_ALIASES;
    const stopWords = (_a = options === null || options === void 0 ? void 0 : options.stopWords) !== null && _a !== void 0 ? _a : DEFAULT_STOP_WORDS;
    const queryTokens = meaningfulTokens(userText, aliases, stopWords);
    if (!queryText || queryTokens.length === 0 || !Array.isArray(siteLinks))
        return null;
    const normalize = (_b = options === null || options === void 0 ? void 0 : options.normalizer) !== null && _b !== void 0 ? _b : ((p) => normalizeNavTarget(p));
    let best = null;
    let bestScore = -1;
    for (const link of siteLinks) {
        const path = normalize(link === null || link === void 0 ? void 0 : link.path);
        const label = typeof (link === null || link === void 0 ? void 0 : link.label) === 'string' ? link.label.trim() : '';
        if (!path || !label)
            continue;
        const labelText = normalizeNavText(label);
        const candidateTokens = meaningfulTokens(`${label} ${path}`, aliases, stopWords);
        const everyTokenMatches = queryTokens.every((query) => candidateTokens.some((candidate) => tokenMatches(query, candidate)));
        if (!everyTokenMatches)
            continue;
        let score = 50 + queryTokens.length * 10;
        if (labelText && queryText.includes(labelText))
            score += 100 + labelText.length;
        if (queryTokens.length === candidateTokens.length)
            score += 5;
        if (score > bestScore) {
            bestScore = score;
            best = { label, path };
        }
    }
    return best;
}
export function findSiteMenuIntent(userText, siteMenus, options) {
    var _a;
    const queryText = normalizeNavText(userText);
    const aliases = (options === null || options === void 0 ? void 0 : options.aliases) ? { ...DEFAULT_TOKEN_ALIASES, ...options.aliases } : DEFAULT_TOKEN_ALIASES;
    const stopWords = (_a = options === null || options === void 0 ? void 0 : options.stopWords) !== null && _a !== void 0 ? _a : DEFAULT_STOP_WORDS;
    const queryTokens = meaningfulTokens(userText, aliases, stopWords);
    if (!queryText || !Array.isArray(siteMenus))
        return null;
    const wantsMenu = /\b(?:menu|nabidk\w*|rozcestnik\w*|polozk\w*|podsekc\w*|sekc\w*)\b/.test(queryText)
        || /\b(?:otevr\w*|ukaz\w*|rozbal\w*|zobraz\w*)\b/.test(queryText);
    if (!wantsMenu)
        return null;
    if (/\b(?:moje|muj|me|vlastni)\s+projekt\w*/.test(queryText)
        && !/\bklub\w*/.test(queryText))
        return null;
    let best = null;
    let bestScore = -1;
    for (const menu of siteMenus) {
        const label = typeof (menu === null || menu === void 0 ? void 0 : menu.label) === 'string' ? menu.label.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
        const links = sanitizeNavLinks(menu === null || menu === void 0 ? void 0 : menu.links, 50, options === null || options === void 0 ? void 0 : options.normalizer);
        if (!label || links.length === 0)
            continue;
        const labelText = normalizeNavText(label);
        const labelTokens = meaningfulTokens(label, aliases, stopWords);
        const directLabelMatch = Boolean(labelText && queryText.includes(labelText));
        const everyTokenMatches = queryTokens.length > 0
            && queryTokens.every((query) => labelTokens.some((candidate) => tokenMatches(query, candidate)));
        const menuTokens = labelTokens.concat(links.flatMap((link) => meaningfulTokens(link.label, aliases, stopWords)));
        const uncovered = queryTokens.filter((query) => !menuTokens.some((candidate) => tokenMatches(query, candidate)));
        if (!everyTokenMatches && (!directLabelMatch || uncovered.length > 0))
            continue;
        let score = 50 + queryTokens.length * 10;
        if (directLabelMatch)
            score += 100 + labelText.length;
        if (queryTokens.length === labelTokens.length)
            score += 5;
        if (score > bestScore) {
            bestScore = score;
            best = { label, links };
        }
    }
    return best;
}
export function collectDomSiteLinks(rootDoc, options) {
    var _a, _b, _c, _d, _e;
    try {
        const doc = rootDoc !== null && rootDoc !== void 0 ? rootDoc : (typeof document !== 'undefined' ? document : null);
        if (!doc || typeof doc.querySelectorAll !== 'function')
            return [];
        const seen = new Set();
        const out = [];
        const max = (_a = options === null || options === void 0 ? void 0 : options.maxLinks) !== null && _a !== void 0 ? _a : 160;
        const normalize = (_b = options === null || options === void 0 ? void 0 : options.normalizer) !== null && _b !== void 0 ? _b : ((p) => normalizeNavTarget(p));
        const anchors = Array.from(doc.querySelectorAll('a[href]'));
        for (const a of anchors) {
            const raw = (((_c = a.getAttribute) === null || _c === void 0 ? void 0 : _c.call(a, 'href')) || a.href || '').trim();
            const path = normalize(raw);
            if (!path || path === '/' || path.startsWith('/embed') || seen.has(path))
                continue;
            const label = (a.textContent || ((_d = a.getAttribute) === null || _d === void 0 ? void 0 : _d.call(a, 'aria-label')) || ((_e = a.getAttribute) === null || _e === void 0 ? void 0 : _e.call(a, 'title')) || '')
                .trim()
                .replace(/\s+/g, ' ')
                .slice(0, 80);
            if (!label || label.length < 2)
                continue;
            seen.add(path);
            out.push({ label, path });
            if (out.length >= max)
                break;
        }
        return out;
    }
    catch {
        return [];
    }
}
export function collectDomSiteMenus(rootDoc, options) {
    var _a, _b, _c, _d;
    try {
        const doc = rootDoc !== null && rootDoc !== void 0 ? rootDoc : (typeof document !== 'undefined' ? document : null);
        if (!doc || typeof doc.querySelectorAll !== 'function')
            return [];
        const triggers = Array.from(doc.querySelectorAll('.nav-item-top, nav span, .nav-item > span, .nav-item > a, [data-menu-trigger]'));
        const out = [];
        const seen = new Set();
        const normalize = (_a = options === null || options === void 0 ? void 0 : options.normalizer) !== null && _a !== void 0 ? _a : ((p) => normalizeNavTarget(p));
        for (const trigger of triggers) {
            const label = (trigger.textContent || '')
                .replace(/[>›▼▲]/g, ' ')
                .trim()
                .replace(/\s+/g, ' ')
                .slice(0, 80);
            const key = label.toLocaleLowerCase('cs-CZ');
            if (!label || label.length < 2 || seen.has(key))
                continue;
            const container = ((_b = trigger.closest) === null || _b === void 0 ? void 0 : _b.call(trigger, '.nav-item, li, div')) || trigger.parentElement;
            const anchors = container ? Array.from(container.querySelectorAll('a[href]')) : [];
            const links = [];
            const seenPaths = new Set();
            for (const a of anchors) {
                const raw = (((_c = a.getAttribute) === null || _c === void 0 ? void 0 : _c.call(a, 'href')) || a.href || '').trim();
                const path = normalize(raw);
                if (!path || path === '/' || seenPaths.has(path))
                    continue;
                const linkLabel = (a.textContent || ((_d = a.getAttribute) === null || _d === void 0 ? void 0 : _d.call(a, 'aria-label')) || '')
                    .trim()
                    .replace(/\s+/g, ' ')
                    .slice(0, 80);
                if (!linkLabel)
                    continue;
                seenPaths.add(path);
                links.push({ label: linkLabel, path });
            }
            if (links.length > 0) {
                seen.add(key);
                out.push({ label, links });
            }
        }
        return out;
    }
    catch {
        return [];
    }
}
export class PendingNavigationManager {
    constructor() {
        this.pending = null;
        this.timer = null;
        this.onExecute = null;
        this.isVoiceActive = null;
    }
    schedule(action, onExecute, isVoiceActive, failsafeMs = 4000) {
        this.cancel();
        this.pending = action;
        this.onExecute = onExecute;
        this.isVoiceActive = isVoiceActive;
        const armFailsafe = () => {
            this.timer = setTimeout(() => {
                var _a;
                this.timer = null;
                if ((_a = this.isVoiceActive) === null || _a === void 0 ? void 0 : _a.call(this)) {
                    armFailsafe();
                    return;
                }
                this.flush();
            }, failsafeMs);
        };
        armFailsafe();
    }
    flush() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        const action = this.pending;
        const execute = this.onExecute;
        this.pending = null;
        this.onExecute = null;
        this.isVoiceActive = null;
        if (action && execute) {
            execute(action);
            return true;
        }
        return false;
    }
    cancel() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.pending = null;
        this.onExecute = null;
        this.isVoiceActive = null;
    }
    isPending() {
        return this.pending !== null;
    }
    getPending() {
        return this.pending;
    }
}
//# sourceMappingURL=SiteNavigation.js.map