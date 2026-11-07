import { SpeechPrivacyGuard } from './SpeechPrivacyGuard.js';
const MAX_TEXT_CHARS = 400;
const MAX_AUDIO_BYTES = 4000000;
const MAX_TRANSCRIPT_BYTES = 16384;
const MAX_SPEECH_BYTES = 8000000;
/**
 * A fail-closed server adapter, not a voice engine. The configured service must
 * implement the FrameMind voice HTTP contract and host the actual models.
 */
export class FrameMindVoiceAdapter {
    constructor(options) {
        var _a, _b;
        this.id = 'framemind-voice';
        if (typeof window !== 'undefined')
            throw new Error('Voice service adapter is server-only');
        this.baseUrl = checkedBaseUrl(options.baseUrl);
        this.token = options.serviceToken.trim();
        if (!this.token || /[\r\n]/.test(this.token))
            throw new Error('Voice service token is required');
        this.tenant = structuredClone(options.tenant);
        this.dataPolicy = options.dataPolicy;
        this.voices = { ...options.voiceByLocale };
        this.fetcher = (_a = options.fetcher) !== null && _a !== void 0 ? _a : ((url, init) => fetch(url, init));
        this.timeoutMs = (_b = options.timeoutMs) !== null && _b !== void 0 ? _b : 60000;
        if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 120000) {
            throw new Error('Invalid voice service timeout');
        }
        this.enabled = this.tenant.voice.enabled && this.tenant.voice.mode === 'managed' && this.tenant.voice.provider === this.id;
    }
    async transcribe(request) {
        this.assertEnabled(request.locale);
        if (request.voiceActivated !== true)
            throw new Error('Voice request denied: voice-not-activated');
        const decision = this.dataPolicy.authorizeEgress({
            tenantId: this.tenant.tenantId,
            audience: this.tenant.audience,
            provider: this.id,
            purpose: 'speech-to-text',
            dataClass: 'visitor-content',
            processingMode: this.tenant.processingMode,
            ...(this.tenant.voice.region ? { region: this.tenant.voice.region } : {}),
            voiceActivated: request.voiceActivated === true,
        });
        if (!decision.allowed)
            throw new Error('Voice transcription denied: ' + decision.reason);
        if (!(request.audio instanceof ArrayBuffer) || request.audio.byteLength < 44 || request.audio.byteLength > MAX_AUDIO_BYTES || !isWav(request.audio)) {
            throw new Error('Invalid voice audio');
        }
        const { bytes } = await this.request('v1/transcribe', {
            method: 'POST',
            headers: { 'content-type': 'audio/wav', 'x-framemind-locale': request.locale },
            body: request.audio,
        }, MAX_TRANSCRIPT_BYTES, request.signal);
        let payload;
        try {
            payload = JSON.parse(new TextDecoder().decode(bytes));
        }
        catch {
            throw new Error('Invalid voice transcription response');
        }
        const text = payload && typeof payload === 'object' && 'text' in payload && typeof payload.text === 'string'
            ? payload.text.trim() : '';
        if (!text || text.length > 4000)
            throw new Error('Invalid voice transcription response');
        return { text, providerId: this.id, locale: request.locale };
    }
    async synthesize(request) {
        var _a;
        this.assertEnabled(request.locale);
        if (request.voiceActivated !== true)
            throw new Error('Voice request denied: voice-not-activated');
        const text = typeof request.text === 'string' ? request.text.trim() : '';
        if (!text || text.length > MAX_TEXT_CHARS)
            throw new Error('Invalid speech text');
        const origin = (_a = request.origin) !== null && _a !== void 0 ? _a : 'visitor';
        if (origin !== 'visitor' && origin !== 'internal' && origin !== 'verified-public-knowledge') {
            throw new Error('Invalid speech text origin');
        }
        const voice = this.voices[request.locale];
        if (!voice || !/^[a-zA-Z0-9_-]{1,64}$/.test(voice) || (request.voice && request.voice !== voice)) {
            throw new Error('Voice is not configured for this locale');
        }
        const decision = new SpeechPrivacyGuard(this.dataPolicy, this.tenant)
            .authorizeTts(text, origin, request.voiceActivated === true);
        if (!decision.allowed)
            throw new Error('Voice synthesis denied: ' + decision.reason);
        const { bytes, contentType } = await this.request('v1/synthesize', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text, locale: request.locale, voice }),
        }, MAX_SPEECH_BYTES, request.signal);
        if (contentType !== 'audio/wav' && contentType !== 'audio/mpeg')
            throw new Error('Invalid voice audio response');
        if (!bytes.byteLength)
            throw new Error('Empty voice audio response');
        return { audio: bytes.buffer, contentType, providerId: this.id, voice };
    }
    assertEnabled(locale) {
        if (!this.enabled)
            throw new Error('Voice adapter is not enabled for this tenant');
        if (!this.tenant.voice.locales.includes(locale))
            throw new Error('Voice locale is not configured for this tenant');
    }
    async request(path, init, limit, signal) {
        var _a;
        if (signal === null || signal === void 0 ? void 0 : signal.aborted)
            throw new DOMException('Voice request aborted', 'AbortError');
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal === null || signal === void 0 ? void 0 : signal.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(abort, this.timeoutMs);
        try {
            const headers = new Headers(init.headers);
            headers.set('authorization', 'Bearer ' + this.token);
            headers.set('x-framemind-tenant', this.tenant.tenantId);
            const response = await this.fetcher(new URL(path, this.baseUrl).toString(), {
                ...init, headers, signal: controller.signal, redirect: 'error', cache: 'no-store',
            });
            if (!response.ok)
                throw new Error('Voice service request failed with ' + response.status);
            const contentType = ((_a = (response.headers.get('content-type') || '').split(';')[0]) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase()) || '';
            const bytes = await readLimited(response, limit);
            return { bytes, contentType };
        }
        finally {
            clearTimeout(timer);
            signal === null || signal === void 0 ? void 0 : signal.removeEventListener('abort', abort);
        }
    }
}
function isWav(audio) {
    const bytes = new Uint8Array(audio, 0, 12);
    return bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 &&
        bytes[8] === 87 && bytes[9] === 65 && bytes[10] === 86 && bytes[11] === 69;
}
function checkedBaseUrl(value) {
    let url;
    try {
        url = new URL(value);
    }
    catch {
        throw new Error('Invalid voice service URL');
    }
    const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash) {
        throw new Error('Voice service URL must use HTTPS or loopback HTTP');
    }
    if (!url.pathname.endsWith('/'))
        url.pathname += '/';
    return url;
}
async function readLimited(response, limit) {
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > limit)
        throw new Error('Voice response is too large');
    if (!response.body)
        throw new Error('Voice response is empty');
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done)
                break;
            total += value.byteLength;
            if (total > limit) {
                await reader.cancel();
                throw new Error('Voice response is too large');
            }
            chunks.push(value);
        }
    }
    finally {
        reader.releaseLock();
    }
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return result;
}
//# sourceMappingURL=FrameMindVoiceAdapter.js.map