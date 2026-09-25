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

function enumValue(value, allowed, fallback) {
  return value && allowed.includes(value) ? value : fallback;
}

// Gemini fallback uvnitř FrameMind Solution je fail-closed (stejně jako Viktorka):
// zapne se jen s kompletním, zdokumentovaným souhlasovým profilem v env. Chybí-li
// cokoli z toho, FMS nikdy nepošle text poskytovateli a odpovídá lokálně.
export function isGeminiFallbackConfigured(readEnv = runtimeEnv) {
  return parseFlag(readEnv('FRAMEMIND_MANAGED_LLM_ENABLED'))
    && readEnv('FRAMEMIND_MANAGED_LLM_PROVIDER') === 'gemini'
    && parseFlag(readEnv('FRAMEMIND_GEMINI_FALLBACK_ENABLED'))
    && parseFlag(readEnv('FRAMEMIND_GEMINI_COMPLIANCE_VERIFIED'))
    && /^\d{4}-\d{2}-\d{2}/.test(String(readEnv('FRAMEMIND_GEMINI_VERIFIED_AT') || ''))
    && /^https:\/\//.test(String(readEnv('FRAMEMIND_GEMINI_DOCUMENTATION_URL') || ''));
}

export function createPersonalPortfolioTenantPolicy(readEnv = runtimeEnv) {
  const dataMode = enumValue(readEnv('LUKAS_DATA_MODE'), ['minimal', 'support', 'lead'], 'minimal');
  const processingMode = enumValue(readEnv('LUKAS_PROCESSING_MODE'), ['strict', 'managed'], 'strict');
  const voiceProvider = enumValue(readEnv('LUKAS_VOICE_PROVIDER'), ['off', 'local', 'azure'], 'local');
  const managedAzure = parseFlag(readEnv('LUKAS_VOICE_ENABLED')) && voiceProvider === 'azure';
  const region = String(readEnv('AZURE_SPEECH_REGION') || '').trim().toLowerCase();
  const geminiFallback = isGeminiFallbackConfigured(readEnv);

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
      retention: 'Real-time Speech processing; see provider documentation and deployment profile.',
      training: 'Must be verified in the provider register before each production release.',
      verifiedAt: '2026-09-11',
      documentationUrl: 'https://learn.microsoft.com/en-us/azure/ai-services/speech-service/regions?tabs=geographies',
    });
  }

  // Tvrzení o retenci/trénování se tu nepíší natvrdo — datum ověření a odkaz na
  // dokumentaci musí dodat nasazení (env), jinak se Gemini do registru vůbec nedostane.
  if (isGeminiFallbackConfigured(readEnv)) {
    providers.push({
      id: GEMINI_PROVIDER_ID,
      allowedAudiences: ['general'],
      supportedPurposes: ['managed-llm'],
      allowedRegions: [],
      retention: 'Deployment-specific; documented approval is required before use.',
      training: 'Deployment-specific; documented approval is required before use.',
      verifiedAt: String(readEnv('FRAMEMIND_GEMINI_VERIFIED_AT')),
      documentationUrl: String(readEnv('FRAMEMIND_GEMINI_DOCUMENTATION_URL')),
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
