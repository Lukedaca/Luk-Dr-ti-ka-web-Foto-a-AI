export declare class CircuitBreaker {
    private readonly threshold;
    private readonly resetAfterMs;
    private failures;
    private openedAt;
    constructor(threshold?: number, resetAfterMs?: number);
    canAttempt(now?: number): boolean;
    success(): void;
    failure(now?: number): void;
}
//# sourceMappingURL=CircuitBreaker.d.ts.map