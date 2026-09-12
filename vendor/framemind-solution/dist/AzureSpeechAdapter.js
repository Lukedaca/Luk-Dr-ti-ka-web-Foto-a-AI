/** Stateless server adapter. Browser audio should go directly to Azure with an issued short-lived token. */
export class AzureSpeechAdapter {
    constructor(options) {
        var _a, _b;
        this.id = 'azure-speech';
        this.apiKey = options.apiKey.trim();
        this.region = options.region.trim().toLowerCase();
        this.enabled = Boolean(this.apiKey && this.region);
        this.voiceByLocale = {
            'cs-CZ': 'cs-CZ-VlastaNeural',
            'en-US': 'en-US-JennyNeural',
            'en-GB': 'en-GB-SoniaNeural',
            ...((_a = options.voiceByLocale) !== null && _a !== void 0 ? _a : {}),
        };
        this.fetcher = (_b = options.fetcher) !== null && _b !== void 0 ? _b : ((url, init) => fetch(url, init));
        this.dataPolicy = options.dataPolicy;
        this.tenantPolicy = options.tenantPolicy;
    }
    async issueAuthorizationToken(signal, voiceActivated = true) {
        this.assertConfigured();
        if (this.dataPolicy && this.tenantPolicy) {
            const auth = this.dataPolicy.authorizeEgress({
                tenantId: this.tenantPolicy.tenantId,
                audience: this.tenantPolicy.audience,
                provider: this.id,
                purpose: 'speech-to-text',
                dataClass: 'visitor-content',
                processingMode: this.tenantPolicy.processingMode,
                region: this.region,
                voiceActivated,
            });
            if (!auth.allowed)
                throw new Error('Azure Speech token egress denied: ' + auth.reason);
        }
        const response = await this.fetcher('https://' + this.region + '.api.cognitive.microsoft.com/sts/v1.0/issueToken', {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': this.apiKey,
                'content-type': 'application/x-www-form-urlencoded',
                'content-length': '0',
            },
            ...(signal ? { signal } : {}),
        });
        const token = (await response.text()).trim();
        if (!response.ok || !token)
            throw new Error('Azure Speech token request failed with ' + response.status);
        return { token, region: this.region, expiresInSeconds: 600 };
    }
    async transcribe(request) {
        this.assertConfigured();
        if (this.dataPolicy && this.tenantPolicy) {
            const auth = this.dataPolicy.authorizeEgress({
                tenantId: this.tenantPolicy.tenantId,
                audience: this.tenantPolicy.audience,
                provider: this.id,
                purpose: 'speech-to-text',
                dataClass: 'visitor-content',
                processingMode: this.tenantPolicy.processingMode,
                region: this.region,
                voiceActivated: true,
            });
            if (!auth.allowed)
                throw new Error('Azure Speech transcribe egress denied: ' + auth.reason);
        }
        const response = await this.fetcher('https://' + this.region + '.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=' + encodeURIComponent(request.locale), {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': this.apiKey,
                'content-type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
            },
            body: request.audio,
            ...(request.signal ? { signal: request.signal } : {}),
        });
        const payload = await response.json();
        const text = typeof payload.DisplayText === 'string' ? payload.DisplayText.trim() : '';
        if (!response.ok || !text)
            throw new Error('Azure Speech transcription failed with ' + response.status);
        return { text, providerId: this.id, locale: request.locale };
    }
    async synthesize(request) {
        var _a, _b;
        this.assertConfigured();
        if (this.dataPolicy && this.tenantPolicy) {
            const auth = this.dataPolicy.authorizeEgress({
                tenantId: this.tenantPolicy.tenantId,
                audience: this.tenantPolicy.audience,
                provider: this.id,
                purpose: 'text-to-speech',
                dataClass: 'public-data',
                processingMode: this.tenantPolicy.processingMode,
                region: this.region,
                voiceActivated: true,
            });
            if (!auth.allowed)
                throw new Error('Azure Speech synthesize egress denied: ' + auth.reason);
        }
        const voice = (_a = request.voice) !== null && _a !== void 0 ? _a : resolveVoice(this.voiceByLocale, request.locale);
        if (!voice)
            throw new Error('Azure Speech voice is not configured for ' + request.locale);
        const text = String((_b = request.text) !== null && _b !== void 0 ? _b : '').trim().slice(0, 4000);
        if (!text)
            throw new Error('Azure Speech synthesis requires text');
        const ssml = '<speak version="1.0" xml:lang="' + escapeXml(request.locale) + '"><voice name="' + escapeXml(voice) + '">' + escapeXml(text) + '</voice></speak>';
        const response = await this.fetcher('https://' + this.region + '.tts.speech.microsoft.com/cognitiveservices/v1', {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': this.apiKey,
                'content-type': 'application/ssml+xml',
                'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
                'User-Agent': 'framemind-solution',
            },
            body: ssml,
            ...(request.signal ? { signal: request.signal } : {}),
        });
        if (!response.ok)
            throw new Error('Azure Speech synthesis failed with ' + response.status);
        return {
            audio: await response.arrayBuffer(),
            contentType: response.headers.get('content-type') || 'audio/mpeg',
            providerId: this.id,
            voice,
        };
    }
    assertConfigured() {
        if (!this.enabled)
            throw new Error('Azure Speech adapter is not configured');
    }
}
function resolveVoice(mapping, locale) {
    var _a;
    if (mapping[locale])
        return mapping[locale];
    const prefix = (_a = locale.split('-')[0]) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    if (prefix && mapping[prefix + '-*'])
        return mapping[prefix + '-*'];
    if (prefix === 'cs')
        return mapping['cs-CZ'];
    if (prefix === 'en')
        return mapping['en-US'] || mapping['en-GB'];
    return undefined;
}
function escapeXml(value) {
    return value.replace(/[<>&'"]/g, (char) => { var _a; return (_a = ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char]) !== null && _a !== void 0 ? _a : char; });
}
//# sourceMappingURL=AzureSpeechAdapter.js.map