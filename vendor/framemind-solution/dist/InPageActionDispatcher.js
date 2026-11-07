const CIRCLED_NUMERALS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];
const DEICTIC_SKIP_SELECTOR = '[data-chat-panel], [data-fm-ui], [data-fm-agent-ui], [data-fm-callout], [data-private], [data-sensitive], script, style, template, noscript';
const DEICTIC_STOP_WORDS = new Set(('a aby ale ani aspon az bez bude budou by bychom byla byli bylo byly co coz ' +
    'do ho i ja jak jaka jake jaky je jeho jeji jejich jsem jsi jsou jsme jste ' +
    'k kam kde kdo kdy kdyz ke kolik ktera ktere kteri ktery ku ma mam mame ' +
    'mate me mi mimo moje muj mu na nad nam nami nas nase ne nebo nechci ' +
    'neni nez ni nich nim nimi no o od on ona oni ono ony pak po pod podle ' +
    'pokud pro proc proti pred pres pri prosim s se si sice sve svuj sveho ' +
    'svym ta tak takej takze tam tato te tedy ten tento této teto tim to ' +
    'tohle tomuto tu tuto tvuj ty tyto u uz v vam vami vas vase ve vedle ' +
    'vice vsak vse vsechno vy z za ze zda zcela ' +
    'ukaz ukazte zobraz zobrazte oznac oznacte zvyrazni zvyraznete najdi najdete vyhledej ' +
    'kde pise pisete vetu veta odstavec cast sekce sekci strance stranka ' +
    'the a an is are in on of to for and or with show find highlight mark where').split(/\s+/));
export function foldDeicticText(value) {
    return String(value !== null && value !== void 0 ? value : '')
        .toLocaleLowerCase('cs-CZ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
export function minimumJerkProgress(t) {
    const tau = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
    const tau2 = tau * tau;
    const tau3 = tau2 * tau;
    return 10 * tau3 - 15 * tau3 * tau + 6 * tau3 * tau2;
}
export function minimumJerkVelocityFactor(t) {
    const tau = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
    const tau2 = tau * tau;
    return 30 * tau2 - 60 * tau2 * tau + 30 * tau2 * tau2;
}
export function computeMinimumJerkTrajectoryPoint(fromOrX0, toOrY0, tOrX1, maxArcOrY1 = 36, maybeT, maybeMaxArcPx = 36) {
    const from = typeof fromOrX0 === 'number'
        ? { x: fromOrX0, y: Number(toOrY0) }
        : fromOrX0;
    const to = typeof fromOrX0 === 'number'
        ? { x: tOrX1, y: maxArcOrY1 }
        : toOrY0;
    const t = typeof fromOrX0 === 'number' ? (maybeT !== null && maybeT !== void 0 ? maybeT : 0) : tOrX1;
    const maxArcPx = typeof fromOrX0 === 'number'
        ? (maybeMaxArcPx <= 1 ? Math.hypot(to.x - from.x, to.y - from.y) * maybeMaxArcPx : maybeMaxArcPx)
        : maxArcOrY1;
    const s = minimumJerkProgress(t);
    const v = minimumJerkVelocityFactor(t);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-3) {
        return { x: to.x, y: to.y, progress: s, velocityFactor: v };
    }
    // Perpendicular normal for subtle biological arm arc
    const nx = -dy / dist;
    const ny = dx / dist;
    const arcAmplitude = Math.min(maxArcPx, dist * 0.14);
    const arcOffset = 4 * s * (1 - s) * arcAmplitude;
    return {
        x: from.x + dx * s + nx * arcOffset,
        y: from.y + dy * s + ny * arcOffset,
        progress: s,
        velocityFactor: v,
    };
}
export const CROSS_PAGE_ACTION_STORAGE_KEY = 'framemind:pending_dom_action:v1';
const DEFAULT_CROSS_PAGE_TTL_MS = 15000;
const DEFAULT_INTERRUPT_EVENTS = ['wheel', 'pointerdown', 'touchstart', 'keydown'];
const DEFAULT_IGNORE_SELECTOR = '[data-chat-panel], #chatbot-tour-hud, .chatbot-tour-overlay, #chatbot-ghost-cursor, [data-fm-agent-ui]';
const SAFE_SELECTOR_REGEX = /^[a-zA-Z0-9_\-\.\#\s\[\]=\'\"*:,>+~]+$/;
export class InterruptWatcher {
    constructor() {
        this.active = false;
        this.listeners = [];
    }
    arm(onInterrupt, options = {}) {
        var _a, _b;
        this.disarm(options.scope);
        const win = typeof ((_a = options.scope) === null || _a === void 0 ? void 0 : _a.window) !== 'undefined'
            ? options.scope.window
            : (typeof globalThis.window !== 'undefined' ? globalThis.window : null);
        if (!win || typeof win.addEventListener !== 'function')
            return;
        const ignoreSelector = (_b = options.ignoreSelector) !== null && _b !== void 0 ? _b : DEFAULT_IGNORE_SELECTOR;
        this.active = true;
        const handler = (e) => {
            if (!this.active)
                return;
            const target = e === null || e === void 0 ? void 0 : e.target;
            if (target && typeof target.closest === 'function' && ignoreSelector) {
                try {
                    if (target.closest(ignoreSelector))
                        return;
                }
                catch { }
            }
            this.disarm(options.scope);
            try {
                onInterrupt(e);
            }
            catch { }
        };
        for (const eventName of DEFAULT_INTERRUPT_EVENTS) {
            win.addEventListener(eventName, handler, { capture: true, passive: true });
            this.listeners.push({ event: eventName, fn: handler });
        }
    }
    disarm(scope) {
        this.active = false;
        const win = typeof (scope === null || scope === void 0 ? void 0 : scope.window) !== 'undefined'
            ? scope.window
            : (typeof globalThis.window !== 'undefined' ? globalThis.window : null);
        if (win && typeof win.removeEventListener === 'function') {
            for (const { event, fn } of this.listeners) {
                try {
                    win.removeEventListener(event, fn, { capture: true });
                }
                catch { }
            }
        }
        this.listeners = [];
    }
    isArmed() {
        return this.active;
    }
}
export class InPageActionDispatcher {
    constructor() {
        this.activeTimers = new Map();
        this.chainTimers = new Set();
        this.homingTimers = new Set();
        this.calloutTimer = null;
        this.deicticTimer = null;
        this.activeDeicticElements = [];
        this.activeComparison = null;
        this.compareTimer = null;
        this.interruptWatcher = new InterruptWatcher();
    }
    getDocument(scope = globalThis) {
        var _a;
        if (typeof scope.document !== 'undefined')
            return scope.document;
        if (typeof ((_a = scope.window) === null || _a === void 0 ? void 0 : _a.document) !== 'undefined')
            return scope.window.document;
        return null;
    }
    getWindow(scope = globalThis) {
        var _a;
        if (typeof scope.window !== 'undefined')
            return scope.window;
        if (typeof ((_a = scope.document) === null || _a === void 0 ? void 0 : _a.defaultView) !== 'undefined')
            return scope.document.defaultView;
        return null;
    }
    getSessionStorage(scope = globalThis) {
        var _a;
        try {
            if (typeof scope.sessionStorage !== 'undefined')
                return scope.sessionStorage;
            if (typeof ((_a = scope.window) === null || _a === void 0 ? void 0 : _a.sessionStorage) !== 'undefined')
                return scope.window.sessionStorage;
            if (typeof globalThis.sessionStorage !== 'undefined')
                return globalThis.sessionStorage;
        }
        catch { }
        return null;
    }
    findTargetElement(target, scope) {
        if (typeof target !== 'string')
            return target;
        const doc = this.getDocument(scope);
        if (!doc)
            return null;
        const trimmed = target.trim();
        if (!trimmed)
            return null;
        // 1. If it's a direct ID without hash
        const directElem = doc.getElementById(trimmed.replace(/^#/, ''));
        if (directElem)
            return directElem;
        // 2. Validate CSS selector syntax safety before querySelector
        if (!SAFE_SELECTOR_REGEX.test(trimmed))
            return null;
        try {
            return doc.querySelector(trimmed);
        }
        catch {
            return null;
        }
    }
    unfoldAncestors(target, scope) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        if (!target)
            return { unfolded: false, steps: [] };
        const doc = this.getDocument(scope);
        const pendingSteps = [];
        let current = target;
        while (current) {
            const tag = (current.tagName || '').toUpperCase();
            if (tag === 'DETAILS') {
                const details = current;
                if (!details.open) {
                    const summary = (_a = (typeof details.querySelector === 'function' ? details.querySelector('summary') : null)) !== null && _a !== void 0 ? _a : details;
                    pendingSteps.unshift({ kind: 'details', container: details, trigger: summary });
                }
            }
            else {
                const role = (typeof current.getAttribute === 'function' ? current.getAttribute('role') : null) || '';
                const isHiddenAttr = typeof current.hasAttribute === 'function' && current.hasAttribute('hidden');
                const ariaHidden = typeof current.getAttribute === 'function' && current.getAttribute('aria-hidden') === 'true';
                const hasHiddenClass = (_d = (_c = (_b = current.classList) === null || _b === void 0 ? void 0 : _b.contains) === null || _c === void 0 ? void 0 : _c.call(_b, 'hidden')) !== null && _d !== void 0 ? _d : false;
                const id = (typeof current.getAttribute === 'function' ? current.getAttribute('id') : null) || current.id || '';
                if ((role === 'tabpanel' || isHiddenAttr || ariaHidden || hasHiddenClass) && id && doc && typeof doc.querySelector === 'function') {
                    let controller = null;
                    try {
                        controller =
                            (_g = (_f = (_e = doc.querySelector(`[role="tab"][aria-controls="${id}"]`)) !== null && _e !== void 0 ? _e : doc.querySelector(`[aria-controls="${id}"]`)) !== null && _f !== void 0 ? _f : doc.querySelector(`[data-tab="${id}"]`)) !== null && _g !== void 0 ? _g : doc.querySelector(`[data-tab-target="#${id}"]`);
                    }
                    catch { }
                    if (controller) {
                        const ctrlRole = (typeof controller.getAttribute === 'function' ? controller.getAttribute('role') : null) || '';
                        pendingSteps.unshift({
                            kind: ctrlRole === 'tab' ? 'tabpanel' : 'accordion',
                            container: current,
                            trigger: controller,
                        });
                    }
                }
            }
            current = (_h = current.parentElement) !== null && _h !== void 0 ? _h : null;
        }
        for (const step of pendingSteps) {
            if (step.kind === 'details') {
                step.container.open = true;
            }
            else {
                try {
                    if (typeof step.trigger.click === 'function') {
                        step.trigger.click();
                    }
                }
                catch { }
                try {
                    if (typeof step.container.removeAttribute === 'function') {
                        step.container.removeAttribute('hidden');
                    }
                    if (typeof step.container.setAttribute === 'function' && step.container.getAttribute('aria-hidden') === 'true') {
                        step.container.setAttribute('aria-hidden', 'false');
                    }
                    (_k = (_j = step.container.classList) === null || _j === void 0 ? void 0 : _j.remove) === null || _k === void 0 ? void 0 : _k.call(_j, 'hidden');
                    if (typeof step.trigger.setAttribute === 'function') {
                        if (step.kind === 'tabpanel')
                            step.trigger.setAttribute('aria-selected', 'true');
                        step.trigger.setAttribute('aria-expanded', 'true');
                    }
                }
                catch { }
            }
            this.dispatchCustomEvent('framemind:unfold', { kind: step.kind }, step.container, scope);
        }
        return {
            unfolded: pendingSteps.length > 0,
            steps: pendingSteps,
        };
    }
    highlightElement(target, options = {}, scope) {
        var _a, _b, _c, _d, _e;
        const elem = this.findTargetElement(target, scope);
        if (!elem)
            return false;
        if (options.autoUnfold !== false) {
            this.unfoldAncestors(elem, scope);
        }
        const pulseClass = (_a = options.pulseClass) !== null && _a !== void 0 ? _a : 'fm-highlight-pulse';
        const durationMs = (_b = options.durationMs) !== null && _b !== void 0 ? _b : 2500;
        const shouldScroll = (_c = options.scroll) !== null && _c !== void 0 ? _c : true;
        // Clear existing timer if element was already highlighted
        const existingTimer = this.activeTimers.get(elem);
        if (existingTimer) {
            clearTimeout(existingTimer);
            this.activeTimers.delete(elem);
        }
        elem.classList.add(pulseClass);
        if (shouldScroll && typeof elem.scrollIntoView === 'function') {
            elem.scrollIntoView({
                behavior: (_d = options.scrollBehavior) !== null && _d !== void 0 ? _d : 'smooth',
                block: (_e = options.scrollBlock) !== null && _e !== void 0 ? _e : 'center',
            });
        }
        if (options.calloutLabel) {
            this.showFovealCallout(elem, options.calloutLabel, { durationMs }, scope);
        }
        const timer = setTimeout(() => {
            elem.classList.remove(pulseClass);
            this.activeTimers.delete(elem);
        }, durationMs);
        this.activeTimers.set(elem, timer);
        return true;
    }
    scrollTo(target, options = {}, scope) {
        var _a, _b, _c, _d, _e, _f;
        const win = this.getWindow(scope);
        if (!win)
            return false;
        if (typeof target === 'number') {
            win.scrollTo({
                top: target + ((_a = options.offset) !== null && _a !== void 0 ? _a : 0),
                behavior: (_b = options.behavior) !== null && _b !== void 0 ? _b : 'smooth',
            });
            return true;
        }
        const elem = this.findTargetElement(target, scope);
        if (!elem)
            return false;
        if (options.offset) {
            const rect = (_c = elem.getBoundingClientRect) === null || _c === void 0 ? void 0 : _c.call(elem);
            const currentScrollY = (_d = win.scrollY) !== null && _d !== void 0 ? _d : 0;
            if (rect) {
                win.scrollTo({
                    top: currentScrollY + rect.top + options.offset,
                    behavior: (_e = options.behavior) !== null && _e !== void 0 ? _e : 'smooth',
                });
                return true;
            }
        }
        if (typeof elem.scrollIntoView === 'function') {
            elem.scrollIntoView({
                behavior: (_f = options.behavior) !== null && _f !== void 0 ? _f : 'smooth',
                block: 'start',
            });
            return true;
        }
        return false;
    }
    clickElement(target, options = {}, scope) {
        const elem = this.findTargetElement(target, scope);
        if (!elem)
            return false;
        if (options.autoUnfold !== false) {
            this.unfoldAncestors(elem, scope);
        }
        if (options.scroll !== false && typeof elem.scrollIntoView === 'function') {
            elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        const tagName = (elem.tagName || '').toUpperCase();
        const detailsParent = tagName === 'DETAILS'
            ? elem
            : (typeof elem.closest === 'function' ? elem.closest('details') : null);
        if (detailsParent) {
            detailsParent.open = true;
        }
        else if (typeof elem.click === 'function') {
            elem.click();
        }
        else {
            this.dispatchCustomEvent('click', {}, elem, scope);
        }
        if (options.highlight !== false) {
            const hlOpts = { scroll: false, autoUnfold: false };
            if (options.pulseClass !== undefined)
                hlOpts.pulseClass = options.pulseClass;
            if (options.durationMs !== undefined)
                hlOpts.durationMs = options.durationMs;
            if (options.calloutLabel !== undefined)
                hlOpts.calloutLabel = options.calloutLabel;
            this.highlightElement(elem, hlOpts, scope);
        }
        return true;
    }
    fillField(target, value, options = {}, scope) {
        const elem = this.findTargetElement(target, scope);
        if (!elem || typeof value !== 'string')
            return false;
        if (options.autoUnfold !== false) {
            this.unfoldAncestors(elem, scope);
        }
        if (options.scroll !== false && typeof elem.scrollIntoView === 'function') {
            elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        try {
            if (typeof elem.focus === 'function')
                elem.focus();
            elem.value = value;
            this.dispatchCustomEvent('input', { value }, elem, scope);
            this.dispatchCustomEvent('change', { value }, elem, scope);
        }
        catch {
            return false;
        }
        if (options.highlight !== false) {
            const hlOpts = { scroll: false, autoUnfold: false };
            if (options.pulseClass !== undefined)
                hlOpts.pulseClass = options.pulseClass;
            if (options.durationMs !== undefined)
                hlOpts.durationMs = options.durationMs;
            this.highlightElement(elem, hlOpts, scope);
        }
        return true;
    }
    collectTextNodes(root, includeHidden, doc, win) {
        const out = [];
        const isAllowedElement = (el) => {
            var _a, _b;
            if (!el)
                return false;
            if (typeof el.closest === 'function') {
                try {
                    if (el.closest(DEICTIC_SKIP_SELECTOR))
                        return false;
                }
                catch { }
            }
            const tag = (el.tagName || '').toUpperCase();
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEMPLATE')
                return false;
            if (!includeHidden) {
                let cur = el;
                while (cur && cur !== root.parentElement) {
                    const curTag = (cur.tagName || '').toUpperCase();
                    if (curTag === 'DETAILS' && !cur.open) {
                        const inSummary = typeof el.closest === 'function' && Boolean(el.closest('summary'));
                        if (!inSummary)
                            return false;
                    }
                    if (typeof cur.hasAttribute === 'function' && cur.hasAttribute('hidden'))
                        return false;
                    const style = (_a = win === null || win === void 0 ? void 0 : win.getComputedStyle) === null || _a === void 0 ? void 0 : _a.call(win, cur);
                    if (style && (style.display === 'none' || style.visibility === 'hidden'))
                        return false;
                    cur = (_b = cur.parentElement) !== null && _b !== void 0 ? _b : null;
                }
            }
            return true;
        };
        if (doc && typeof doc.createTreeWalker === 'function') {
            try {
                const walker = doc.createTreeWalker(root, 4);
                for (let n = walker.nextNode(); n; n = walker.nextNode()) {
                    const parent = n.parentElement;
                    if (parent && isAllowedElement(parent)) {
                        out.push({ node: n, element: parent });
                    }
                }
                if (out.length > 0)
                    return out;
            }
            catch { }
        }
        // Fallback recursive traversal for lightweight/mock DOM environments
        const visit = (node, parentEl) => {
            var _a, _b;
            if (!node)
                return;
            if (node.nodeType === 3 || (typeof node.nodeValue === 'string' && !node.tagName)) {
                if (isAllowedElement(parentEl)) {
                    out.push({ node: node, element: parentEl });
                }
                return;
            }
            const asEl = node.tagName ? node : parentEl;
            if (node.tagName && !isAllowedElement(asEl))
                return;
            const children = (_b = (_a = node.childNodes) !== null && _a !== void 0 ? _a : node.children) !== null && _b !== void 0 ? _b : [];
            if (Array.isArray(children) || typeof children.length === 'number') {
                for (let i = 0; i < children.length; i++) {
                    visit(children[i], asEl);
                }
            }
            else if (typeof node.textContent === 'string' && node.textContent.trim() && node === root) {
                out.push({ node: { nodeValue: node.textContent }, element: asEl });
            }
        };
        visit(root, root);
        return out;
    }
    buildDeicticTextMap(root, options = {}) {
        var _a, _b;
        const doc = this.getDocument(options.scope);
        const win = this.getWindow(options.scope);
        const includeHidden = (_a = options.includeHidden) !== null && _a !== void 0 ? _a : true;
        const textNodes = this.collectTextNodes(root, includeHidden, doc, win);
        const chars = [];
        const positions = [];
        let prevElement = null;
        for (const { node, element } of textNodes) {
            if (prevElement && prevElement !== element && chars.length > 0 && chars[chars.length - 1] !== ' ') {
                const lastPos = positions[positions.length - 1];
                if (lastPos) {
                    chars.push(' ');
                    positions.push({ node: lastPos.node, start: lastPos.end, end: lastPos.end, element: lastPos.element });
                }
            }
            prevElement = element;
            const raw = (_b = node.nodeValue) !== null && _b !== void 0 ? _b : '';
            let offset = 0;
            for (const ch of raw) {
                const nextOffset = offset + ch.length;
                const folded = ch
                    .toLocaleLowerCase('cs-CZ')
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '');
                for (const part of folded) {
                    const norm = /\s/.test(part) ? ' ' : part;
                    if (norm === ' ' && (chars.length === 0 || chars[chars.length - 1] === ' '))
                        continue;
                    chars.push(norm);
                    positions.push({ node, start: offset, end: nextOffset, element });
                }
                offset = nextOffset;
            }
        }
        return { text: chars.join(''), positions };
    }
    createDeicticMatch(doc, root, map, startIdx, endIdx, score) {
        var _a, _b;
        if (startIdx < 0 || endIdx <= startIdx)
            return null;
        const firstPos = map.positions[startIdx];
        const lastPos = map.positions[endIdx - 1];
        if (!firstPos || !lastPos)
            return null;
        let range = null;
        let excerpt = '';
        if (doc && typeof doc.createRange === 'function') {
            try {
                const r = doc.createRange();
                r.setStart(firstPos.node, firstPos.start);
                r.setEnd(lastPos.node, lastPos.end);
                range = r;
                excerpt = r.toString().replace(/\s+/g, ' ').trim();
            }
            catch { }
        }
        if (!excerpt) {
            excerpt = map.text.slice(startIdx, endIdx).trim();
        }
        if (!excerpt)
            return null;
        const baseElem = firstPos.element || root;
        const subElement = (_a = (typeof baseElem.closest === 'function'
            ? baseElem.closest('td, th, li, p, h1, h2, h3, h4, dt, dd, summary, button, a, blockquote, [data-i18n]')
            : null)) !== null && _a !== void 0 ? _a : baseElem;
        const containerElement = (_b = (typeof subElement.closest === 'function'
            ? subElement.closest('article, tr, details, section, .card, .price-card')
            : null)) !== null && _b !== void 0 ? _b : subElement;
        return {
            range,
            excerpt,
            foldedExcerpt: foldDeicticText(excerpt),
            subElement,
            containerElement,
            score,
            unfoldedSteps: [],
        };
    }
    findDeicticTextMatch(queryOrQuote, options = {}, scope) {
        var _a, _b, _c, _d, _e, _f, _g;
        const doc = this.getDocument(scope);
        if (!doc)
            return null;
        const root = typeof options.root === 'string'
            ? this.findTargetElement(options.root, scope)
            : ((_c = (_a = options.root) !== null && _a !== void 0 ? _a : (typeof doc.querySelector === 'function' ? ((_b = doc.querySelector('main')) !== null && _b !== void 0 ? _b : doc.body) : doc.body)) !== null && _c !== void 0 ? _c : null);
        if (!root)
            return null;
        const rawInput = String(queryOrQuote !== null && queryOrQuote !== void 0 ? queryOrQuote : '').trim();
        if (!rawInput)
            return null;
        const quoted = (_e = (_d = rawInput.match(/[„“"]([^„“"]{3,240})[“”"]/)) === null || _d === void 0 ? void 0 : _d[1]) === null || _e === void 0 ? void 0 : _e.trim();
        const foldedTarget = foldDeicticText(quoted || rawInput);
        if (!foldedTarget)
            return null;
        const mapOpts = {
            includeHidden: (_f = options.includeHidden) !== null && _f !== void 0 ? _f : true,
        };
        if (scope !== undefined)
            mapOpts.scope = scope;
        const map = this.buildDeicticTextMap(root, mapOpts);
        if (!map.text)
            return null;
        // 1. Direct substring or quoted phrase match (highest precision)
        const exactIdx = map.text.indexOf(foldedTarget);
        if (exactIdx >= 0 && foldedTarget.length >= 3) {
            const exactMatch = this.createDeicticMatch(doc, root, map, exactIdx, exactIdx + foldedTarget.length, 1200 + foldedTarget.length);
            if (exactMatch)
                return exactMatch;
        }
        // 2. Sentence-level granular scoring by content words & numeric tokens
        const queryWords = foldedTarget
            .replace(/[^a-z0-9]+/g, ' ')
            .split(' ')
            .filter((w) => w.length >= 2 && !DEICTIC_STOP_WORDS.has(w));
        if (queryWords.length === 0)
            return null;
        const minScore = (_g = options.minScore) !== null && _g !== void 0 ? _g : 80;
        let bestMatch = null;
        const sentenceRegex = /[^.!?;\n]+(?:[.!?](?=\s|$)|$)/g;
        let m;
        while ((m = sentenceRegex.exec(map.text)) !== null) {
            const sentenceText = m[0];
            const sStart = m.index;
            const sEnd = sStart + sentenceText.length;
            const candidateWords = sentenceText
                .replace(/[^a-z0-9]+/g, ' ')
                .split(' ')
                .filter((w) => w.length >= 2 && !DEICTIC_STOP_WORDS.has(w));
            if (candidateWords.length === 0)
                continue;
            let hits = 0;
            let numericBonus = 0;
            for (const qw of queryWords) {
                const isNum = /^\d+$/.test(qw);
                const matched = candidateWords.some((cw) => {
                    if (cw === qw)
                        return true;
                    if (isNum)
                        return false;
                    if (qw.length >= 5 && cw.length >= 5) {
                        const prefixLen = Math.min(qw.length, cw.length) - 2;
                        return prefixLen >= 4 && cw.slice(0, prefixLen) === qw.slice(0, prefixLen);
                    }
                    return false;
                });
                if (matched) {
                    hits++;
                    if (isNum)
                        numericBonus += 65;
                }
            }
            const requiredHits = queryWords.length <= 2 ? queryWords.length : Math.ceil(queryWords.length * 0.65);
            if (hits < requiredHits)
                continue;
            const score = hits * 110 + numericBonus - Math.max(0, candidateWords.length - hits) * 2;
            if (score >= minScore && (!bestMatch || score > bestMatch.score)) {
                const candidate = this.createDeicticMatch(doc, root, map, sStart, sEnd, score);
                if (candidate)
                    bestMatch = candidate;
            }
        }
        return bestMatch;
    }
    clearDeicticHighlights(highlightName = 'framemind-source', scope) {
        var _a, _b, _c, _d, _e;
        if (this.deicticTimer) {
            clearTimeout(this.deicticTimer);
            this.deicticTimer = null;
        }
        const win = this.getWindow(scope);
        try {
            (_c = (_b = (_a = win === null || win === void 0 ? void 0 : win.CSS) === null || _a === void 0 ? void 0 : _a.highlights) === null || _b === void 0 ? void 0 : _b.delete) === null || _c === void 0 ? void 0 : _c.call(_b, highlightName);
        }
        catch { }
        for (const el of this.activeDeicticElements) {
            (_e = (_d = el.classList) === null || _d === void 0 ? void 0 : _d.remove) === null || _e === void 0 ? void 0 : _e.call(_d, 'fm-deictic-subelement', 'fm-highlight-pulse', 'fm-source-section');
        }
        this.activeDeicticElements = [];
    }
    highlightTextRange(queryOrQuote, options = {}, scope) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        const searchOpts = {
            includeHidden: (_a = options.includeHidden) !== null && _a !== void 0 ? _a : true,
        };
        if (options.root !== undefined)
            searchOpts.root = options.root;
        if (options.minScore !== undefined)
            searchOpts.minScore = options.minScore;
        const match = this.findDeicticTextMatch(queryOrQuote, searchOpts, scope);
        if (!match)
            return null;
        const highlightName = (_b = options.highlightName) !== null && _b !== void 0 ? _b : 'framemind-source';
        this.clearDeicticHighlights(highlightName, scope);
        if (options.autoUnfold !== false) {
            const unfoldRes = this.unfoldAncestors(match.subElement, scope);
            match.unfoldedSteps = unfoldRes.steps;
            // Re-create range if unfolding changed layout or text visibility
            if (unfoldRes.unfolded) {
                const refreshed = this.findDeicticTextMatch(queryOrQuote, { ...searchOpts, includeHidden: false }, scope);
                if (refreshed === null || refreshed === void 0 ? void 0 : refreshed.range) {
                    match.range = refreshed.range;
                }
            }
        }
        const win = this.getWindow(scope);
        if (match.range && ((_c = win === null || win === void 0 ? void 0 : win.CSS) === null || _c === void 0 ? void 0 : _c.highlights) && typeof win.Highlight === 'function') {
            try {
                win.CSS.highlights.set(highlightName, new win.Highlight(match.range));
            }
            catch { }
        }
        const subClass = (_d = options.subElementClass) !== null && _d !== void 0 ? _d : 'fm-deictic-subelement';
        const containerClass = (_e = options.containerClass) !== null && _e !== void 0 ? _e : 'fm-highlight-pulse';
        (_g = (_f = match.subElement.classList) === null || _f === void 0 ? void 0 : _f.add) === null || _g === void 0 ? void 0 : _g.call(_f, subClass);
        this.activeDeicticElements.push(match.subElement);
        if (match.containerElement && match.containerElement !== match.subElement) {
            (_j = (_h = match.containerElement.classList) === null || _h === void 0 ? void 0 : _h.add) === null || _j === void 0 ? void 0 : _j.call(_h, containerClass);
            this.activeDeicticElements.push(match.containerElement);
        }
        else {
            (_l = (_k = match.subElement.classList) === null || _k === void 0 ? void 0 : _k.add) === null || _l === void 0 ? void 0 : _l.call(_k, containerClass);
        }
        if (options.scroll !== false && typeof match.subElement.scrollIntoView === 'function') {
            const reduceMotion = (_o = (_m = win === null || win === void 0 ? void 0 : win.matchMedia) === null || _m === void 0 ? void 0 : _m.call(win, '(prefers-reduced-motion: reduce)')) === null || _o === void 0 ? void 0 : _o.matches;
            match.subElement.scrollIntoView({
                behavior: reduceMotion ? 'auto' : 'smooth',
                block: 'center',
            });
        }
        const durationMs = (_p = options.durationMs) !== null && _p !== void 0 ? _p : 4000;
        if (options.calloutLabel) {
            this.showFovealCallout((_q = match.range) !== null && _q !== void 0 ? _q : match.subElement, options.calloutLabel, { durationMs }, scope);
        }
        if (durationMs > 0) {
            this.deicticTimer = setTimeout(() => {
                this.deicticTimer = null;
                this.clearDeicticHighlights(highlightName, scope);
            }, durationMs);
        }
        this.dispatchCustomEvent('framemind:source-mark', { active: true, excerpt: match.excerpt, unfolded: match.unfoldedSteps.length > 0 }, undefined, scope);
        return match;
    }
    groundEvidenceInDom(answerText, options = {}, scope) {
        const raw = String(answerText !== null && answerText !== void 0 ? answerText : '').trim();
        if (!raw)
            return null;
        const candidates = [];
        // 1. Explicit quoted spans
        const quoteMatches = raw.match(/[„“"]([^„“"]{4,140})[“”"]/g);
        if (quoteMatches) {
            for (const q of quoteMatches) {
                candidates.push(q.replace(/^[„“"]|[“”"]$/g, '').trim());
            }
        }
        // 2. Price / time / category anchors (e.g. "4 990 Kč", "16:30", "U-9")
        const anchorRegex = /\b(?:\d{1,3}(?:\s?\d{3})*\s*(?:Kč|CZK|EUR|€)|\d{1,2}:\d{2}|U-\d{1,2})\b/gi;
        let anchorMatch;
        while ((anchorMatch = anchorRegex.exec(raw)) !== null) {
            candidates.push(anchorMatch[0]);
        }
        // 3. Individual sentences of the answer
        const sentences = raw
            .split(/(?<=[.!?])\s+/)
            .map((s) => s.trim())
            .filter((s) => s.length >= 12);
        candidates.push(...sentences);
        for (const candidate of candidates) {
            const match = this.highlightTextRange(candidate, options, scope);
            if (match)
                return match;
        }
        return null;
    }
    homingLockToElement(target, options = {}, scope) {
        var _a, _b, _c, _d, _e, _f;
        const elem = this.findTargetElement(target, scope);
        if (!elem)
            return { cancel: () => { } };
        if (options.autoUnfold !== false) {
            this.unfoldAncestors(elem, scope);
        }
        if (options.scroll !== false && typeof elem.scrollIntoView === 'function') {
            elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        const getRect = () => {
            var _a;
            const r = (_a = elem.getBoundingClientRect) === null || _a === void 0 ? void 0 : _a.call(elem);
            if (r && typeof r.left === 'number' && typeof r.top === 'number') {
                return { left: r.left, top: r.top, width: r.width || 0, height: r.height || 0 };
            }
            return { left: 0, top: 0, width: 0, height: 0 };
        };
        const initialRect = getRect();
        const initialCenter = {
            x: initialRect.left + initialRect.width / 2,
            y: initialRect.top + initialRect.height / 2,
        };
        const startPoint = (_a = options.from) !== null && _a !== void 0 ? _a : (typeof options.startX === 'number' && typeof options.startY === 'number'
            ? { x: options.startX, y: options.startY }
            : {
                x: Math.max(24, initialCenter.x - 140),
                y: Math.max(24, initialCenter.y + 110),
            });
        const durationMs = Math.max(16, (_b = options.durationMs) !== null && _b !== void 0 ? _b : 360);
        const frameIntervalMs = Math.max(8, (_c = options.frameIntervalMs) !== null && _c !== void 0 ? _c : 16);
        const maxWaitMs = Math.max(durationMs, (_d = options.maxWaitMs) !== null && _d !== void 0 ? _d : durationMs + 320);
        const stabilityThresholdPx = (_e = options.stabilityThresholdPx) !== null && _e !== void 0 ? _e : 0.8;
        const maxArcPx = (_f = options.maxArcPx) !== null && _f !== void 0 ? _f : 36;
        let elapsed = 0;
        let prevRect = initialRect;
        let cancelled = false;
        let currentTimer = null;
        const cancel = () => {
            if (cancelled)
                return;
            cancelled = true;
            if (currentTimer) {
                clearTimeout(currentTimer);
                this.homingTimers.delete(currentTimer);
                currentTimer = null;
            }
        };
        const stepFrame = () => {
            var _a, _b, _c;
            if (cancelled)
                return;
            elapsed += frameIntervalMs;
            const tau = Math.min(1, elapsed / durationMs);
            const liveRect = getRect();
            const liveCenter = {
                x: liveRect.left + liveRect.width / 2,
                y: liveRect.top + liveRect.height / 2,
            };
            const deltaShift = Math.hypot(liveRect.left - prevRect.left, liveRect.top - prevRect.top);
            prevRect = liveRect;
            const settled = tau >= 1 && deltaShift <= stabilityThresholdPx;
            const traj = computeMinimumJerkTrajectoryPoint(startPoint, liveCenter, tau, maxArcPx);
            // In final homing phase (tau >= 0.75), blend directly onto live center to eliminate scroll drift
            const homingBlend = tau >= 0.75 ? (tau - 0.75) / 0.25 : 0;
            const x = traj.x * (1 - homingBlend) + liveCenter.x * homingBlend;
            const y = traj.y * (1 - homingBlend) + liveCenter.y * homingBlend;
            (_a = options.onFrame) === null || _a === void 0 ? void 0 : _a.call(options, {
                x,
                y,
                progress: traj.progress,
                velocityFactor: traj.velocityFactor,
                settled,
                targetRect: liveRect,
            });
            if (settled || elapsed >= maxWaitMs) {
                cancelled = true;
                if (options.clickOnLock) {
                    this.clickElement(elem, { highlight: true, scroll: false }, scope);
                }
                if (options.calloutLabel) {
                    this.showFovealCallout(elem, options.calloutLabel, {}, scope);
                }
                const lockPayload = {
                    x: liveCenter.x,
                    y: liveCenter.y,
                    element: elem,
                    rect: liveRect,
                };
                (_b = options.onLocked) === null || _b === void 0 ? void 0 : _b.call(options, lockPayload);
                (_c = options.onLock) === null || _c === void 0 ? void 0 : _c.call(options, lockPayload);
                return;
            }
            currentTimer = setTimeout(stepFrame, frameIntervalMs);
            this.homingTimers.add(currentTimer);
        };
        currentTimer = setTimeout(stepFrame, frameIntervalMs);
        this.homingTimers.add(currentTimer);
        return { cancel };
    }
    showFovealCallout(target, labelOrOptions, optionsOrScope, maybeScope) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
        const isLabelString = typeof labelOrOptions === 'string';
        const options = isLabelString
            ? ((_a = optionsOrScope) !== null && _a !== void 0 ? _a : {})
            : (labelOrOptions !== null && labelOrOptions !== void 0 ? labelOrOptions : {});
        const scope = isLabelString ? maybeScope : optionsOrScope;
        const label = isLabelString ? labelOrOptions : ((_b = options.label) !== null && _b !== void 0 ? _b : '');
        const doc = this.getDocument(scope);
        const win = this.getWindow(scope);
        if (!doc || !label.trim())
            return null;
        this.clearFovealCallout(scope);
        const rect = typeof (target === null || target === void 0 ? void 0 : target.getBoundingClientRect) === 'function'
            ? target.getBoundingClientRect()
            : { left: 24, top: 80, bottom: 112, width: 120, height: 32 };
        const preferred = (_c = options.preferredPlacement) !== null && _c !== void 0 ? _c : 'top';
        const topSpace = typeof (rect === null || rect === void 0 ? void 0 : rect.top) === 'number' ? rect.top : 80;
        const placement = preferred === 'top' && topSpace < 52 ? 'bottom' : preferred;
        const viewportW = (_d = win === null || win === void 0 ? void 0 : win.innerWidth) !== null && _d !== void 0 ? _d : 1280;
        const rawLeft = (typeof (rect === null || rect === void 0 ? void 0 : rect.left) === 'number' ? rect.left : 24) + (((_e = rect === null || rect === void 0 ? void 0 : rect.width) !== null && _e !== void 0 ? _e : 0) / 2) - 90;
        const clampedLeft = Math.max(12, Math.min(viewportW - 220, Math.round(rawLeft)));
        const topPx = placement === 'top'
            ? Math.max(8, Math.round(((_f = rect === null || rect === void 0 ? void 0 : rect.top) !== null && _f !== void 0 ? _f : 80) - 36))
            : Math.round(((_g = rect === null || rect === void 0 ? void 0 : rect.bottom) !== null && _g !== void 0 ? _g : (((_h = rect === null || rect === void 0 ? void 0 : rect.top) !== null && _h !== void 0 ? _h : 80) + ((_j = rect === null || rect === void 0 ? void 0 : rect.height) !== null && _j !== void 0 ? _j : 32))) + 8);
        const text = options.badgePrefix ? `${options.badgePrefix} ${label.trim()}` : label.trim();
        let calloutEl = null;
        if (typeof doc.createElement === 'function') {
            try {
                calloutEl = doc.createElement('div');
                calloutEl.id = 'fm-foveal-callout';
                (_k = calloutEl.setAttribute) === null || _k === void 0 ? void 0 : _k.call(calloutEl, 'data-fm-callout', 'true');
                (_l = calloutEl.setAttribute) === null || _l === void 0 ? void 0 : _l.call(calloutEl, 'data-fm-agent-ui', 'true');
                (_m = calloutEl.setAttribute) === null || _m === void 0 ? void 0 : _m.call(calloutEl, 'data-fm-placement', placement);
                (_o = calloutEl.setAttribute) === null || _o === void 0 ? void 0 : _o.call(calloutEl, 'data-placement', placement);
                (_p = calloutEl.setAttribute) === null || _p === void 0 ? void 0 : _p.call(calloutEl, 'role', 'status');
                (_q = calloutEl.setAttribute) === null || _q === void 0 ? void 0 : _q.call(calloutEl, 'aria-live', 'polite');
                calloutEl.textContent = text;
                if (calloutEl.style) {
                    calloutEl.style.position = 'fixed';
                    calloutEl.style.left = `${clampedLeft}px`;
                    calloutEl.style.top = `${topPx}px`;
                    calloutEl.style.zIndex = '2147483646';
                    calloutEl.style.pointerEvents = 'none';
                }
                (_s = (_r = doc.body) === null || _r === void 0 ? void 0 : _r.appendChild) === null || _s === void 0 ? void 0 : _s.call(_r, calloutEl);
            }
            catch { }
        }
        const durationMs = (_t = options.durationMs) !== null && _t !== void 0 ? _t : 3200;
        if (durationMs > 0) {
            this.calloutTimer = setTimeout(() => {
                this.calloutTimer = null;
                this.clearFovealCallout(scope);
            }, durationMs);
        }
        return calloutEl;
    }
    clearFovealCallout(scope) {
        var _a, _b, _c;
        if (this.calloutTimer) {
            clearTimeout(this.calloutTimer);
            this.calloutTimer = null;
        }
        const doc = this.getDocument(scope);
        try {
            const existing = (_a = doc === null || doc === void 0 ? void 0 : doc.getElementById) === null || _a === void 0 ? void 0 : _a.call(doc, 'fm-foveal-callout');
            if (existing) {
                if (typeof existing.remove === 'function')
                    existing.remove();
                else
                    (_c = (_b = existing.parentElement) === null || _b === void 0 ? void 0 : _b.removeChild) === null || _c === void 0 ? void 0 : _c.call(_b, existing);
            }
        }
        catch { }
    }
    compareElements(inputs, options = {}, scope) {
        var _a;
        this.clearComparison(scope);
        const resolved = [];
        inputs.forEach((input, idx) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            const itemObj = typeof input === 'string' || (typeof input === 'object' && input !== null && !('target' in input) && !('selector' in input))
                ? { target: input }
                : input;
            const rawTarget = (_a = itemObj.target) !== null && _a !== void 0 ? _a : itemObj.selector;
            if (!rawTarget)
                return;
            let elem = this.findTargetElement(rawTarget, scope);
            if (!elem && typeof rawTarget === 'string') {
                const deictic = this.findDeicticTextMatch(rawTarget, { includeHidden: true }, scope);
                elem = (_c = (_b = deictic === null || deictic === void 0 ? void 0 : deictic.containerElement) !== null && _b !== void 0 ? _b : deictic === null || deictic === void 0 ? void 0 : deictic.subElement) !== null && _c !== void 0 ? _c : null;
            }
            if (!elem)
                return;
            if (options.autoUnfold !== false) {
                this.unfoldAncestors(elem, scope);
            }
            const badge = (_e = (_d = itemObj.badge) !== null && _d !== void 0 ? _d : CIRCLED_NUMERALS[idx]) !== null && _e !== void 0 ? _e : `(${idx + 1})`;
            const label = (_f = itemObj.label) !== null && _f !== void 0 ? _f : ((elem.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48) || `Položka ${idx + 1}`);
            (_h = (_g = elem.classList) === null || _g === void 0 ? void 0 : _g.add) === null || _h === void 0 ? void 0 : _h.call(_g, 'fm-compare-target');
            (_j = elem.setAttribute) === null || _j === void 0 ? void 0 : _j.call(elem, 'data-fm-compare-badge', badge);
            (_k = elem.setAttribute) === null || _k === void 0 ? void 0 : _k.call(elem, 'data-fm-compare-index', String(idx));
            resolved.push({ element: elem, badge, label });
        });
        const focus = (activeIdx) => {
            var _a;
            const targetItem = resolved[activeIdx];
            if (!targetItem)
                return false;
            resolved.forEach((item, idx) => {
                var _a, _b, _c, _d, _e, _f, _g, _h;
                if (idx === activeIdx) {
                    (_b = (_a = item.element.classList) === null || _a === void 0 ? void 0 : _a.add) === null || _b === void 0 ? void 0 : _b.call(_a, 'fm-compare-active', 'fm-highlight-pulse');
                    (_d = (_c = item.element.classList) === null || _c === void 0 ? void 0 : _c.remove) === null || _d === void 0 ? void 0 : _d.call(_c, 'fm-compare-standby');
                }
                else {
                    (_f = (_e = item.element.classList) === null || _e === void 0 ? void 0 : _e.remove) === null || _f === void 0 ? void 0 : _f.call(_e, 'fm-compare-active', 'fm-highlight-pulse');
                    (_h = (_g = item.element.classList) === null || _g === void 0 ? void 0 : _g.add) === null || _h === void 0 ? void 0 : _h.call(_g, 'fm-compare-standby');
                }
            });
            if (typeof targetItem.element.scrollIntoView === 'function') {
                targetItem.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            this.showFovealCallout(targetItem.element, targetItem.label, { badgePrefix: targetItem.badge, durationMs: (_a = options.durationMs) !== null && _a !== void 0 ? _a : 4500 }, scope);
            return true;
        };
        const clear = () => {
            var _a, _b, _c, _d, _e, _f;
            if (this.compareTimer) {
                clearTimeout(this.compareTimer);
                this.compareTimer = null;
            }
            for (const item of resolved) {
                (_b = (_a = item.element.classList) === null || _a === void 0 ? void 0 : _a.remove) === null || _b === void 0 ? void 0 : _b.call(_a, 'fm-compare-target', 'fm-compare-active', 'fm-compare-standby', 'fm-highlight-pulse');
                (_d = (_c = item.element).removeAttribute) === null || _d === void 0 ? void 0 : _d.call(_c, 'data-fm-compare-badge');
                (_f = (_e = item.element).removeAttribute) === null || _f === void 0 ? void 0 : _f.call(_e, 'data-fm-compare-index');
            }
            this.clearFovealCallout(scope);
            this.activeComparison = null;
        };
        const handle = {
            items: resolved,
            focus,
            focusItem: focus,
            clear,
        };
        this.activeComparison = handle;
        if (resolved.length > 0 && options.scrollFirst !== false) {
            focus(0);
        }
        const durationMs = (_a = options.durationMs) !== null && _a !== void 0 ? _a : 5000;
        if (durationMs > 0 && resolved.length > 0) {
            this.compareTimer = setTimeout(() => {
                this.compareTimer = null;
                clear();
            }, durationMs);
        }
        return handle;
    }
    activateComparativeFocus(index, _scope) {
        if (!this.activeComparison)
            return false;
        return this.activeComparison.focus(index);
    }
    clearComparison(scope) {
        if (this.activeComparison) {
            this.activeComparison.clear();
            this.activeComparison = null;
        }
        else if (this.compareTimer) {
            clearTimeout(this.compareTimer);
            this.compareTimer = null;
            this.clearFovealCallout(scope);
        }
    }
    dispatchCustomEvent(eventName, detail = {}, target, scope) {
        var _a, _b;
        const win = this.getWindow(scope);
        const doc = this.getDocument(scope);
        if (!win && !doc)
            return false;
        const eventTarget = (_a = target !== null && target !== void 0 ? target : win) !== null && _a !== void 0 ? _a : doc;
        if (!eventTarget || typeof eventTarget.dispatchEvent !== 'function')
            return false;
        try {
            const CustomEventClass = (_b = win === null || win === void 0 ? void 0 : win.CustomEvent) !== null && _b !== void 0 ? _b : globalThis.CustomEvent;
            const event = new CustomEventClass(eventName, {
                bubbles: true,
                cancelable: true,
                detail,
            });
            return eventTarget.dispatchEvent(event);
        }
        catch {
            return false;
        }
    }
    resolveActionTarget(action, scope) {
        const selector = action.args.selector || action.args.target || action.args.id || action.args.anchor;
        if (!selector)
            return null;
        return this.findTargetElement(selector, scope);
    }
    dispatchAction(action, scope) {
        var _a;
        switch (action.tool) {
            case 'highlight_element':
            case 'inspect_item': {
                const selector = action.args.selector || action.args.target || action.args.id;
                if (!selector)
                    return false;
                return this.highlightElement(selector, {}, scope);
            }
            case 'scroll_to': {
                const target = action.args.target || action.args.selector || action.args.anchor;
                if (!target)
                    return false;
                return this.scrollTo(target, {}, scope);
            }
            case 'click_element':
            case 'switch_tab':
            case 'open_accordion': {
                const selector = action.args.selector || action.args.target || action.args.id;
                if (!selector)
                    return false;
                return this.clickElement(selector, {}, scope);
            }
            case 'fill_field': {
                const selector = action.args.selector || action.args.target || action.args.id || action.args.field;
                const value = (_a = action.args.value) !== null && _a !== void 0 ? _a : '';
                if (!selector)
                    return false;
                return this.fillField(selector, value, {}, scope);
            }
            case 'highlight_range': {
                const query = action.args.query || action.args.text || action.args.snippet || action.args.target || action.args.selector;
                if (!query)
                    return false;
                const opts = {};
                const rootArg = action.args.rootSelector || action.args.root;
                if (rootArg)
                    opts.root = rootArg;
                const match = this.highlightTextRange(query, opts, scope);
                return Boolean(match);
            }
            case 'compare_elements': {
                const rawTargets = action.args.targets || [action.args.first, action.args.second].filter(Boolean).join('|');
                const parts = String(rawTargets)
                    .split('|')
                    .map((item) => item.trim())
                    .filter(Boolean);
                if (parts.length < 2)
                    return false;
                const handle = this.compareElements(parts, {}, scope);
                return Boolean(handle);
            }
            default: {
                // Broadcast custom event for framework listeners
                return this.dispatchCustomEvent(`framemind:action:${action.tool}`, action.args, undefined, scope);
            }
        }
    }
    runActionChain(stepsInput, options = {}) {
        var _a, _b;
        this.cancelActionChain(options.scope);
        const steps = stepsInput.map((item) => 'action' in item ? item : { action: item });
        if (steps.length === 0) {
            return { cancel: () => { } };
        }
        const defaultStepDelayMs = (_a = options.defaultStepDelayMs) !== null && _a !== void 0 ? _a : 320;
        const defaultSettleMs = (_b = options.defaultSettleMs) !== null && _b !== void 0 ? _b : 420;
        let cancelled = false;
        const cancelAll = () => {
            if (cancelled)
                return;
            cancelled = true;
            for (const timer of this.chainTimers) {
                clearTimeout(timer);
            }
            this.chainTimers.clear();
            this.interruptWatcher.disarm(options.scope);
        };
        const watcherOpts = {};
        if (options.ignoreInterruptSelector !== undefined)
            watcherOpts.ignoreSelector = options.ignoreInterruptSelector;
        if (options.scope !== undefined)
            watcherOpts.scope = options.scope;
        this.interruptWatcher.arm(() => {
            var _a;
            cancelAll();
            (_a = options.onInterrupted) === null || _a === void 0 ? void 0 : _a.call(options);
        }, watcherOpts);
        let cumulativeDelay = 0;
        steps.forEach((step, index) => {
            var _a, _b;
            const stepDelay = index === 0 ? ((_a = step.delayMs) !== null && _a !== void 0 ? _a : 0) : ((_b = step.delayMs) !== null && _b !== void 0 ? _b : defaultStepDelayMs);
            cumulativeDelay += stepDelay;
            const execTimer = setTimeout(() => {
                var _a, _b, _c;
                this.chainTimers.delete(execTimer);
                if (cancelled)
                    return;
                const target = this.resolveActionTarget(step.action, options.scope);
                (_a = options.onStep) === null || _a === void 0 ? void 0 : _a.call(options, step, target, index);
                this.dispatchAction(step.action, options.scope);
                if (target && options.onPointTarget) {
                    const settle = (_b = step.settleMs) !== null && _b !== void 0 ? _b : defaultSettleMs;
                    const pointTimer = setTimeout(() => {
                        var _a;
                        this.chainTimers.delete(pointTimer);
                        if (cancelled)
                            return;
                        (_a = options.onPointTarget) === null || _a === void 0 ? void 0 : _a.call(options, target, step, index);
                    }, settle);
                    this.chainTimers.add(pointTimer);
                }
                if (index === steps.length - 1) {
                    const disarmTimer = setTimeout(() => {
                        this.chainTimers.delete(disarmTimer);
                        this.interruptWatcher.disarm(options.scope);
                    }, ((_c = step.settleMs) !== null && _c !== void 0 ? _c : defaultSettleMs) + 250);
                    this.chainTimers.add(disarmTimer);
                }
            }, cumulativeDelay);
            this.chainTimers.add(execTimer);
        });
        return { cancel: cancelAll };
    }
    cancelActionChain(scope) {
        for (const timer of this.chainTimers) {
            clearTimeout(timer);
        }
        this.chainTimers.clear();
        this.interruptWatcher.disarm(scope);
    }
    scheduleCrossPageAction(payload, scope) {
        var _a, _b, _c;
        const storage = this.getSessionStorage(scope);
        if (!storage || !((_a = payload === null || payload === void 0 ? void 0 : payload.action) === null || _a === void 0 ? void 0 : _a.tool))
            return false;
        try {
            const record = {
                action: payload.action,
                createdAt: (_b = payload.createdAt) !== null && _b !== void 0 ? _b : Date.now(),
                ttlMs: (_c = payload.ttlMs) !== null && _c !== void 0 ? _c : DEFAULT_CROSS_PAGE_TTL_MS,
                ...(payload.targetPath !== undefined ? { targetPath: payload.targetPath } : {}),
                ...(payload.caption !== undefined ? { caption: payload.caption } : {}),
            };
            storage.setItem(CROSS_PAGE_ACTION_STORAGE_KEY, JSON.stringify(record));
            return true;
        }
        catch {
            return false;
        }
    }
    consumeCrossPageAction(currentPathname, scope, now = Date.now()) {
        var _a, _b, _c, _d, _e, _f;
        const storage = this.getSessionStorage(scope);
        if (!storage)
            return null;
        try {
            const raw = storage.getItem(CROSS_PAGE_ACTION_STORAGE_KEY);
            if (!raw)
                return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || !((_a = parsed.action) === null || _a === void 0 ? void 0 : _a.tool)) {
                storage.removeItem(CROSS_PAGE_ACTION_STORAGE_KEY);
                return null;
            }
            const ttl = (_b = parsed.ttlMs) !== null && _b !== void 0 ? _b : DEFAULT_CROSS_PAGE_TTL_MS;
            if (typeof parsed.createdAt === 'number' && now - parsed.createdAt > ttl) {
                storage.removeItem(CROSS_PAGE_ACTION_STORAGE_KEY);
                return null;
            }
            if (parsed.targetPath && currentPathname) {
                const cleanTarget = ((_d = ((_c = parsed.targetPath.split('#')[0]) !== null && _c !== void 0 ? _c : '').split('?')[0]) === null || _d === void 0 ? void 0 : _d.replace(/\/+$/, '')) || '/';
                const cleanCurrent = ((_f = ((_e = currentPathname.split('#')[0]) !== null && _e !== void 0 ? _e : '').split('?')[0]) === null || _f === void 0 ? void 0 : _f.replace(/\/+$/, '')) || '/';
                if (cleanTarget !== cleanCurrent) {
                    return null;
                }
            }
            storage.removeItem(CROSS_PAGE_ACTION_STORAGE_KEY);
            return parsed;
        }
        catch {
            try {
                storage.removeItem(CROSS_PAGE_ACTION_STORAGE_KEY);
            }
            catch { }
            return null;
        }
    }
    cleanup(scope) {
        this.cancelActionChain(scope);
        for (const [elem, timer] of this.activeTimers) {
            clearTimeout(timer);
            elem.classList.remove('fm-highlight-pulse');
        }
        this.activeTimers.clear();
        for (const timer of this.homingTimers) {
            clearTimeout(timer);
        }
        this.homingTimers.clear();
        this.clearDeicticHighlights(undefined, scope);
        this.clearComparison(scope);
        this.clearFovealCallout(scope);
    }
}
//# sourceMappingURL=InPageActionDispatcher.js.map