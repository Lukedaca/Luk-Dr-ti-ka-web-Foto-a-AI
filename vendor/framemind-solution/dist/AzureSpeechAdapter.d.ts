import type { DataPolicy } from './DataPolicy.js';
import type { SpeechToTextProvider, SpeechToTextRequest, SpeechToTextResponse, TenantDeploymentPolicy, TextToSpeechProvider, TextToSpeechRequest, TextToSpeechResponse } from './types.js';
export type AzureSpeechFetch = (url: string, init: RequestInit) => Promise<Response>;
export interface AzureSpeechAdapterOptions {
    /** Server-side only. Never expose this key in a browser bundle. */
    apiKey: string;
    /** Runtime configuration. Must exactly match the Speech resource region. */
    region: string;
    voiceByLocale?: Record<string, string>;
    fetcher?: AzureSpeechFetch;
    dataPolicy?: DataPolicy;
    tenantPolicy?: TenantDeploymentPolicy;
}
export interface AzureSpeechAuthorizationToken {
    token: string;
    region: string;
    expiresInSeconds: 600;
}
/** Stateless server adapter. Browser audio should go directly to Azure with an issued short-lived token. */
export declare class AzureSpeechAdapter implements SpeechToTextProvider, TextToSpeechProvider {
    readonly id = "azure-speech";
    readonly enabled: boolean;
    private readonly apiKey;
    private readonly region;
    private readonly voiceByLocale;
    private readonly fetcher;
    private readonly dataPolicy;
    private readonly tenantPolicy;
    constructor(options: AzureSpeechAdapterOptions);
    issueAuthorizationToken(signal?: AbortSignal, voiceActivated?: boolean): Promise<AzureSpeechAuthorizationToken>;
    transcribe(request: SpeechToTextRequest): Promise<SpeechToTextResponse>;
    synthesize(request: TextToSpeechRequest): Promise<TextToSpeechResponse>;
    private assertConfigured;
}
//# sourceMappingURL=AzureSpeechAdapter.d.ts.map