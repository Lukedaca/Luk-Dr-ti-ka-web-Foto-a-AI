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
export declare class InPageActionDispatcher {
    private activeTimers;
    private getDocument;
    private getWindow;
    findTargetElement(target: string | Element, scope?: Record<string, any>): Element | null;
    highlightElement(target: string | Element, options?: HighlightOptions, scope?: Record<string, any>): boolean;
    scrollTo(target: string | number | Element, options?: ScrollOptions, scope?: Record<string, any>): boolean;
    dispatchCustomEvent(eventName: string, detail?: unknown, target?: EventTarget, scope?: Record<string, any>): boolean;
    dispatchAction(action: ResolvedAction, scope?: Record<string, any>): boolean;
    cleanup(): void;
}
//# sourceMappingURL=InPageActionDispatcher.d.ts.map