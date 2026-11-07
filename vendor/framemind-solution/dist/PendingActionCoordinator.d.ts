import type { ResolvedAction } from './types.js';
export type ActionExecutionTiming = 'onSpeakStart' | 'onSpeakEnd' | 'onCue';
export interface PendingActionOptions {
    timing?: ActionExecutionTiming;
    failsafeMs?: number;
}
export interface ActionCueStep {
    action: ResolvedAction;
    sentenceIndex?: number;
    timing?: ActionExecutionTiming;
}
export declare class PendingActionCoordinator {
    private pending;
    private cueQueue;
    private timer;
    private onExecute;
    private isVoiceActive;
    private timing;
    schedule(action: ResolvedAction, onExecute: (action: ResolvedAction) => void, isVoiceActive: () => boolean, options?: PendingActionOptions): void;
    scheduleSequence(steps: ActionCueStep[], onExecute: (action: ResolvedAction) => void, isVoiceActive: () => boolean, failsafeMs?: number): void;
    notifyCuePoint(sentenceIndex: number): number;
    private flushSequence;
    notifySpeakStart(): boolean;
    notifySpeakEnd(): boolean;
    flush(): boolean;
    cancel(): void;
    isPending(): boolean;
    getPending(): ResolvedAction | null;
    getTiming(): ActionExecutionTiming;
}
//# sourceMappingURL=PendingActionCoordinator.d.ts.map