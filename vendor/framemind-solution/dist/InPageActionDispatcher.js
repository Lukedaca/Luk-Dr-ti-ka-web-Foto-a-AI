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
    highlightElement(target, options = {}, scope) {
        var _a, _b, _c, _d, _e;
        const elem = this.findTargetElement(target, scope);
        if (!elem)
            return false;
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
            const hlOpts = { scroll: false };
            if (options.pulseClass !== undefined)
                hlOpts.pulseClass = options.pulseClass;
            if (options.durationMs !== undefined)
                hlOpts.durationMs = options.durationMs;
            this.highlightElement(elem, hlOpts, scope);
        }
        return true;
    }
    fillField(target, value, options = {}, scope) {
        const elem = this.findTargetElement(target, scope);
        if (!elem || typeof value !== 'string')
            return false;
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
            const hlOpts = { scroll: false };
            if (options.pulseClass !== undefined)
                hlOpts.pulseClass = options.pulseClass;
            if (options.durationMs !== undefined)
                hlOpts.durationMs = options.durationMs;
            this.highlightElement(elem, hlOpts, scope);
        }
        return true;
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
    }
}
//# sourceMappingURL=InPageActionDispatcher.js.map