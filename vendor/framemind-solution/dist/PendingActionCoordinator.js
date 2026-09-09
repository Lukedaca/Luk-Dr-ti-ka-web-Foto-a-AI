export class PendingActionCoordinator {
    constructor() {
        this.pending = null;
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
    notifySpeakStart() {
        if (this.pending && this.timing === 'onSpeakStart') {
            return this.flush();
        }
        return false;
    }
    notifySpeakEnd() {
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
        this.onExecute = null;
        this.isVoiceActive = null;
    }
    isPending() {
        return this.pending !== null;
    }
    getPending() {
        return this.pending;
    }
    getTiming() {
        return this.timing;
    }
}
//# sourceMappingURL=PendingActionCoordinator.js.map