import { SafetyShield } from './SafetyShield.js';
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
export class GeminiSulafatTtsAdapter {
  readonly id = 'google-gemini-tts';
  readonly enabled: boolean;
  private readonly key: string;
  private readonly endpoint: string;
  private readonly fetcher: GeminiFetch;

  constructor(options: GeminiSulafatTtsOptions) {
    this.key = options.apiKey.trim();
    this.enabled = Boolean(this.key);
    this.endpoint = (options.endpoint || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
    this.fetcher = options.fetcher ?? ((url, init) => fetch(url, init));
  }

  async synthesize(text: string, locale = 'cs-CZ'): Promise<TtsSynthesisResponse | null> {
    const safeText = String(text || '').trim().slice(0, 4_000);
    if (!this.enabled || !SafetyShield.isSafeForProvider(safeText)) return null;
    const response = await this.fetcher(this.endpoint + '/interactions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': this.key },
      body: JSON.stringify({
        model: 'gemini-3.1-flash-tts-preview',
        store: false,
        input: 'Read naturally in ' + locale + ':\n' + safeText,
        response_format: { type: 'audio' },
        generation_config: { speech_config: [{ voice: 'Sulafat' }] },
      }),
    });
    if (!response.ok) throw new Error('Gemini TTS request failed with ' + response.status);
    const audioBase64 = ((await response.json()) as { output_audio?: { data?: unknown } }).output_audio?.data;
    if (typeof audioBase64 !== 'string' || !audioBase64) throw new Error('Gemini TTS returned no audio');
    return { audioBase64, providerId: 'google-gemini-tts', model: 'gemini-3.1-flash-tts-preview', voice: 'Sulafat' };
  }
}