export class VoiceCapability {
    async localSpeechRecognition(scope = globalThis, language = 'cs-CZ') {
        var _a, _b;
        const win = (_a = scope.window) !== null && _a !== void 0 ? _a : scope;
        const Recognition = ((_b = win.SpeechRecognition) !== null && _b !== void 0 ? _b : win.webkitSpeechRecognition);
        if (!Recognition)
            return { available: false, reason: 'api-missing' };
        if (typeof Recognition.available !== 'function')
            return { available: false, reason: 'availability-unknown' };
        let status;
        try {
            status = await Recognition.available({ langs: [language], processLocally: true });
        }
        catch {
            return { available: false, reason: 'check-failed' };
        }
        if (status !== 'available')
            return { available: false, reason: 'language-missing' };
        return {
            available: true,
            reason: 'available',
            create: () => {
                const recognition = new Recognition();
                recognition.lang = language;
                recognition.continuous = false;
                recognition.interimResults = true;
                recognition.processLocally = true;
                return recognition;
            },
        };
    }
    localTts(scope = globalThis, language = 'cs-CZ') {
        var _a, _b, _c;
        const synth = (_a = scope.speechSynthesis) !== null && _a !== void 0 ? _a : (_b = scope.window) === null || _b === void 0 ? void 0 : _b.speechSynthesis;
        if (!synth || typeof synth.getVoices !== 'function')
            return { available: false, reason: 'api-missing' };
        const voices = synth.getVoices();
        if (!voices.length)
            return { available: false, reason: 'voices-pending' };
        const prefix = (_c = language.toLowerCase().split('-')[0]) !== null && _c !== void 0 ? _c : language.toLowerCase();
        const voice = voices.find((candidate) => { var _a; return candidate.localService === true && ((_a = candidate.lang) === null || _a === void 0 ? void 0 : _a.toLowerCase().startsWith(prefix)); });
        if (!voice)
            return { available: false, reason: 'local-language-missing' };
        return { available: true, reason: 'available', voice };
    }
}
//# sourceMappingURL=VoiceCapability.js.map