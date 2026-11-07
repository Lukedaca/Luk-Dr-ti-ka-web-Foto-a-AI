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
    from?: {
        x: number;
        y: number;
    };
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
    onFrame?: (point: MinimumJerkPoint & {
        settled: boolean;
        targetRect: DOMRect | {
            left: number;
            top: number;
            width: number;
            height: number;
        };
    }) => void;
    onLocked?: (lock: {
        x: number;
        y: number;
        element: Element;
        rect: DOMRect | {
            left: number;
            top: number;
            width: number;
            height: number;
        };
    }) => void;
    onLock?: (lock: {
        x: number;
        y: number;
        element: Element;
        rect: DOMRect | {
            left: number;
            top: number;
            width: number;
            height: number;
        };
    }) => void;
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
export declare function foldDeicticText(value: unknown): string;
export declare function minimumJerkProgress(t: number): number;
export declare function minimumJerkVelocityFactor(t: number): number;
export declare function computeMinimumJerkTrajectoryPoint(fromOrX0: {
    x: number;
    y: number;
} | number, toOrY0: {
    x: number;
    y: number;
} | number, tOrX1: number, maxArcOrY1?: number, maybeT?: number, maybeMaxArcPx?: number): MinimumJerkPoint;
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
export declare const CROSS_PAGE_ACTION_STORAGE_KEY = "framemind:pending_dom_action:v1";
export declare class InterruptWatcher {
    private active;
    private listeners;
    arm(onInterrupt: (event?: Event) => void, options?: {
        ignoreSelector?: string;
        scope?: Record<string, any>;
    }): void;
    disarm(scope?: Record<string, any>): void;
    isArmed(): boolean;
}
export declare class InPageActionDispatcher {
    private activeTimers;
    private chainTimers;
    private homingTimers;
    private calloutTimer;
    private deicticTimer;
    private activeDeicticElements;
    private activeComparison;
    private compareTimer;
    private interruptWatcher;
    private getDocument;
    private getWindow;
    private getSessionStorage;
    findTargetElement(target: string | Element, scope?: Record<string, any>): Element | null;
    unfoldAncestors(target: Element | null, scope?: Record<string, any>): UnfoldResult;
    highlightElement(target: string | Element, options?: HighlightOptions, scope?: Record<string, any>): boolean;
    scrollTo(target: string | number | Element, options?: ScrollOptions, scope?: Record<string, any>): boolean;
    clickElement(target: string | Element, options?: ClickOptions, scope?: Record<string, any>): boolean;
    fillField(target: string | Element, value: string, options?: FillFieldOptions, scope?: Record<string, any>): boolean;
    private collectTextNodes;
    buildDeicticTextMap(root: Element, options?: {
        includeHidden?: boolean;
        scope?: Record<string, any>;
    }): DeicticTextMap;
    private createDeicticMatch;
    findDeicticTextMatch(queryOrQuote: string, options?: DeicticSearchOptions, scope?: Record<string, any>): DeicticMatchResult | null;
    clearDeicticHighlights(highlightName?: string, scope?: Record<string, any>): void;
    highlightTextRange(queryOrQuote: string, options?: DeicticHighlightOptions, scope?: Record<string, any>): DeicticMatchResult | null;
    groundEvidenceInDom(answerText: string, options?: DeicticHighlightOptions, scope?: Record<string, any>): DeicticMatchResult | null;
    homingLockToElement(target: string | Element, options?: HomingCursorOptions, scope?: Record<string, any>): {
        cancel: () => void;
    };
    showFovealCallout(target: Element | Range, labelOrOptions: string | FovealCalloutOptions, optionsOrScope?: FovealCalloutOptions | Record<string, any>, maybeScope?: Record<string, any>): HTMLElement | null;
    clearFovealCallout(scope?: Record<string, any>): void;
    compareElements(inputs: Array<string | Element | ComparativeItemInput>, options?: ComparativeHighlightOptions, scope?: Record<string, any>): ComparativeHandle;
    activateComparativeFocus(index: number, _scope?: Record<string, any>): boolean;
    clearComparison(scope?: Record<string, any>): void;
    dispatchCustomEvent(eventName: string, detail?: unknown, target?: EventTarget, scope?: Record<string, any>): boolean;
    resolveActionTarget(action: ResolvedAction, scope?: Record<string, any>): Element | null;
    dispatchAction(action: ResolvedAction, scope?: Record<string, any>): boolean;
    runActionChain(stepsInput: Array<ResolvedAction | ActionChainStep>, options?: ActionChainOptions): {
        cancel: () => void;
    };
    cancelActionChain(scope?: Record<string, any>): void;
    scheduleCrossPageAction(payload: Omit<CrossPageActionPayload, 'createdAt'> & {
        createdAt?: number;
    }, scope?: Record<string, any>): boolean;
    consumeCrossPageAction(currentPathname?: string, scope?: Record<string, any>, now?: number): CrossPageActionPayload | null;
    cleanup(scope?: Record<string, any>): void;
}
//# sourceMappingURL=InPageActionDispatcher.d.ts.map