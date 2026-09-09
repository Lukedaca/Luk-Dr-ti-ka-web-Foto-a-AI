import type { ResolvedAction } from './types.js';
export type ActionExecutionTiming = 'onSpeakStart' | 'onSpeakEnd';
export interface PendingActionOptions {
    timing?: ActionExecutionTiming;
    failsafeMs?: number;
}
export declare class PendingActionCoordinator {
    private pending;
    private timer;
    private onExecute;
    private isVoiceActive;
    private timing;
    schedule(action: ResolvedAction, onExecute: (action: ResolvedAction) => void, isVoiceActive: () => boolean, options?: PendingActionOptions): void;
    notifySpeakStart(): boolean;
    notifySpeakEnd(): boolean;
    flush(): boolean;
    cancel(): void;
    isPending(): boolean;
    getPending(): ResolvedAction | null;
    getTiming(): ActionExecutionTiming;
}
//# sourceMappingURL=PendingActionCoordinator.d.ts.map