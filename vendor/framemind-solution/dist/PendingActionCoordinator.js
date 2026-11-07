export class PendingActionCoordinator {
    constructor() {
        this.pending = null;
        this.cueQueue = [];
        this.timer = null;
        this.onExecute = null;
        this.isVoiceActive = null;
        this.timing = 'onSpeakEnd';
    }
    schedule(action, onExecute, isVoiceActive, options = {}) {
        var _a, _b;
        this.cancel();
        this.pending = action;
        this.onExecute = onExecute;
        this.isVoiceActive = isVoiceActive;
        this.timing = (_a = options.timing) !== null && _a !== void 0 ? _a : 'onSpeakEnd';
        const failsafeMs = (_b = options.failsafeMs) !== null && _b !== void 0 ? _b : 5000;
        // If voice is not active right now and timing is start, we execute immediately
        if (!this.isVoiceActive() && this.timing === 'onSpeakStart') {
            this.flush();
            return;
        }
        const armFailsafe = () => {
            this.timer = setTimeout(() => {
                var _a;
                this.timer = null;
                if ((_a = this.isVoiceActive) === null || _a === void 0 ? void 0 : _a.call(this)) {
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
    scheduleSequence(steps, onExecute, isVoiceActive, failsafeMs = 6000) {
        this.cancel();
        if (!Array.isArray(steps) || steps.length === 0)
            return;
        this.cueQueue = steps.map((s) => {
            var _a, _b;
            return ({
                ...s,
                sentenceIndex: (_a = s.sentenceIndex) !== null && _a !== void 0 ? _a : 0,
                timing: (_b = s.timing) !== null && _b !== void 0 ? _b : 'onCue',
            });
        });
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
    notifyCuePoint(sentenceIndex) {
        var _a;
        if (!this.onExecute || this.cueQueue.length === 0)
            return 0;
        const execute = this.onExecute;
        const ready = [];
        const remaining = [];
        for (const step of this.cueQueue) {
            if (((_a = step.sentenceIndex) !== null && _a !== void 0 ? _a : 0) <= sentenceIndex && step.timing !== 'onSpeakEnd') {
                ready.push(step);
            }
            else {
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
    flushSequence() {
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
        if (!execute || steps.length === 0)
            return 0;
        for (const step of steps) {
            execute(step.action);
        }
        return steps.length;
    }
    notifySpeakStart() {
        if (this.cueQueue.length > 0) {
            this.notifyCuePoint(0);
        }
        if (this.pending && this.timing === 'onSpeakStart') {
            return this.flush();
        }
        return false;
    }
    notifySpeakEnd() {
        if (this.cueQueue.length > 0) {
            const count = this.flushSequence();
            if (!this.pending)
                return count > 0;
        }
        if (this.pending && this.timing === 'onSpeakEnd') {
            return this.flush();
        }
        return false;
    }
    flush() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this.cueQueue.length > 0) {
            const count = this.flushSequence();
            if (!this.pending)
                return count > 0;
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
    cancel() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.pending = null;
        this.cueQueue = [];
        this.onExecute = null;
        this.isVoiceActive = null;
    }
    isPending() {
        return this.pending !== null || this.cueQueue.length > 0;
    }
    getPending() {
        return this.pending;
    }
    getTiming() {
        return this.timing;
    }
}
//# sourceMappingURL=PendingActionCoordinator.js.map