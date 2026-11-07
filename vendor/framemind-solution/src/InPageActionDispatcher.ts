import type { ResolvedAction } from './types.js';

export interface HighlightOptions {
  pulseClass?: string;
  durationMs?: number;
  scroll?: boolean;
  scrollBehavior?: ScrollBehavior;
  scrollBlock?: ScrollLogicalPosition;
  autoUnfold?: boolean;
  calloutLabel?: string;
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
  autoUnfold?: boolean;
  calloutLabel?: string;
}

export interface FillFieldOptions {
  scroll?: boolean;
  highlight?: boolean;
  pulseClass?: string;
  durationMs?: number;
  autoUnfold?: boolean;
}

export interface UnfoldStep {
  kind: 'details' | 'tabpanel' | 'accordion';
  container: Element;
  trigger: Element;
}

export interface UnfoldResult {
  unfolded: boolean;
  steps: UnfoldStep[];
}

export interface DeicticCharPosition {
  node: Node;
  start: number;
  end: number;
  element: Element;
}

export interface DeicticTextMap {
  text: string;
  positions: DeicticCharPosition[];
}

export interface DeicticMatchResult {
  range: Range | null;
  excerpt: string;
  foldedExcerpt: string;
  subElement: Element;
  containerElement: Element;
  score: number;
  unfoldedSteps: UnfoldStep[];
}

export interface DeicticSearchOptions {
  root?: Element | string;
  includeHidden?: boolean;
  minScore?: number;
}

export interface DeicticHighlightOptions extends DeicticSearchOptions {
  highlightName?: string;
  subElementClass?: string;
  containerClass?: string;
  durationMs?: number;
  scroll?: boolean;
  autoUnfold?: boolean;
  calloutLabel?: string;
}

export interface MinimumJerkPoint {
  x: number;
  y: number;
  progress: number;
  velocityFactor: number;
}

export interface HomingCursorOptions {
  from?: { x: number; y: number };
  startX?: number;
  startY?: number;
  durationMs?: number;
  frameIntervalMs?: number;
  maxWaitMs?: number;
  stabilityThresholdPx?: number;
  maxArcPx?: number;
  autoUnfold?: boolean;
  scroll?: boolean;
  clickOnLock?: boolean;
  calloutLabel?: string;
  onFrame?: (point: MinimumJerkPoint & { settled: boolean; targetRect: DOMRect | { left: number; top: number; width: number; height: number } }) => void;
  onLocked?: (lock: { x: number; y: number; element: Element; rect: DOMRect | { left: number; top: number; width: number; height: number } }) => void;
  onLock?: (lock: { x: number; y: number; element: Element; rect: DOMRect | { left: number; top: number; width: number; height: number } }) => void;
}

export interface FovealCalloutOptions {
  label?: string;
  durationMs?: number;
  badgePrefix?: string;
  preferredPlacement?: 'top' | 'bottom';
}

export interface ComparativeItemInput {
  target?: string | Element;
  selector?: string;
  label?: string;
  badge?: string;
}

export interface ComparativeHighlightOptions {
  durationMs?: number;
  autoUnfold?: boolean;
  scrollFirst?: boolean;
}

export interface ComparativeResolvedItem {
  element: Element;
  badge: string;
  label: string;
}

export interface ComparativeHandle {
  items: ComparativeResolvedItem[];
  focus: (index: number) => boolean;
  focusItem: (index: number) => boolean;
  clear: () => void;
}

const CIRCLED_NUMERALS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'] as const;
const DEICTIC_SKIP_SELECTOR =
  '[data-chat-panel], [data-fm-ui], [data-fm-agent-ui], [data-fm-callout], [data-private], [data-sensitive], script, style, template, noscript';

const DEICTIC_STOP_WORDS = new Set(
  (
    'a aby ale ani aspon az bez bude budou by bychom byla byli bylo byly co coz ' +
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
    'the a an is are in on of to for and or with show find highlight mark where'
  ).split(/\s+/),
);

export function foldDeicticText(value: unknown): string {
  return String(value ?? '')
    .toLocaleLowerCase('cs-CZ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function minimumJerkProgress(t: number): number {
  const tau = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  const tau2 = tau * tau;
  const tau3 = tau2 * tau;
  return 10 * tau3 - 15 * tau3 * tau + 6 * tau3 * tau2;
}

export function minimumJerkVelocityFactor(t: number): number {
  const tau = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  const tau2 = tau * tau;
  return 30 * tau2 - 60 * tau2 * tau + 30 * tau2 * tau2;
}

export function computeMinimumJerkTrajectoryPoint(
  fromOrX0: { x: number; y: number } | number,
  toOrY0: { x: number; y: number } | number,
  tOrX1: number,
  maxArcOrY1 = 36,
  maybeT?: number,
  maybeMaxArcPx = 36,
): MinimumJerkPoint {
  const from =
    typeof fromOrX0 === 'number'
      ? { x: fromOrX0, y: Number(toOrY0) }
      : fromOrX0;
  const to =
    typeof fromOrX0 === 'number'
      ? { x: tOrX1, y: maxArcOrY1 }
      : (toOrY0 as { x: number; y: number });
  const t = typeof fromOrX0 === 'number' ? (maybeT ?? 0) : tOrX1;
  const maxArcPx =
    typeof fromOrX0 === 'number'
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
  private homingTimers = new Set<any>();
  private calloutTimer: any = null;
  private deicticTimer: any = null;
  private activeDeicticElements: Element[] = [];
  private activeComparison: ComparativeHandle | null = null;
  private compareTimer: any = null;
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

  unfoldAncestors(target: Element | null, scope?: Record<string, any>): UnfoldResult {
    if (!target) return { unfolded: false, steps: [] };
    const doc = this.getDocument(scope);
    const pendingSteps: UnfoldStep[] = [];

    let current: Element | null = target;
    while (current) {
      const tag = (current.tagName || '').toUpperCase();
      if (tag === 'DETAILS') {
        const details = current as HTMLDetailsElement;
        if (!details.open) {
          const summary = (typeof details.querySelector === 'function' ? details.querySelector('summary') : null) ?? details;
          pendingSteps.unshift({ kind: 'details', container: details, trigger: summary });
        }
      } else {
        const role = (typeof current.getAttribute === 'function' ? current.getAttribute('role') : null) || '';
        const isHiddenAttr = typeof current.hasAttribute === 'function' && current.hasAttribute('hidden');
        const ariaHidden = typeof current.getAttribute === 'function' && current.getAttribute('aria-hidden') === 'true';
        const hasHiddenClass = current.classList?.contains?.('hidden') ?? false;
        const id = (typeof current.getAttribute === 'function' ? current.getAttribute('id') : null) || (current as any).id || '';

        if ((role === 'tabpanel' || isHiddenAttr || ariaHidden || hasHiddenClass) && id && doc && typeof doc.querySelector === 'function') {
          let controller: Element | null = null;
          try {
            controller =
              doc.querySelector(`[role="tab"][aria-controls="${id}"]`) ??
              doc.querySelector(`[aria-controls="${id}"]`) ??
              doc.querySelector(`[data-tab="${id}"]`) ??
              doc.querySelector(`[data-tab-target="#${id}"]`);
          } catch {}
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
      current = current.parentElement ?? null;
    }

    for (const step of pendingSteps) {
      if (step.kind === 'details') {
        (step.container as HTMLDetailsElement).open = true;
      } else {
        try {
          if (typeof (step.trigger as HTMLElement).click === 'function') {
            (step.trigger as HTMLElement).click();
          }
        } catch {}
        try {
          if (typeof step.container.removeAttribute === 'function') {
            step.container.removeAttribute('hidden');
          }
          if (typeof step.container.setAttribute === 'function' && step.container.getAttribute('aria-hidden') === 'true') {
            step.container.setAttribute('aria-hidden', 'false');
          }
          step.container.classList?.remove?.('hidden');
          if (typeof step.trigger.setAttribute === 'function') {
            if (step.kind === 'tabpanel') step.trigger.setAttribute('aria-selected', 'true');
            step.trigger.setAttribute('aria-expanded', 'true');
          }
        } catch {}
      }
      this.dispatchCustomEvent('framemind:unfold', { kind: step.kind }, step.container, scope);
    }

    return {
      unfolded: pendingSteps.length > 0,
      steps: pendingSteps,
    };
  }

  highlightElement(
    target: string | Element,
    options: HighlightOptions = {},
    scope?: Record<string, any>,
  ): boolean {
    const elem = this.findTargetElement(target, scope);
    if (!elem) return false;

    if (options.autoUnfold !== false) {
      this.unfoldAncestors(elem, scope);
    }

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

    if (options.autoUnfold !== false) {
      this.unfoldAncestors(elem, scope);
    }

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
      const hlOpts: HighlightOptions = { scroll: false, autoUnfold: false };
      if (options.pulseClass !== undefined) hlOpts.pulseClass = options.pulseClass;
      if (options.durationMs !== undefined) hlOpts.durationMs = options.durationMs;
      if (options.calloutLabel !== undefined) hlOpts.calloutLabel = options.calloutLabel;
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

    if (options.autoUnfold !== false) {
      this.unfoldAncestors(elem, scope);
    }

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
      const hlOpts: HighlightOptions = { scroll: false, autoUnfold: false };
      if (options.pulseClass !== undefined) hlOpts.pulseClass = options.pulseClass;
      if (options.durationMs !== undefined) hlOpts.durationMs = options.durationMs;
      this.highlightElement(elem, hlOpts, scope);
    }

    return true;
  }

  private collectTextNodes(
    root: Element,
    includeHidden: boolean,
    doc: Document | null,
    win: Window | null,
  ): Array<{ node: Node; element: Element }> {
    const out: Array<{ node: Node; element: Element }> = [];

    const isAllowedElement = (el: Element | null): boolean => {
      if (!el) return false;
      if (typeof el.closest === 'function') {
        try {
          if (el.closest(DEICTIC_SKIP_SELECTOR)) return false;
        } catch {}
      }
      const tag = (el.tagName || '').toUpperCase();
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEMPLATE') return false;

      if (!includeHidden) {
        let cur: Element | null = el;
        while (cur && cur !== root.parentElement) {
          const curTag = (cur.tagName || '').toUpperCase();
          if (curTag === 'DETAILS' && !(cur as HTMLDetailsElement).open) {
            const inSummary = typeof el.closest === 'function' && Boolean(el.closest('summary'));
            if (!inSummary) return false;
          }
          if (typeof cur.hasAttribute === 'function' && cur.hasAttribute('hidden')) return false;
          const style = win?.getComputedStyle?.(cur);
          if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
          cur = cur.parentElement ?? null;
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
        if (out.length > 0) return out;
      } catch {}
    }

    // Fallback recursive traversal for lightweight/mock DOM environments
    const visit = (node: any, parentEl: Element) => {
      if (!node) return;
      if (node.nodeType === 3 || (typeof node.nodeValue === 'string' && !node.tagName)) {
        if (isAllowedElement(parentEl)) {
          out.push({ node: node as Node, element: parentEl });
        }
        return;
      }
      const asEl = node.tagName ? (node as Element) : parentEl;
      if (node.tagName && !isAllowedElement(asEl)) return;
      const children = node.childNodes ?? node.children ?? [];
      if (Array.isArray(children) || typeof children.length === 'number') {
        for (let i = 0; i < children.length; i++) {
          visit(children[i], asEl);
        }
      } else if (typeof node.textContent === 'string' && node.textContent.trim() && node === root) {
        out.push({ node: { nodeValue: node.textContent } as unknown as Node, element: asEl });
      }
    };

    visit(root, root);
    return out;
  }

  buildDeicticTextMap(
    root: Element,
    options: { includeHidden?: boolean; scope?: Record<string, any> } = {},
  ): DeicticTextMap {
    const doc = this.getDocument(options.scope);
    const win = this.getWindow(options.scope);
    const includeHidden = options.includeHidden ?? true;
    const textNodes = this.collectTextNodes(root, includeHidden, doc, win);

    const chars: string[] = [];
    const positions: DeicticCharPosition[] = [];
    let prevElement: Element | null = null;

    for (const { node, element } of textNodes) {
      if (prevElement && prevElement !== element && chars.length > 0 && chars[chars.length - 1] !== ' ') {
        const lastPos = positions[positions.length - 1];
        if (lastPos) {
          chars.push(' ');
          positions.push({ node: lastPos.node, start: lastPos.end, end: lastPos.end, element: lastPos.element });
        }
      }
      prevElement = element;

      const raw = node.nodeValue ?? '';
      let offset = 0;
      for (const ch of raw) {
        const nextOffset = offset + ch.length;
        const folded = ch
          .toLocaleLowerCase('cs-CZ')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        for (const part of folded) {
          const norm = /\s/.test(part) ? ' ' : part;
          if (norm === ' ' && (chars.length === 0 || chars[chars.length - 1] === ' ')) continue;
          chars.push(norm);
          positions.push({ node, start: offset, end: nextOffset, element });
        }
        offset = nextOffset;
      }
    }

    return { text: chars.join(''), positions };
  }

  private createDeicticMatch(
    doc: Document | null,
    root: Element,
    map: DeicticTextMap,
    startIdx: number,
    endIdx: number,
    score: number,
  ): DeicticMatchResult | null {
    if (startIdx < 0 || endIdx <= startIdx) return null;
    const firstPos = map.positions[startIdx];
    const lastPos = map.positions[endIdx - 1];
    if (!firstPos || !lastPos) return null;

    let range: Range | null = null;
    let excerpt = '';
    if (doc && typeof doc.createRange === 'function') {
      try {
        const r = doc.createRange();
        r.setStart(firstPos.node, firstPos.start);
        r.setEnd(lastPos.node, lastPos.end);
        range = r;
        excerpt = r.toString().replace(/\s+/g, ' ').trim();
      } catch {}
    }

    if (!excerpt) {
      excerpt = map.text.slice(startIdx, endIdx).trim();
    }
    if (!excerpt) return null;

    const baseElem = firstPos.element || root;
    const subElement =
      (typeof baseElem.closest === 'function'
        ? baseElem.closest('td, th, li, p, h1, h2, h3, h4, dt, dd, summary, button, a, blockquote, [data-i18n]')
        : null) ?? baseElem;
    const containerElement =
      (typeof subElement.closest === 'function'
        ? subElement.closest('article, tr, details, section, .card, .price-card')
        : null) ?? subElement;

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

  findDeicticTextMatch(
    queryOrQuote: string,
    options: DeicticSearchOptions = {},
    scope?: Record<string, any>,
  ): DeicticMatchResult | null {
    const doc = this.getDocument(scope);
    if (!doc) return null;

    const root: Element | null =
      typeof options.root === 'string'
        ? this.findTargetElement(options.root, scope)
        : (options.root ??
          (typeof doc.querySelector === 'function' ? (doc.querySelector('main') ?? doc.body) : doc.body) ??
          null);
    if (!root) return null;

    const rawInput = String(queryOrQuote ?? '').trim();
    if (!rawInput) return null;

    const quoted = rawInput.match(/[„“"]([^„“"]{3,240})[“”"]/)?.[1]?.trim();
    const foldedTarget = foldDeicticText(quoted || rawInput);
    if (!foldedTarget) return null;

    const mapOpts: { includeHidden?: boolean; scope?: Record<string, any> } = {
      includeHidden: options.includeHidden ?? true,
    };
    if (scope !== undefined) mapOpts.scope = scope;

    const map = this.buildDeicticTextMap(root, mapOpts);
    if (!map.text) return null;

    // 1. Direct substring or quoted phrase match (highest precision)
    const exactIdx = map.text.indexOf(foldedTarget);
    if (exactIdx >= 0 && foldedTarget.length >= 3) {
      const exactMatch = this.createDeicticMatch(
        doc,
        root,
        map,
        exactIdx,
        exactIdx + foldedTarget.length,
        1200 + foldedTarget.length,
      );
      if (exactMatch) return exactMatch;
    }

    // 2. Sentence-level granular scoring by content words & numeric tokens
    const queryWords = foldedTarget
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((w) => w.length >= 2 && !DEICTIC_STOP_WORDS.has(w));
    if (queryWords.length === 0) return null;

    const minScore = options.minScore ?? 80;
    let bestMatch: DeicticMatchResult | null = null;

    const sentenceRegex = /[^.!?;\n]+(?:[.!?](?=\s|$)|$)/g;
    let m: RegExpExecArray | null;
    while ((m = sentenceRegex.exec(map.text)) !== null) {
      const sentenceText = m[0];
      const sStart = m.index;
      const sEnd = sStart + sentenceText.length;
      const candidateWords = sentenceText
        .replace(/[^a-z0-9]+/g, ' ')
        .split(' ')
        .filter((w) => w.length >= 2 && !DEICTIC_STOP_WORDS.has(w));
      if (candidateWords.length === 0) continue;

      let hits = 0;
      let numericBonus = 0;
      for (const qw of queryWords) {
        const isNum = /^\d+$/.test(qw);
        const matched = candidateWords.some((cw) => {
          if (cw === qw) return true;
          if (isNum) return false;
          if (qw.length >= 5 && cw.length >= 5) {
            const prefixLen = Math.min(qw.length, cw.length) - 2;
            return prefixLen >= 4 && cw.slice(0, prefixLen) === qw.slice(0, prefixLen);
          }
          return false;
        });
        if (matched) {
          hits++;
          if (isNum) numericBonus += 65;
        }
      }

      const requiredHits = queryWords.length <= 2 ? queryWords.length : Math.ceil(queryWords.length * 0.65);
      if (hits < requiredHits) continue;

      const score = hits * 110 + numericBonus - Math.max(0, candidateWords.length - hits) * 2;
      if (score >= minScore && (!bestMatch || score > bestMatch.score)) {
        const candidate = this.createDeicticMatch(doc, root, map, sStart, sEnd, score);
        if (candidate) bestMatch = candidate;
      }
    }

    return bestMatch;
  }

  clearDeicticHighlights(highlightName = 'framemind-source', scope?: Record<string, any>): void {
    if (this.deicticTimer) {
      clearTimeout(this.deicticTimer);
      this.deicticTimer = null;
    }
    const win = this.getWindow(scope) as any;
    try {
      win?.CSS?.highlights?.delete?.(highlightName);
    } catch {}
    for (const el of this.activeDeicticElements) {
      el.classList?.remove?.('fm-deictic-subelement', 'fm-highlight-pulse', 'fm-source-section');
    }
    this.activeDeicticElements = [];
  }

  highlightTextRange(
    queryOrQuote: string,
    options: DeicticHighlightOptions = {},
    scope?: Record<string, any>,
  ): DeicticMatchResult | null {
    const searchOpts: DeicticSearchOptions = {
      includeHidden: options.includeHidden ?? true,
    };
    if (options.root !== undefined) searchOpts.root = options.root;
    if (options.minScore !== undefined) searchOpts.minScore = options.minScore;

    const match = this.findDeicticTextMatch(queryOrQuote, searchOpts, scope);
    if (!match) return null;

    const highlightName = options.highlightName ?? 'framemind-source';
    this.clearDeicticHighlights(highlightName, scope);

    if (options.autoUnfold !== false) {
      const unfoldRes = this.unfoldAncestors(match.subElement, scope);
      match.unfoldedSteps = unfoldRes.steps;

      // Re-create range if unfolding changed layout or text visibility
      if (unfoldRes.unfolded) {
        const refreshed = this.findDeicticTextMatch(queryOrQuote, { ...searchOpts, includeHidden: false }, scope);
        if (refreshed?.range) {
          match.range = refreshed.range;
        }
      }
    }

    const win = this.getWindow(scope) as any;
    if (match.range && win?.CSS?.highlights && typeof win.Highlight === 'function') {
      try {
        win.CSS.highlights.set(highlightName, new win.Highlight(match.range));
      } catch {}
    }

    const subClass = options.subElementClass ?? 'fm-deictic-subelement';
    const containerClass = options.containerClass ?? 'fm-highlight-pulse';

    match.subElement.classList?.add?.(subClass);
    this.activeDeicticElements.push(match.subElement);

    if (match.containerElement && match.containerElement !== match.subElement) {
      match.containerElement.classList?.add?.(containerClass);
      this.activeDeicticElements.push(match.containerElement);
    } else {
      match.subElement.classList?.add?.(containerClass);
    }

    if (options.scroll !== false && typeof match.subElement.scrollIntoView === 'function') {
      const reduceMotion = win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      match.subElement.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'center',
      });
    }

    const durationMs = options.durationMs ?? 4000;
    if (options.calloutLabel) {
      this.showFovealCallout(match.range ?? match.subElement, options.calloutLabel, { durationMs }, scope);
    }

    if (durationMs > 0) {
      this.deicticTimer = setTimeout(() => {
        this.deicticTimer = null;
        this.clearDeicticHighlights(highlightName, scope);
      }, durationMs);
    }

    this.dispatchCustomEvent(
      'framemind:source-mark',
      { active: true, excerpt: match.excerpt, unfolded: match.unfoldedSteps.length > 0 },
      undefined,
      scope,
    );

    return match;
  }

  groundEvidenceInDom(
    answerText: string,
    options: DeicticHighlightOptions = {},
    scope?: Record<string, any>,
  ): DeicticMatchResult | null {
    const raw = String(answerText ?? '').trim();
    if (!raw) return null;

    const candidates: string[] = [];

    // 1. Explicit quoted spans
    const quoteMatches = raw.match(/[„“"]([^„“"]{4,140})[“”"]/g);
    if (quoteMatches) {
      for (const q of quoteMatches) {
        candidates.push(q.replace(/^[„“"]|[“”"]$/g, '').trim());
      }
    }

    // 2. Price / time / category anchors (e.g. "4 990 Kč", "16:30", "U-9")
    const anchorRegex = /\b(?:\d{1,3}(?:\s?\d{3})*\s*(?:Kč|CZK|EUR|€)|\d{1,2}:\d{2}|U-\d{1,2})\b/gi;
    let anchorMatch: RegExpExecArray | null;
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
      if (match) return match;
    }

    return null;
  }

  homingLockToElement(
    target: string | Element,
    options: HomingCursorOptions = {},
    scope?: Record<string, any>,
  ): { cancel: () => void } {
    const elem = this.findTargetElement(target, scope);
    if (!elem) return { cancel: () => {} };

    if (options.autoUnfold !== false) {
      this.unfoldAncestors(elem, scope);
    }

    if (options.scroll !== false && typeof elem.scrollIntoView === 'function') {
      elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const getRect = (): { left: number; top: number; width: number; height: number } => {
      const r = elem.getBoundingClientRect?.();
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
    const startPoint =
      options.from ??
      (typeof options.startX === 'number' && typeof options.startY === 'number'
        ? { x: options.startX, y: options.startY }
        : {
            x: Math.max(24, initialCenter.x - 140),
            y: Math.max(24, initialCenter.y + 110),
          });

    const durationMs = Math.max(16, options.durationMs ?? 360);
    const frameIntervalMs = Math.max(8, options.frameIntervalMs ?? 16);
    const maxWaitMs = Math.max(durationMs, options.maxWaitMs ?? durationMs + 320);
    const stabilityThresholdPx = options.stabilityThresholdPx ?? 0.8;
    const maxArcPx = options.maxArcPx ?? 36;

    let elapsed = 0;
    let prevRect = initialRect;
    let cancelled = false;
    let currentTimer: any = null;

    const cancel = () => {
      if (cancelled) return;
      cancelled = true;
      if (currentTimer) {
        clearTimeout(currentTimer);
        this.homingTimers.delete(currentTimer);
        currentTimer = null;
      }
    };

    const stepFrame = () => {
      if (cancelled) return;
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

      options.onFrame?.({
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
        options.onLocked?.(lockPayload);
        options.onLock?.(lockPayload);
        return;
      }

      currentTimer = setTimeout(stepFrame, frameIntervalMs);
      this.homingTimers.add(currentTimer);
    };

    currentTimer = setTimeout(stepFrame, frameIntervalMs);
    this.homingTimers.add(currentTimer);

    return { cancel };
  }

  showFovealCallout(
    target: Element | Range,
    labelOrOptions: string | FovealCalloutOptions,
    optionsOrScope?: FovealCalloutOptions | Record<string, any>,
    maybeScope?: Record<string, any>,
  ): HTMLElement | null {
    const isLabelString = typeof labelOrOptions === 'string';
    const options: FovealCalloutOptions = isLabelString
      ? ((optionsOrScope as FovealCalloutOptions) ?? {})
      : (labelOrOptions ?? {});
    const scope = isLabelString ? maybeScope : (optionsOrScope as Record<string, any> | undefined);
    const label = isLabelString ? labelOrOptions : (options.label ?? '');

    const doc = this.getDocument(scope);
    const win = this.getWindow(scope);
    if (!doc || !label.trim()) return null;

    this.clearFovealCallout(scope);

    const rect =
      typeof (target as any)?.getBoundingClientRect === 'function'
        ? (target as any).getBoundingClientRect()
        : { left: 24, top: 80, bottom: 112, width: 120, height: 32 };

    const preferred = options.preferredPlacement ?? 'top';
    const topSpace = typeof rect?.top === 'number' ? rect.top : 80;
    const placement: 'top' | 'bottom' =
      preferred === 'top' && topSpace < 52 ? 'bottom' : preferred;

    const viewportW = (win as any)?.innerWidth ?? 1280;
    const rawLeft = (typeof rect?.left === 'number' ? rect.left : 24) + ((rect?.width ?? 0) / 2) - 90;
    const clampedLeft = Math.max(12, Math.min(viewportW - 220, Math.round(rawLeft)));
    const topPx =
      placement === 'top'
        ? Math.max(8, Math.round((rect?.top ?? 80) - 36))
        : Math.round((rect?.bottom ?? ((rect?.top ?? 80) + (rect?.height ?? 32))) + 8);

    const text = options.badgePrefix ? `${options.badgePrefix} ${label.trim()}` : label.trim();

    let calloutEl: HTMLElement | null = null;
    if (typeof doc.createElement === 'function') {
      try {
        calloutEl = doc.createElement('div');
        calloutEl.id = 'fm-foveal-callout';
        calloutEl.setAttribute?.('data-fm-callout', 'true');
        calloutEl.setAttribute?.('data-fm-agent-ui', 'true');
        calloutEl.setAttribute?.('data-fm-placement', placement);
        calloutEl.setAttribute?.('data-placement', placement);
        calloutEl.setAttribute?.('role', 'status');
        calloutEl.setAttribute?.('aria-live', 'polite');
        calloutEl.textContent = text;
        if (calloutEl.style) {
          calloutEl.style.position = 'fixed';
          calloutEl.style.left = `${clampedLeft}px`;
          calloutEl.style.top = `${topPx}px`;
          calloutEl.style.zIndex = '2147483646';
          calloutEl.style.pointerEvents = 'none';
        }
        doc.body?.appendChild?.(calloutEl);
      } catch {}
    }

    const durationMs = options.durationMs ?? 3200;
    if (durationMs > 0) {
      this.calloutTimer = setTimeout(() => {
        this.calloutTimer = null;
        this.clearFovealCallout(scope);
      }, durationMs);
    }

    return calloutEl;
  }

  clearFovealCallout(scope?: Record<string, any>): void {
    if (this.calloutTimer) {
      clearTimeout(this.calloutTimer);
      this.calloutTimer = null;
    }
    const doc = this.getDocument(scope);
    try {
      const existing = doc?.getElementById?.('fm-foveal-callout');
      if (existing) {
        if (typeof existing.remove === 'function') existing.remove();
        else existing.parentElement?.removeChild?.(existing);
      }
    } catch {}
  }

  compareElements(
    inputs: Array<string | Element | ComparativeItemInput>,
    options: ComparativeHighlightOptions = {},
    scope?: Record<string, any>,
  ): ComparativeHandle {
    this.clearComparison(scope);
    const resolved: ComparativeResolvedItem[] = [];

    inputs.forEach((input, idx) => {
      const itemObj: ComparativeItemInput =
        typeof input === 'string' || (typeof input === 'object' && input !== null && !('target' in input) && !('selector' in input))
          ? { target: input as string | Element }
          : (input as ComparativeItemInput);

      const rawTarget = itemObj.target ?? itemObj.selector;
      if (!rawTarget) return;

      let elem = this.findTargetElement(rawTarget, scope);
      if (!elem && typeof rawTarget === 'string') {
        const deictic = this.findDeicticTextMatch(rawTarget, { includeHidden: true }, scope);
        elem = deictic?.containerElement ?? deictic?.subElement ?? null;
      }
      if (!elem) return;

      if (options.autoUnfold !== false) {
        this.unfoldAncestors(elem, scope);
      }

      const badge = itemObj.badge ?? CIRCLED_NUMERALS[idx] ?? `(${idx + 1})`;
      const label =
        itemObj.label ??
        ((elem.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48) || `Položka ${idx + 1}`);

      elem.classList?.add?.('fm-compare-target');
      elem.setAttribute?.('data-fm-compare-badge', badge);
      elem.setAttribute?.('data-fm-compare-index', String(idx));

      resolved.push({ element: elem, badge, label });
    });

    const focus = (activeIdx: number): boolean => {
      const targetItem = resolved[activeIdx];
      if (!targetItem) return false;
      resolved.forEach((item, idx) => {
        if (idx === activeIdx) {
          item.element.classList?.add?.('fm-compare-active', 'fm-highlight-pulse');
          item.element.classList?.remove?.('fm-compare-standby');
        } else {
          item.element.classList?.remove?.('fm-compare-active', 'fm-highlight-pulse');
          item.element.classList?.add?.('fm-compare-standby');
        }
      });

      if (typeof targetItem.element.scrollIntoView === 'function') {
        targetItem.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      this.showFovealCallout(
        targetItem.element,
        targetItem.label,
        { badgePrefix: targetItem.badge, durationMs: options.durationMs ?? 4500 },
        scope,
      );
      return true;
    };

    const clear = () => {
      if (this.compareTimer) {
        clearTimeout(this.compareTimer);
        this.compareTimer = null;
      }
      for (const item of resolved) {
        item.element.classList?.remove?.(
          'fm-compare-target',
          'fm-compare-active',
          'fm-compare-standby',
          'fm-highlight-pulse',
        );
        item.element.removeAttribute?.('data-fm-compare-badge');
        item.element.removeAttribute?.('data-fm-compare-index');
      }
      this.clearFovealCallout(scope);
      this.activeComparison = null;
    };

    const handle: ComparativeHandle = {
      items: resolved,
      focus,
      focusItem: focus,
      clear,
    };
    this.activeComparison = handle;

    if (resolved.length > 0 && options.scrollFirst !== false) {
      focus(0);
    }

    const durationMs = options.durationMs ?? 5000;
    if (durationMs > 0 && resolved.length > 0) {
      this.compareTimer = setTimeout(() => {
        this.compareTimer = null;
        clear();
      }, durationMs);
    }

    return handle;
  }

  activateComparativeFocus(index: number, _scope?: Record<string, any>): boolean {
    if (!this.activeComparison) return false;
    return this.activeComparison.focus(index);
  }

  clearComparison(scope?: Record<string, any>): void {
    if (this.activeComparison) {
      this.activeComparison.clear();
      this.activeComparison = null;
    } else if (this.compareTimer) {
      clearTimeout(this.compareTimer);
      this.compareTimer = null;
      this.clearFovealCallout(scope);
    }
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
      case 'highlight_range': {
        const query = action.args.query || action.args.text || action.args.snippet || action.args.target || action.args.selector;
        if (!query) return false;
        const opts: DeicticHighlightOptions = {};
        const rootArg = action.args.rootSelector || action.args.root;
        if (rootArg) opts.root = rootArg;
        const match = this.highlightTextRange(query, opts, scope);
        return Boolean(match);
      }
      case 'compare_elements': {
        const rawTargets = action.args.targets || [action.args.first, action.args.second].filter(Boolean).join('|');
        const parts = String(rawTargets)
          .split('|')
          .map((item) => item.trim())
          .filter(Boolean);
        if (parts.length < 2) return false;
        const handle = this.compareElements(parts, {}, scope);
        return Boolean(handle);
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
    for (const timer of this.homingTimers) {
      clearTimeout(timer);
    }
    this.homingTimers.clear();
    this.clearDeicticHighlights(undefined, scope);
    this.clearComparison(scope);
    this.clearFovealCallout(scope);
  }
}
