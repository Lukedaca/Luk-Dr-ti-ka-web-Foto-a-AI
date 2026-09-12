import {
  DataPolicy,
  GeminiFlashAdapter,
  parseFlag,
} from '../../vendor/framemind-solution/dist/index.js';

export const PORTFOLIO_TENANT_ID = 'lukas-portfolio';
export const LOCAL_MEMORY_PROVIDER_ID = 'local-memory';
export const AZURE_SPEECH_PROVIDER_ID = 'azure-speech';
export const GEMINI_PROVIDER_ID = 'gemini';

export function runtimeEnv(name) {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name];
  }
  return undefined;
}

export function createPersonalPortfolioTenantPolicy(readEnv = runtimeEnv) {
  const dataMode = readEnv('LUKAS_DATA_MODE') || 'minimal';
  const processingMode = readEnv('LUKAS_PROCESSING_MODE') || 'strict';
  const voiceProvider = readEnv('LUKAS_VOICE_PROVIDER') || 'local';
  const managedAzure = parseFlag(readEnv('LUKAS_VOICE_ENABLED')) && voiceProvider === 'azure';
  const region = String(readEnv('AZURE_SPEECH_REGION') || '').trim().toLowerCase();
  const geminiFallback = parseFlag(readEnv('GEMINI_FALLBACK_ENABLED'));

  return {
    tenantId: readEnv('LUKAS_TENANT_ID') || PORTFOLIO_TENANT_ID,
    domain: readEnv('LUKAS_TENANT_DOMAIN') || 'lukasdrsticka-ai-and-foto.com',
    audience: 'general',
    processingMode,
    dataMode,
    voice: {
      enabled: managedAzure,
      mode: managedAzure ? 'managed' : voiceProvider === 'local' ? 'local' : 'off',
      ...(managedAzure ? { provider: AZURE_SPEECH_PROVIDER_ID, region } : {}),
      locales: ['cs-CZ', 'en-US'],
      consentRequired: true,
    },
    managedProvider: {
      enabled: geminiFallback,
      provider: 'gemini',
      maxInputChars: 700,
    },
    retention: {
      transcript: false,
      visitorMemory: true, // Opt-in visitor memory with 180 days TTL and redaction
      leads: true,          // Contact inquiries
    },
    telemetry: {
      enabled: false,
      customerContentAllowed: false,
    },
  };
}

export function createPersonalPortfolioProviderRegister(readEnv = runtimeEnv) {
  const providers = [
    {
      id: LOCAL_MEMORY_PROVIDER_ID,
      allowedAudiences: ['general', 'may-include-minors'],
      supportedPurposes: ['visitor-memory'],
      allowedRegions: [],
      retention: 'local memory with opt-in and 180-day TTL',
      training: 'never trained',
      verifiedAt: '2026-09-11',
      documentationUrl: 'https://lukasdrsticka-ai-and-foto.com/privacy.html',
    },
  ];

  const region = String(readEnv('AZURE_SPEECH_REGION') || '').trim().toLowerCase();
  if (region) {
    providers.push({
      id: AZURE_SPEECH_PROVIDER_ID,
      allowedAudiences: ['general', 'may-include-minors'],
      supportedPurposes: ['speech-to-text', 'text-to-speech'],
      allowedRegions: [region],
      retention: 'Stateless Azure Speech session',
      training: 'never trained',
      verifiedAt: '2026-09-11',
      documentationUrl: 'https://learn.microsoft.com/en-us/azure/ai-services/speech-service/',
    });
  }

  if (parseFlag(readEnv('GEMINI_FALLBACK_ENABLED'))) {
    providers.push({
      id: GEMINI_PROVIDER_ID,
      allowedAudiences: ['general', 'may-include-minors'],
      supportedPurposes: ['managed-llm'],
      allowedRegions: [],
      retention: 'Stateless API call; no training on customer content',
      training: 'never trained',
      verifiedAt: '2026-09-11',
      documentationUrl: 'https://ai.google.dev/terms',
    });
  }

  return providers;
}

export function createPersonalPortfolioDataPolicy(readEnv = runtimeEnv) {
  return new DataPolicy(
    [createPersonalPortfolioTenantPolicy(readEnv)],
    createPersonalPortfolioProviderRegister(readEnv),
  );
}
