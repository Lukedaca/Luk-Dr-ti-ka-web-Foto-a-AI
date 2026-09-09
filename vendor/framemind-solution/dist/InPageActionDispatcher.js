const SAFE_SELECTOR_REGEX = /^[a-zA-Z0-9_\-\.\#\s\[\]=\'\"*:,>+~]+$/;
export class InPageActionDispatcher {
    constructor() {
        this.activeTimers = new Map();
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
    dispatchAction(action, scope) {
        switch (action.tool) {
            case 'highlight_element': {
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
            default: {
                // Broadcast custom event for framework listeners
                return this.dispatchCustomEvent(`framemind:action:${action.tool}`, action.args, undefined, scope);
            }
        }
    }
    cleanup() {
        for (const [elem, timer] of this.activeTimers) {
            clearTimeout(timer);
            elem.classList.remove('fm-highlight-pulse');
        }
        this.activeTimers.clear();
    }
}
//# sourceMappingURL=InPageActionDispatcher.js.map