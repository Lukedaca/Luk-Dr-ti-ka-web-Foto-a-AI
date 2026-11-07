import type { DataPolicy } from './DataPolicy.js';
import type { SpeechToTextProvider, SpeechToTextRequest, SpeechToTextResponse, TenantDeploymentPolicy, TextToSpeechProvider, TextToSpeechRequest, TextToSpeechResponse } from './types.js';
/** Server-side connection to a separately deployed FrameMind voice service. */
export interface FrameMindVoiceAdapterOptions {
    baseUrl: string;
    /** Secret for the voice service; never send it to a browser. */
    serviceToken: string;
    tenant: TenantDeploymentPolicy;
    dataPolicy: DataPolicy;
    /** Voices are configured per tenant, not selected from visitor input. */
    voiceByLocale: Record<string, string>;
    fetcher?: (url: string, init: RequestInit) => Promise<Response>;
    timeoutMs?: number;
}
/**
 * A fail-closed server adapter, not a voice engine. The configured service must
 * implement the FrameMind voice HTTP contract and host the actual models.
 */
export declare class FrameMindVoiceAdapter implements SpeechToTextProvider, TextToSpeechProvider {
    readonly id = "framemind-voice";
    readonly enabled: boolean;
    private readonly baseUrl;
    private readonly token;
    private readonly tenant;
    private readonly dataPolicy;
    private readonly voices;
    private readonly fetcher;
    private readonly timeoutMs;
    constructor(options: FrameMindVoiceAdapterOptions);
    transcribe(request: SpeechToTextRequest): Promise<SpeechToTextResponse>;
    synthesize(request: TextToSpeechRequest): Promise<TextToSpeechResponse>;
    private assertEnabled;
    private request;
}
//# sourceMappingURL=FrameMindVoiceAdapter.d.ts.map