import type { ResolvedAction } from './types.js';

export type ActionExecutionTiming = 'onSpeakStart' | 'onSpeakEnd';

export interface PendingActionOptions {
  timing?: ActionExecutionTiming;
  failsafeMs?: number;
}

export class PendingActionCoordinator {
  private pending: ResolvedAction | null = null;
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

  notifySpeakStart(): boolean {
    if (this.pending && this.timing === 'onSpeakStart') {
      return this.flush();
    }
    return false;
  }

  notifySpeakEnd(): boolean {
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
    this.onExecute = null;
    this.isVoiceActive = null;
  }

  isPending(): boolean {
    return this.pending !== null;
  }

  getPending(): ResolvedAction | null {
    return this.pending;
  }

  getTiming(): ActionExecutionTiming {
    return this.timing;
  }
}
