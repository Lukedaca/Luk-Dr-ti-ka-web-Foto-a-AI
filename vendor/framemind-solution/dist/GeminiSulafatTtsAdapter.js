import { SafetyShield } from './SafetyShield.js';
/** Optional remote voice; sensitive output returns null for browser-TTS fallback. */
export class GeminiSulafatTtsAdapter {
    constructor(options) {
        var _a;
        this.id = 'google-gemini-tts';
        this.key = options.apiKey.trim();
        this.enabled = Boolean(this.key);
        this.endpoint = (options.endpoint || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
        this.fetcher = (_a = options.fetcher) !== null && _a !== void 0 ? _a : ((url, init) => fetch(url, init));
    }
    async synthesize(text, locale = 'cs-CZ') {
        var _a;
        const safeText = String(text || '').trim().slice(0, 4000);
        if (!this.enabled || !SafetyShield.isSafeForProvider(safeText))
            return null;
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
        if (!response.ok)
            throw new Error('Gemini TTS request failed with ' + response.status);
        const audioBase64 = (_a = (await response.json()).output_audio) === null || _a === void 0 ? void 0 : _a.data;
        if (typeof audioBase64 !== 'string' || !audioBase64)
            throw new Error('Gemini TTS returned no audio');
        return { audioBase64, providerId: 'google-gemini-tts', model: 'gemini-3.1-flash-tts-preview', voice: 'Sulafat' };
    }
}
//# sourceMappingURL=GeminiSulafatTtsAdapter.js.map