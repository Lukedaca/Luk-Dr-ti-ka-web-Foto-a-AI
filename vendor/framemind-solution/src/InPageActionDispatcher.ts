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

export interface ClickOptions {
  scroll?: boolean;
  highlight?: boolean;
  pulseClass?: string;
  durationMs?: number;
}

export interface FillFieldOptions {
  scroll?: boolean;
  highlight?: boolean;
  pulseClass?: string;
  durationMs?: number;
}

export interface ActionChainStep {
  action: ResolvedAction;
  delayMs?: number;
  settleMs?: number;
  caption?: string;
}

export interface ActionChainOptions {
  defaultStepDelayMs?: number;
  defaultSettleMs?: number;
  scope?: Record<string, any>;
  ignoreInterruptSelector?: string;
  onStep?: (step: ActionChainStep, target: Element | null, index: number) => void;
  onPointTarget?: (target: Element, step: ActionChainStep, index: number) => void;
  onInterrupted?: () => void;
}

export interface CrossPageActionPayload {
  targetPath?: string;
  action: ResolvedAction;
  caption?: string;
  createdAt: number;
  ttlMs?: number;
}

export const CROSS_PAGE_ACTION_STORAGE_KEY = 'framemind:pending_dom_action:v1';
const DEFAULT_CROSS_PAGE_TTL_MS = 15000;
const DEFAULT_INTERRUPT_EVENTS = ['wheel', 'pointerdown', 'touchstart', 'keydown'] as const;
const DEFAULT_IGNORE_SELECTOR = '[data-chat-panel], #chatbot-tour-hud, .chatbot-tour-overlay, #chatbot-ghost-cursor, [data-fm-agent-ui]';

const SAFE_SELECTOR_REGEX = /^[a-zA-Z0-9_\-\.\#\s\[\]=\'\"*:,>+~]+$/;

export class InterruptWatcher {
  private active = false;
  private listeners: Array<{ event: string; fn: (e: Event) => void }> = [];

  arm(
    onInterrupt: (event?: Event) => void,
    options: { ignoreSelector?: string; scope?: Record<string, any> } = {},
  ): void {
    this.disarm(options.scope);
    const win = typeof options.scope?.window !== 'undefined'
      ? options.scope.window
      : (typeof globalThis.window !== 'undefined' ? globalThis.window : null);
    if (!win || typeof win.addEventListener !== 'function') return;

    const ignoreSelector = options.ignoreSelector ?? DEFAULT_IGNORE_SELECTOR;
    this.active = true;

    const handler = (e: Event) => {
      if (!this.active) return;
      const target = e?.target as Element | null;
      if (target && typeof target.closest === 'function' && ignoreSelector) {
        try {
          if (target.closest(ignoreSelector)) return;
        } catch {}
      }
      this.disarm(options.scope);
      try {
        onInterrupt(e);
      } catch {}
    };

    for (const eventName of DEFAULT_INTERRUPT_EVENTS) {
      win.addEventListener(eventName, handler, { capture: true, passive: true });
      this.listeners.push({ event: eventName, fn: handler });
    }
  }

  disarm(scope?: Record<string, any>): void {
    this.active = false;
    const win = typeof scope?.window !== 'undefined'
      ? scope.window
      : (typeof globalThis.window !== 'undefined' ? globalThis.window : null);
    if (win && typeof win.removeEventListener === 'function') {
      for (const { event, fn } of this.listeners) {
        try {
          win.removeEventListener(event, fn, { capture: true });
        } catch {}
      }
    }
    this.listeners = [];
  }

  isArmed(): boolean {
    return this.active;
  }
}

export class InPageActionDispatcher {
  private activeTimers = new Map<Element, any>();
  private chainTimers = new Set<any>();
  private interruptWatcher = new InterruptWatcher();

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

  private getSessionStorage(scope: Record<string, any> = globalThis as Record<string, any>): Storage | null {
    try {
      if (typeof scope.sessionStorage !== 'undefined') return scope.sessionStorage as Storage;
      if (typeof scope.window?.sessionStorage !== 'undefined') return scope.window.sessionStorage as Storage;
      if (typeof globalThis.sessionStorage !== 'undefined') return globalThis.sessionStorage;
    } catch {}
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

  clickElement(
    target: string | Element,
    options: ClickOptions = {},
    scope?: Record<string, any>,
  ): boolean {
    const elem = this.findTargetElement(target, scope) as HTMLElement | null;
    if (!elem) return false;

    if (options.scroll !== false && typeof elem.scrollIntoView === 'function') {
      elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const tagName = (elem.tagName || '').toUpperCase();
    const detailsParent = tagName === 'DETAILS'
      ? (elem as HTMLDetailsElement)
      : (typeof elem.closest === 'function' ? (elem.closest('details') as HTMLDetailsElement | null) : null);

    if (detailsParent) {
      detailsParent.open = true;
    } else if (typeof elem.click === 'function') {
      elem.click();
    } else {
      this.dispatchCustomEvent('click', {}, elem, scope);
    }

    if (options.highlight !== false) {
      const hlOpts: HighlightOptions = { scroll: false };
      if (options.pulseClass !== undefined) hlOpts.pulseClass = options.pulseClass;
      if (options.durationMs !== undefined) hlOpts.durationMs = options.durationMs;
      this.highlightElement(elem, hlOpts, scope);
    }

    return true;
  }

  fillField(
    target: string | Element,
    value: string,
    options: FillFieldOptions = {},
    scope?: Record<string, any>,
  ): boolean {
    const elem = this.findTargetElement(target, scope) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!elem || typeof value !== 'string') return false;

    if (options.scroll !== false && typeof elem.scrollIntoView === 'function') {
      elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    try {
      if (typeof elem.focus === 'function') elem.focus();
      elem.value = value;
      this.dispatchCustomEvent('input', { value }, elem, scope);
      this.dispatchCustomEvent('change', { value }, elem, scope);
    } catch {
      return false;
    }

    if (options.highlight !== false) {
      const hlOpts: HighlightOptions = { scroll: false };
      if (options.pulseClass !== undefined) hlOpts.pulseClass = options.pulseClass;
      if (options.durationMs !== undefined) hlOpts.durationMs = options.durationMs;
      this.highlightElement(elem, hlOpts, scope);
    }

    return true;
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

  resolveActionTarget(
    action: ResolvedAction,
    scope?: Record<string, any>,
  ): Element | null {
    const selector = action.args.selector || action.args.target || action.args.id || action.args.anchor;
    if (!selector) return null;
    return this.findTargetElement(selector, scope);
  }

  dispatchAction(
    action: ResolvedAction,
    scope?: Record<string, any>,
  ): boolean {
    switch (action.tool) {
      case 'highlight_element':
      case 'inspect_item': {
        const selector = action.args.selector || action.args.target || action.args.id;
        if (!selector) return false;
        return this.highlightElement(selector, {}, scope);
      }
      case 'scroll_to': {
        const target = action.args.target || action.args.selector || action.args.anchor;
        if (!target) return false;
        return this.scrollTo(target, {}, scope);
      }
      case 'click_element':
      case 'switch_tab':
      case 'open_accordion': {
        const selector = action.args.selector || action.args.target || action.args.id;
        if (!selector) return false;
        return this.clickElement(selector, {}, scope);
      }
      case 'fill_field': {
        const selector = action.args.selector || action.args.target || action.args.id || action.args.field;
        const value = action.args.value ?? '';
        if (!selector) return false;
        return this.fillField(selector, value, {}, scope);
      }
      default: {
        // Broadcast custom event for framework listeners
        return this.dispatchCustomEvent(`framemind:action:${action.tool}`, action.args, undefined, scope);
      }
    }
  }

  runActionChain(
    stepsInput: Array<ResolvedAction | ActionChainStep>,
    options: ActionChainOptions = {},
  ): { cancel: () => void } {
    this.cancelActionChain(options.scope);
    const steps: ActionChainStep[] = stepsInput.map((item) =>
      'action' in item ? item : { action: item },
    );
    if (steps.length === 0) {
      return { cancel: () => {} };
    }

    const defaultStepDelayMs = options.defaultStepDelayMs ?? 320;
    const defaultSettleMs = options.defaultSettleMs ?? 420;
    let cancelled = false;

    const cancelAll = () => {
      if (cancelled) return;
      cancelled = true;
      for (const timer of this.chainTimers) {
        clearTimeout(timer);
      }
      this.chainTimers.clear();
      this.interruptWatcher.disarm(options.scope);
    };

    const watcherOpts: { ignoreSelector?: string; scope?: Record<string, any> } = {};
    if (options.ignoreInterruptSelector !== undefined) watcherOpts.ignoreSelector = options.ignoreInterruptSelector;
    if (options.scope !== undefined) watcherOpts.scope = options.scope;

    this.interruptWatcher.arm(
      () => {
        cancelAll();
        options.onInterrupted?.();
      },
      watcherOpts,
    );

    let cumulativeDelay = 0;
    steps.forEach((step, index) => {
      const stepDelay = index === 0 ? (step.delayMs ?? 0) : (step.delayMs ?? defaultStepDelayMs);
      cumulativeDelay += stepDelay;

      const execTimer = setTimeout(() => {
        this.chainTimers.delete(execTimer);
        if (cancelled) return;
        const target = this.resolveActionTarget(step.action, options.scope);
        options.onStep?.(step, target, index);
        this.dispatchAction(step.action, options.scope);

        if (target && options.onPointTarget) {
          const settle = step.settleMs ?? defaultSettleMs;
          const pointTimer = setTimeout(() => {
            this.chainTimers.delete(pointTimer);
            if (cancelled) return;
            options.onPointTarget?.(target, step, index);
          }, settle);
          this.chainTimers.add(pointTimer);
        }

        if (index === steps.length - 1) {
          const disarmTimer = setTimeout(() => {
            this.chainTimers.delete(disarmTimer);
            this.interruptWatcher.disarm(options.scope);
          }, (step.settleMs ?? defaultSettleMs) + 250);
          this.chainTimers.add(disarmTimer);
        }
      }, cumulativeDelay);

      this.chainTimers.add(execTimer);
    });

    return { cancel: cancelAll };
  }

  cancelActionChain(scope?: Record<string, any>): void {
    for (const timer of this.chainTimers) {
      clearTimeout(timer);
    }
    this.chainTimers.clear();
    this.interruptWatcher.disarm(scope);
  }

  scheduleCrossPageAction(
    payload: Omit<CrossPageActionPayload, 'createdAt'> & { createdAt?: number },
    scope?: Record<string, any>,
  ): boolean {
    const storage = this.getSessionStorage(scope);
    if (!storage || !payload?.action?.tool) return false;
    try {
      const record: CrossPageActionPayload = {
        action: payload.action,
        createdAt: payload.createdAt ?? Date.now(),
        ttlMs: payload.ttlMs ?? DEFAULT_CROSS_PAGE_TTL_MS,
        ...(payload.targetPath !== undefined ? { targetPath: payload.targetPath } : {}),
        ...(payload.caption !== undefined ? { caption: payload.caption } : {}),
      };
      storage.setItem(CROSS_PAGE_ACTION_STORAGE_KEY, JSON.stringify(record));
      return true;
    } catch {
      return false;
    }
  }

  consumeCrossPageAction(
    currentPathname?: string,
    scope?: Record<string, any>,
    now = Date.now(),
  ): CrossPageActionPayload | null {
    const storage = this.getSessionStorage(scope);
    if (!storage) return null;
    try {
      const raw = storage.getItem(CROSS_PAGE_ACTION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CrossPageActionPayload;
      if (!parsed || typeof parsed !== 'object' || !parsed.action?.tool) {
        storage.removeItem(CROSS_PAGE_ACTION_STORAGE_KEY);
        return null;
      }
      const ttl = parsed.ttlMs ?? DEFAULT_CROSS_PAGE_TTL_MS;
      if (typeof parsed.createdAt === 'number' && now - parsed.createdAt > ttl) {
        storage.removeItem(CROSS_PAGE_ACTION_STORAGE_KEY);
        return null;
      }
      if (parsed.targetPath && currentPathname) {
        const cleanTarget = (parsed.targetPath.split('#')[0] ?? '').split('?')[0]?.replace(/\/+$/, '') || '/';
        const cleanCurrent = (currentPathname.split('#')[0] ?? '').split('?')[0]?.replace(/\/+$/, '') || '/';
        if (cleanTarget !== cleanCurrent) {
          return null;
        }
      }
      storage.removeItem(CROSS_PAGE_ACTION_STORAGE_KEY);
      return parsed;
    } catch {
      try { storage.removeItem(CROSS_PAGE_ACTION_STORAGE_KEY); } catch {}
      return null;
    }
  }

  cleanup(scope?: Record<string, any>): void {
    this.cancelActionChain(scope);
    for (const [elem, timer] of this.activeTimers) {
      clearTimeout(timer);
      elem.classList.remove('fm-highlight-pulse');
    }
    this.activeTimers.clear();
  }
}
