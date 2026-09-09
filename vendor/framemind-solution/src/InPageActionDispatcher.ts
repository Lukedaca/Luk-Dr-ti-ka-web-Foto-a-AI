import type { ResolvedAction } from './types.js';

export interface HighlightOptions {
  pulseClass?: string;
  durationMs?: number;
  scroll?: boolean;
  scrollBehavior?: ScrollBehavior;
  scrollBlock?: ScrollLogicalPosition;
}

export interface ScrollOptions {
  behavior?: ScrollBehavior;
  offset?: number;
}

const SAFE_SELECTOR_REGEX = /^[a-zA-Z0-9_\-\.\#\s\[\]=\'\"*:,>+~]+$/;

export class InPageActionDispatcher {
  private activeTimers = new Map<Element, any>();

  private getDocument(scope: Record<string, any> = globalThis as Record<string, any>): Document | null {
    if (typeof scope.document !== 'undefined') return scope.document as Document;
    if (typeof scope.window?.document !== 'undefined') return scope.window.document as Document;
    return null;
  }

  private getWindow(scope: Record<string, any> = globalThis as Record<string, any>): Window | null {
    if (typeof scope.window !== 'undefined') return scope.window as Window;
    if (typeof scope.document?.defaultView !== 'undefined') return scope.document.defaultView as Window;
    return null;
  }

  findTargetElement(target: string | Element, scope?: Record<string, any>): Element | null {
    if (typeof target !== 'string') return target;
    const doc = this.getDocument(scope);
    if (!doc) return null;

    const trimmed = target.trim();
    if (!trimmed) return null;

    // 1. If it's a direct ID without hash
    const directElem = doc.getElementById(trimmed.replace(/^#/, ''));
    if (directElem) return directElem;

    // 2. Validate CSS selector syntax safety before querySelector
    if (!SAFE_SELECTOR_REGEX.test(trimmed)) return null;

    try {
      return doc.querySelector(trimmed);
    } catch {
      return null;
    }
  }

  highlightElement(
    target: string | Element,
    options: HighlightOptions = {},
    scope?: Record<string, any>,
  ): boolean {
    const elem = this.findTargetElement(target, scope);
    if (!elem) return false;

    const pulseClass = options.pulseClass ?? 'fm-highlight-pulse';
    const durationMs = options.durationMs ?? 2500;
    const shouldScroll = options.scroll ?? true;

    // Clear existing timer if element was already highlighted
    const existingTimer = this.activeTimers.get(elem);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.activeTimers.delete(elem);
    }

    elem.classList.add(pulseClass);

    if (shouldScroll && typeof elem.scrollIntoView === 'function') {
      elem.scrollIntoView({
        behavior: options.scrollBehavior ?? 'smooth',
        block: options.scrollBlock ?? 'center',
      });
    }

    const timer = setTimeout(() => {
      elem.classList.remove(pulseClass);
      this.activeTimers.delete(elem);
    }, durationMs);

    this.activeTimers.set(elem, timer);
    return true;
  }

  scrollTo(
    target: string | number | Element,
    options: ScrollOptions = {},
    scope?: Record<string, any>,
  ): boolean {
    const win = this.getWindow(scope);
    if (!win) return false;

    if (typeof target === 'number') {
      win.scrollTo({
        top: target + (options.offset ?? 0),
        behavior: options.behavior ?? 'smooth',
      });
      return true;
    }

    const elem = this.findTargetElement(target, scope);
    if (!elem) return false;

    if (options.offset) {
      const rect = elem.getBoundingClientRect?.();
      const currentScrollY = win.scrollY ?? 0;
      if (rect) {
        win.scrollTo({
          top: currentScrollY + rect.top + options.offset,
          behavior: options.behavior ?? 'smooth',
        });
        return true;
      }
    }

    if (typeof elem.scrollIntoView === 'function') {
      elem.scrollIntoView({
        behavior: options.behavior ?? 'smooth',
        block: 'start',
      });
      return true;
    }

    return false;
  }

  dispatchCustomEvent(
    eventName: string,
    detail: unknown = {},
    target?: EventTarget,
    scope?: Record<string, any>,
  ): boolean {
    const win = this.getWindow(scope);
    const doc = this.getDocument(scope);
    if (!win && !doc) return false;

    const eventTarget = target ?? win ?? doc;
    if (!eventTarget || typeof eventTarget.dispatchEvent !== 'function') return false;

    try {
      const CustomEventClass = (win as any)?.CustomEvent ?? (globalThis as any).CustomEvent;
      const event = new CustomEventClass(eventName, {
        bubbles: true,
        cancelable: true,
        detail,
      });
      return eventTarget.dispatchEvent(event);
    } catch {
      return false;
    }
  }

  dispatchAction(
    action: ResolvedAction,
    scope?: Record<string, any>,
  ): boolean {
    switch (action.tool) {
      case 'highlight_element': {
        const selector = action.args.selector || action.args.target || action.args.id;
        if (!selector) return false;
        return this.highlightElement(selector, {}, scope);
      }
      case 'scroll_to': {
        const target = action.args.target || action.args.selector || action.args.anchor;
        if (!target) return false;
        return this.scrollTo(target, {}, scope);
      }
      default: {
        // Broadcast custom event for framework listeners
        return this.dispatchCustomEvent(`framemind:action:${action.tool}`, action.args, undefined, scope);
      }
    }
  }

  cleanup(): void {
    for (const [elem, timer] of this.activeTimers) {
      clearTimeout(timer);
      elem.classList.remove('fm-highlight-pulse');
    }
    this.activeTimers.clear();
  }
}
