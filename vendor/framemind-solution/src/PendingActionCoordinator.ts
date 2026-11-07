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

export class PendingActionCoordinator {
  private pending: ResolvedAction | null = null;
  private cueQueue: ActionCueStep[] = [];
  private timer: any = null;
  private onExecute: ((action: ResolvedAction) => void) | null = null;
  private isVoiceActive: (() => boolean) | null = null;
  private timing: ActionExecutionTiming = 'onSpeakEnd';

  schedule(
    action: ResolvedAction,
    onExecute: (action: ResolvedAction) => void,
    isVoiceActive: () => boolean,
    options: PendingActionOptions = {},
  ): void {
    this.cancel();
    this.pending = action;
    this.onExecute = onExecute;
    this.isVoiceActive = isVoiceActive;
    this.timing = options.timing ?? 'onSpeakEnd';

    const failsafeMs = options.failsafeMs ?? 5000;

    // If voice is not active right now and timing is start, we execute immediately
    if (!this.isVoiceActive() && this.timing === 'onSpeakStart') {
      this.flush();
      return;
    }

    const armFailsafe = () => {
      this.timer = setTimeout(() => {
        this.timer = null;
        if (this.isVoiceActive?.()) {
          // If still actively speaking after failsafeMs, extend one more cycle then force flush
          this.timer = setTimeout(() => {
            this.timer = null;
            this.flush();
          }, 3000);
          return;
        }
        this.flush();
      }, failsafeMs);
    };

    armFailsafe();
  }

  scheduleSequence(
    steps: ActionCueStep[],
    onExecute: (action: ResolvedAction) => void,
    isVoiceActive: () => boolean,
    failsafeMs = 6000,
  ): void {
    this.cancel();
    if (!Array.isArray(steps) || steps.length === 0) return;
    this.cueQueue = steps.map((s) => ({
      ...s,
      sentenceIndex: s.sentenceIndex ?? 0,
      timing: s.timing ?? 'onCue',
    }));
    this.onExecute = onExecute;
    this.isVoiceActive = isVoiceActive;

    if (!this.isVoiceActive()) {
      this.flushSequence();
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      this.flushSequence();
    }, failsafeMs);
  }

  notifyCuePoint(sentenceIndex: number): number {
    if (!this.onExecute || this.cueQueue.length === 0) return 0;
    const execute = this.onExecute;
    const ready: ActionCueStep[] = [];
    const remaining: ActionCueStep[] = [];

    for (const step of this.cueQueue) {
      if ((step.sentenceIndex ?? 0) <= sentenceIndex && step.timing !== 'onSpeakEnd') {
        ready.push(step);
      } else {
        remaining.push(step);
      }
    }

    this.cueQueue = remaining;
    for (const step of ready) {
      execute(step.action);
    }

    if (this.cueQueue.length === 0 && !this.pending) {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      this.onExecute = null;
      this.isVoiceActive = null;
    }
    return ready.length;
  }

  private flushSequence(): number {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const execute = this.onExecute;
    const steps = [...this.cueQueue];
    this.cueQueue = [];
    if (!this.pending) {
      this.onExecute = null;
      this.isVoiceActive = null;
    }
    if (!execute || steps.length === 0) return 0;
    for (const step of steps) {
      execute(step.action);
    }
    return steps.length;
  }

  notifySpeakStart(): boolean {
    if (this.cueQueue.length > 0) {
      this.notifyCuePoint(0);
    }
    if (this.pending && this.timing === 'onSpeakStart') {
      return this.flush();
    }
    return false;
  }

  notifySpeakEnd(): boolean {
    if (this.cueQueue.length > 0) {
      const count = this.flushSequence();
      if (!this.pending) return count > 0;
    }
    if (this.pending && this.timing === 'onSpeakEnd') {
      return this.flush();
    }
    return false;
  }

  flush(): boolean {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.cueQueue.length > 0) {
      const count = this.flushSequence();
      if (!this.pending) return count > 0;
    }
    const action = this.pending;
    const execute = this.onExecute;
    this.pending = null;
    this.onExecute = null;
    this.isVoiceActive = null;

    if (action && execute) {
      execute(action);
      return true;
    }
    return false;
  }

  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pending = null;
    this.cueQueue = [];
    this.onExecute = null;
    this.isVoiceActive = null;
  }

  isPending(): boolean {
    return this.pending !== null || this.cueQueue.length > 0;
  }

  getPending(): ResolvedAction | null {
    return this.pending;
  }

  getTiming(): ActionExecutionTiming {
    return this.timing;
  }
}
