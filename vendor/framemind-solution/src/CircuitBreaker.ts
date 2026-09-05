export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;

  constructor(
    private readonly threshold = 3,
    private readonly resetAfterMs = 30_000,
  ) {}

  canAttempt(now = Date.now()): boolean {
    if (this.failures < this.threshold) return true;
    if (now - this.openedAt >= this.resetAfterMs) {
      this.failures = 0;
      this.openedAt = 0;
      return true;
    }
    return false;
  }

  success(): void {
    this.failures = 0;
    this.openedAt = 0;
  }

  failure(now = Date.now()): void {
    this.failures += 1;
    if (this.failures >= this.threshold) this.openedAt = now;
  }
}
