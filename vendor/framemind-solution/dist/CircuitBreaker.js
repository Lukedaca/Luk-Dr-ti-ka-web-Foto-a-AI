export class CircuitBreaker {
    constructor(threshold = 3, resetAfterMs = 30000) {
        this.threshold = threshold;
        this.resetAfterMs = resetAfterMs;
        this.failures = 0;
        this.openedAt = 0;
    }
    canAttempt(now = Date.now()) {
        if (this.failures < this.threshold)
            return true;
        if (now - this.openedAt >= this.resetAfterMs) {
            this.failures = 0;
            this.openedAt = 0;
            return true;
        }
        return false;
    }
    success() {
        this.failures = 0;
        this.openedAt = 0;
    }
    failure(now = Date.now()) {
        this.failures += 1;
        if (this.failures >= this.threshold)
            this.openedAt = now;
    }
}
//# sourceMappingURL=CircuitBreaker.js.map