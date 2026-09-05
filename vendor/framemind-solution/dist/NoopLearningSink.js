export class NoopLearningSink {
    constructor() {
        this.id = 'noop';
    }
    async record(_event) {
        // Intentionally empty: v1 never exports raw or pseudonymized conversations.
    }
}
//# sourceMappingURL=NoopLearningSink.js.map