export class DisabledProviderAdapter {
    constructor() {
        this.id = 'disabled';
        this.enabled = false;
    }
    async generate(_request) {
        throw new Error('provider adapter disabled');
    }
}
//# sourceMappingURL=DisabledProviderAdapter.js.map