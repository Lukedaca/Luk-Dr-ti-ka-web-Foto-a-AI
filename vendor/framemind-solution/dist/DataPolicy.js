export const DATA_MODES = Object.freeze(['minimal', 'support', 'lead']);
export const PROCESSING_MODES = Object.freeze(['strict', 'managed']);
export const VOICE_MODES = Object.freeze(['off', 'local', 'managed']);
export const AUDIENCE_PROFILES = Object.freeze(['general', 'may-include-minors']);
export const DATA_CLASSES = Object.freeze([
    'public-data', 'visitor-content', 'visitor-personal-data', 'sensitive-data', 'internal-data', 'operational-metadata',
]);
export const EGRESS_PURPOSES = Object.freeze([
    'managed-llm', 'speech-to-text', 'text-to-speech', 'telemetry', 'lead-delivery', 'support-workflow', 'visitor-memory',
]);
export const DEFAULT_TRANSCRIPT_RETENTION_DAYS = 30;
const dataModes = new Set(DATA_MODES);
const knownDataClasses = new Set(DATA_CLASSES);
const knownPurposes = new Set(EGRESS_PURPOSES);
const knownAudiences = new Set(AUDIENCE_PROFILES);
export function normalizeDataMode(value) {
    const mode = String(value !== null && value !== void 0 ? value : '').trim().toLowerCase();
    return dataModes.has(mode) ? mode : 'minimal';
}
export function parseFlag(value, fallback = false) {
    return value === '1' || value === 1 || value === true ? true : value === '0' || value === 0 || value === false ? false : fallback;
}
export function parseTranscriptRetentionDays(value, fallback = DEFAULT_TRANSCRIPT_RETENTION_DAYS) {
    const days = Number(value);
    return Number.isInteger(days) && days >= 1 && days <= 3650 ? days : fallback;
}
export function parseRecipientList(...values) {
    const recipients = [];
    const seen = new Set();
    for (const raw of values.flat()) {
        for (const part of String(raw !== null && raw !== void 0 ? raw : '').split(',')) {
            const recipient = part.trim();
            if (!recipient || recipient.length > 320 || /[\r\n]/.test(recipient) || !recipient.includes('@'))
                continue;
            const key = recipient.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                recipients.push(recipient);
            }
        }
    }
    return recipients;
}
/** Backwards-compatible retention contract. Processing and voice stay separate. */
export function resolveDataPolicy(readEnv = () => undefined) {
    const mode = normalizeDataMode(readEnv('FRAMEMIND_DATA_MODE'));
    const customerContentMode = mode === 'support' || mode === 'lead';
    const transcriptStorageEnabled = customerContentMode && parseFlag(readEnv('CHAT_TRANSCRIPT_STORAGE_ENABLED'));
    const leadBriefEnabled = (mode === 'lead' || customerContentMode) && parseFlag(readEnv('LEAD_BRIEF_ENABLED'));
    return Object.freeze({
        mode,
        transcriptStorageEnabled,
        transcriptEmailEnabled: transcriptStorageEnabled && parseFlag(readEnv('CHAT_TRANSCRIPT_EMAIL_ENABLED')),
        sheetsEnabled: transcriptStorageEnabled && parseFlag(readEnv('CHAT_SHEETS_ENABLED')),
        leadBriefEnabled,
        supportAccessEnabled: customerContentMode && parseFlag(readEnv('FRAMEMIND_SUPPORT_ACCESS')),
        anonymousTelemetryEnabled: parseFlag(readEnv('ANONYMOUS_TELEMETRY_ENABLED'), true),
        transcriptRetentionDays: transcriptStorageEnabled ? parseTranscriptRetentionDays(readEnv('CHAT_TRANSCRIPT_RETENTION_DAYS')) : null,
    });
}
export function planTranscriptPipeline(policy) {
    return Object.freeze({
        storage: Boolean(policy.transcriptStorageEnabled),
        email: Boolean(policy.transcriptStorageEnabled && policy.transcriptEmailEnabled),
        sheets: Boolean(policy.transcriptStorageEnabled && policy.sheetsEnabled),
        leadBrief: Boolean(policy.leadBriefEnabled),
    });
}
function deepFreeze(obj) {
    if (obj === null || typeof obj !== 'object')
        return obj;
    Object.freeze(obj);
    for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (val && typeof val === 'object' && !Object.isFrozen(val)) {
            deepFreeze(val);
        }
    }
    return obj;
}
function validateAndNormalizeTenant(t) {
    var _a, _b;
    if (!t.tenantId || typeof t.tenantId !== 'string')
        throw new Error('Invalid tenantId');
    if (t.telemetry && t.telemetry.customerContentAllowed === true) {
        throw new Error('Tenant telemetry cannot allow customer content');
    }
    if (t.dataMode === 'minimal' && ((_a = t.retention) === null || _a === void 0 ? void 0 : _a.transcript)) {
        throw new Error('Tenant in minimal dataMode cannot persist transcripts');
    }
    const cloned = structuredClone(t);
    if (cloned.processingMode === 'strict' && cloned.managedProvider) {
        cloned.managedProvider.enabled = false;
    }
    if (((_b = cloned.voice) === null || _b === void 0 ? void 0 : _b.mode) === 'off' && cloned.voice) {
        cloned.voice.enabled = false;
    }
    return deepFreeze(cloned);
}
export class DataPolicy {
    constructor(tenants = [], providers = []) {
        this.tenants = new Map();
        this.providers = new Map();
        for (const tenant of tenants) {
            if (!(tenant === null || tenant === void 0 ? void 0 : tenant.tenantId) || this.tenants.has(tenant.tenantId))
                continue;
            const normalized = validateAndNormalizeTenant(tenant);
            this.tenants.set(normalized.tenantId, normalized);
        }
        for (const provider of providers) {
            if (!(provider === null || provider === void 0 ? void 0 : provider.id) || this.providers.has(provider.id))
                continue;
            const cloned = deepFreeze(structuredClone(provider));
            this.providers.set(cloned.id, cloned);
        }
    }
    authorizeEgress(request) {
        if (!request || !this.tenants.has(request.tenantId))
            return deny('unknown-tenant');
        if (!knownAudiences.has(request.audience))
            return deny('unknown-audience');
        if (!knownDataClasses.has(request.dataClass))
            return deny('unknown-data-class');
        if (!knownPurposes.has(request.purpose))
            return deny('unknown-purpose');
        if (request.dataClass === 'sensitive-data' || request.dataClass === 'internal-data')
            return deny('protected-data-class');
        if (request.dataClass === 'visitor-personal-data' && (request.purpose === 'managed-llm' || request.purpose === 'text-to-speech' || request.purpose === 'visitor-memory')) {
            return deny('visitor-personal-data-denied');
        }
        const tenant = this.tenants.get(request.tenantId);
        if (tenant.audience !== request.audience || tenant.processingMode !== request.processingMode)
            return deny('tenant-policy-mismatch');
        // All egress destinations (including telemetry) require a registered, verified provider
        const provider = this.providers.get(request.provider);
        if (!provider)
            return deny('unknown-provider');
        if (!provider.supportedPurposes.includes(request.purpose))
            return deny('provider-purpose-denied');
        if (!validVerification(provider))
            return deny('provider-compliance-unverified');
        if (!provider.allowedAudiences.includes(tenant.audience))
            return deny('provider-audience-denied');
        // Required deployment boundary enforcement: omission cannot bypass region rules
        if (provider.allowedRegions.length > 0) {
            if (!request.region || !provider.allowedRegions.includes(request.region)) {
                return deny('provider-region-denied');
            }
        }
        if (request.purpose === 'telemetry') {
            return request.dataClass === 'operational-metadata' && tenant.telemetry.enabled && tenant.telemetry.customerContentAllowed === false
                ? allow('operational-metadata-only') : deny('telemetry-content-denied');
        }
        if (request.purpose === 'managed-llm') {
            const configured = tenant.managedProvider;
            const isProviderMatch = (configured === null || configured === void 0 ? void 0 : configured.provider) === request.provider ||
                ((configured === null || configured === void 0 ? void 0 : configured.provider) === 'gemini' && (request.provider === 'google-gemini-3.8-flash' || request.provider === 'gemini'));
            return tenant.processingMode === 'managed' && (configured === null || configured === void 0 ? void 0 : configured.enabled) === true && isProviderMatch
                ? allow('managed-provider-configured') : deny('managed-provider-disabled');
        }
        if (request.purpose === 'speech-to-text' || request.purpose === 'text-to-speech') {
            const voice = tenant.voice;
            if (!voice.enabled || voice.mode !== 'managed' || voice.provider !== request.provider)
                return deny('managed-voice-disabled');
            if (voice.consentRequired && request.voiceActivated !== true)
                return deny('voice-not-activated');
            if (voice.region && (!request.region || voice.region !== request.region))
                return deny('voice-region-mismatch');
            return allow('managed-voice-configured');
        }
        if (request.purpose === 'visitor-memory') {
            return tenant.retention.visitorMemory ? allow('visitor-memory-configured') : deny('visitor-memory-disabled');
        }
        if (request.purpose === 'lead-delivery') {
            return tenant.retention.leads ? allow('lead-workflow-configured') : deny('lead-workflow-disabled');
        }
        if (request.purpose === 'support-workflow') {
            return tenant.dataMode === 'support' && tenant.retention.transcript ? allow('support-workflow-configured') : deny('support-workflow-disabled');
        }
        return deny('unsupported-policy-combination');
    }
    cacheScope(tenantId, provider, voice, locale, staticPhraseId) {
        if (!this.tenants.has(tenantId) || !this.providers.has(provider) || !staticPhraseId)
            return null;
        const tenant = this.tenants.get(tenantId);
        if (tenant.voice.provider !== provider)
            return null;
        if (!tenant.voice.locales.includes(locale))
            return null;
        const providerProfile = this.providers.get(provider);
        if (!providerProfile || !providerProfile.supportedPurposes.includes('text-to-speech'))
            return null;
        const safeSegment = /^[a-zA-Z0-9_-]{1,64}$/;
        if (!safeSegment.test(tenantId) || !safeSegment.test(provider) || !safeSegment.test(voice) || !safeSegment.test(locale)) {
            return null;
        }
        if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(staticPhraseId))
            return null;
        return [tenantId, provider, voice, locale, encodeURIComponent(staticPhraseId)].join(':');
    }
}
function validVerification(profile) {
    if (!profile || typeof profile !== 'object')
        return false;
    if (!profile.id || typeof profile.id !== 'string')
        return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(profile.verifiedAt))
        return false;
    const date = new Date(profile.verifiedAt);
    if (Number.isNaN(date.getTime()))
        return false;
    if (date.getFullYear() < 2024 || date.getFullYear() > 2030)
        return false;
    try {
        const url = new URL(profile.documentationUrl);
        if (url.protocol !== 'https:')
            return false;
    }
    catch {
        return false;
    }
    if (!profile.retention || typeof profile.retention !== 'string' || profile.retention.trim().length < 3)
        return false;
    if (!profile.training || typeof profile.training !== 'string' || profile.training.trim().length < 3)
        return false;
    if (!Array.isArray(profile.allowedAudiences) || profile.allowedAudiences.length === 0)
        return false;
    if (!Array.isArray(profile.supportedPurposes) || profile.supportedPurposes.length === 0)
        return false;
    return true;
}
function allow(reason) { return Object.freeze({ allowed: true, reason }); }
function deny(reason) { return Object.freeze({ allowed: false, reason }); }
const SAFE_TELEMETRY_KEYS = new Set(['tenant', 'feature', 'provider', 'status', 'error_code', 'latency_ms', 'voice_enabled', 'processing_mode', 'data_mode']);
export function safeOperationalTelemetry(fields) {
    const event = {};
    for (const [key, value] of Object.entries(fields)) {
        if (!SAFE_TELEMETRY_KEYS.has(key))
            continue;
        if (typeof value === 'boolean' || typeof value === 'number')
            event[key] = value;
        else if (typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,80}$/.test(value))
            event[key] = value;
    }
    return Object.freeze(event);
}
//# sourceMappingURL=DataPolicy.js.map