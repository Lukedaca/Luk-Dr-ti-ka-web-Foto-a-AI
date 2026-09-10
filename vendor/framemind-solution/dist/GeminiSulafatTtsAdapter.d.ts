import type { GeminiFetch } from './GeminiFlashAdapter.js';
export interface GeminiSulafatTtsOptions {
    /** Server-side only. Never put this value into a browser bundle. */
    apiKey: string;
    endpoint?: string;
    fetcher?: GeminiFetch;
}
export interface TtsSynthesisResponse {
    audioBase64: string;
    providerId: 'google-gemini-tts';
    model: string;
    voice: 'Sulafat';
}
/** Optional remote voice; sensitive output returns null for browser-TTS fallback. */
export declare class GeminiSulafatTtsAdapter {
    readonly id = "google-gemini-tts";
    readonly enabled: boolean;
    private readonly key;
    private readonly endpoint;
    private readonly fetcher;
    constructor(options: GeminiSulafatTtsOptions);
    synthesize(text: string, locale?: string): Promise<TtsSynthesisResponse | null>;
}
//# sourceMappingURL=GeminiSulafatTtsAdapter.d.ts.map