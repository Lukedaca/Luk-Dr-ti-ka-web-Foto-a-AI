import { DataPolicy } from './DataPolicy.js';
import { SafetyShield } from './SafetyShield.js';
import type { EgressAuthorization, TenantDeploymentPolicy } from './types.js';

export type SpeechContentOrigin = 'verified-public-knowledge' | 'visitor' | 'internal';
const VISITOR_CONTACT = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\b[1-9]\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/i;
const SENSITIVE_CONTENT = /\b(?:heslo|password|rodne\s+cislo|health|zdravotni|diagnos)/i;

export class SpeechPrivacyGuard {
  constructor(private readonly dataPolicy: DataPolicy, private readonly tenant: TenantDeploymentPolicy) {}
  authorizeTts(text: string, origin: SpeechContentOrigin, voiceActivated: boolean): EgressAuthorization {
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
      provider: this.tenant.voice.provider ?? '',
      purpose: 'text-to-speech',
      dataClass,
      processingMode: this.tenant.processingMode,
      ...(this.tenant.voice.region ? { region: this.tenant.voice.region } : {}),
      voiceActivated,
    });
  }
}
