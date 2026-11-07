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
    private interruptWatcher;
    private getDocument;
    private getWindow;
    private getSessionStorage;
    findTargetElement(target: string | Element, scope?: Record<string, any>): Element | null;
    highlightElement(target: string | Element, options?: HighlightOptions, scope?: Record<string, any>): boolean;
    scrollTo(target: string | number | Element, options?: ScrollOptions, scope?: Record<string, any>): boolean;
    clickElement(target: string | Element, options?: ClickOptions, scope?: Record<string, any>): boolean;
    fillField(target: string | Element, value: string, options?: FillFieldOptions, scope?: Record<string, any>): boolean;
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