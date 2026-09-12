import type { DataPolicy } from './DataPolicy.js';
import type { ProviderAdapter, ProviderRequest, ProviderResponse, TenantDeploymentPolicy } from './types.js';
export type GeminiFetch = (url: string, init: {
    method: string;
    headers: Record<string, string>;
    body: string;
}) => Promise<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
}>;
export interface GeminiFlashAdapterOptions {
    /** Server-side only. Never put this value into a browser bundle. */
    apiKey: string;
    endpoint?: string;
    model?: string;
    fetcher?: GeminiFetch;
    dataPolicy?: DataPolicy;
    tenantPolicy?: TenantDeploymentPolicy;
}
/** Server-only, stateless fallback. No remote state, tools, grounding or files. */
export declare class GeminiFlashAdapter implements ProviderAdapter {
    readonly id = "google-gemini-3.8-flash";
    readonly enabled: boolean;
    private readonly key;
    private readonly endpoint;
    private readonly model;
    private readonly fetcher;
    private readonly dataPolicy;
    private readonly tenantPolicy;
    constructor(options: GeminiFlashAdapterOptions);
    generate(request: ProviderRequest): Promise<ProviderResponse>;
}
//# sourceMappingURL=GeminiFlashAdapter.d.ts.map