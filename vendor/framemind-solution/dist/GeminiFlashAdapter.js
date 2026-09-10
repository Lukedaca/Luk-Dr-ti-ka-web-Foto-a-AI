function outputText(value) {
    var _a;
    const steps = value === null || value === void 0 ? void 0 : value.steps;
    if (!Array.isArray(steps))
        return null;
    for (let i = steps.length - 1; i >= 0; i -= 1) {
        const parts = (_a = steps[i]) === null || _a === void 0 ? void 0 : _a.content;
        if (!Array.isArray(parts))
            continue;
        for (const part of parts) {
            const text = part === null || part === void 0 ? void 0 : part.text;
            if (typeof text === 'string' && text.trim())
                return text.trim();
        }
    }
    return null;
}
/** Server-only, stateless fallback. No remote state, tools, grounding or files. */
export class GeminiFlashAdapter {
    constructor(options) {
        var _a;
        this.id = 'google-gemini-3.8-flash';
        this.key = options.apiKey.trim();
        this.enabled = Boolean(this.key);
        this.endpoint = (options.endpoint || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
        this.model = options.model || 'gemini-3.8-flash';
        this.fetcher = (_a = options.fetcher) !== null && _a !== void 0 ? _a : ((url, init) => fetch(url, init));
    }
    async generate(request) {
        if (!this.enabled)
            throw new Error('Gemini adapter is not configured');
        const context = Object.entries(request.context.slots).map(([key, value]) => key + ': ' + value).join('\n');
        const prompt = [
            'You are a concise FrameMind fallback. Use only the supplied question and approved context. Do not request personal data, invoke tools or invent facts.',
            'Locale: ' + request.locale,
            context ? 'Approved context:\n' + context : '',
            'Question:\n' + request.text,
        ].filter(Boolean).join('\n\n');
        const response = await this.fetcher(this.endpoint + '/interactions', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': this.key },
            body: JSON.stringify({
                model: this.model,
                store: false,
                input: [{ type: 'user_input', content: [{ type: 'text', text: prompt }] }],
                generation_config: { thinking_level: 'low', max_output_tokens: 800 },
            }),
        });
        if (!response.ok)
            throw new Error('Gemini request failed with ' + response.status);
        const text = outputText(await response.json());
        if (!text)
            throw new Error('Gemini returned no text');
        return { text, providerId: this.id };
    }
}
//# sourceMappingURL=GeminiFlashAdapter.js.map