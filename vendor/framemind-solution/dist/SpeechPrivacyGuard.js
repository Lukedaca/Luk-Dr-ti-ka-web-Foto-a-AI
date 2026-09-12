import { SafetyShield } from './SafetyShield.js';
const VISITOR_CONTACT = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\b[1-9]\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/i;
const SENSITIVE_CONTENT = /\b(?:heslo|password|rodne\s+cislo|health|zdravotni|diagnos)/i;
export class SpeechPrivacyGuard {
    constructor(dataPolicy, tenant) {
        this.dataPolicy = dataPolicy;
        this.tenant = tenant;
    }
    authorizeTts(text, origin, voiceActivated) {
        var _a;
        const hasPii = VISITOR_CONTACT.test(text) || SafetyShield.sanitizePii(text) !== text;
        const dataClass = origin === 'internal'
            ? 'internal-data'
            : SENSITIVE_CONTENT.test(text)
                ? 'sensitive-data'
                : hasPii
                    ? 'visitor-personal-data'
                    : origin === 'visitor'
                        ? 'visitor-content'
                        : 'public-data';
        return this.dataPolicy.authorizeEgress({
            tenantId: this.tenant.tenantId,
            audience: this.tenant.audience,
            provider: (_a = this.tenant.voice.provider) !== null && _a !== void 0 ? _a : '',
            purpose: 'text-to-speech',
            dataClass,
            processingMode: this.tenant.processingMode,
            ...(this.tenant.voice.region ? { region: this.tenant.voice.region } : {}),
            voiceActivated,
        });
    }
}
//# sourceMappingURL=SpeechPrivacyGuard.js.map