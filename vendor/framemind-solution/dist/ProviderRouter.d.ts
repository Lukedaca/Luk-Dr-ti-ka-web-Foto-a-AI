import { CircuitBreaker } from './CircuitBreaker.js';
import { DataPolicy } from './DataPolicy.js';
import { PrivacyGuard } from './PrivacyGuard.js';
import type { ContextSnapshot, ProviderAdapter, ProviderResponse, TenantDeploymentPolicy } from './types.js';
export declare class ProviderRouter {
    private readonly privacyGuard;
    private readonly circuitBreaker;
    private readonly dataPolicy?;
    private readonly tenantPolicy?;
    private readonly adapter;
    constructor(adapter: ProviderAdapter | undefined, privacyGuard: PrivacyGuard, circuitBreaker?: CircuitBreaker, dataPolicy?: DataPolicy | undefined, tenantPolicy?: TenantDeploymentPolicy | undefined);
    generate(text: string, locale: string, context: ContextSnapshot, explicitPermission: boolean, allowedContextSlots?: string[], maxInputChars?: number): Promise<ProviderResponse | null>;
}
//# sourceMappingURL=ProviderRouter.d.ts.map