import type { ProviderAdapter, ProviderRequest, ProviderResponse } from './types.js';
export declare class DisabledProviderAdapter implements ProviderAdapter {
    readonly id = "disabled";
    readonly enabled = false;
    generate(_request: ProviderRequest): Promise<ProviderResponse>;
}
//# sourceMappingURL=DisabledProviderAdapter.d.ts.map