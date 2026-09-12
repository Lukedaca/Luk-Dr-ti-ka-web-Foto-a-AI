import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AzureSpeechAdapter,
  DataPolicy,
  FrameMindEngine,
  GeminiFlashAdapter,
  GeminiSulafatTtsAdapter,
  sha256Hex,
} from '../dist/index.js';

function config(adapter) {
  return {
    mode: 'managed',
    locale: 'cs-CZ',
    intents: [],
    responses: [],
    actions: [],
    unknownResponse: 'Lokální odpověď.',
    staleResponse: 'Neaktuální odpověď.',
    provider: { enabled: true, adapter, maxInputChars: 500 },
    tenantPolicy: {
      tenantId: 'test-tenant',
      domain: 'example.invalid',
      audience: 'general',
      processingMode: 'managed',
      dataMode: 'minimal',
      voice: { enabled: false, mode: 'off', locales: [], consentRequired: true },
      managedProvider: { enabled: true, provider: adapter.id, maxInputChars: 500 },
      retention: { transcript: false, visitorMemory: false, leads: false },
      telemetry: { enabled: true, customerContentAllowed: false },
    },
    providerCompliance: [{
      id: adapter.id,
      allowedAudiences: ['general'],
      supportedPurposes: ['managed-llm'],
      allowedRegions: [],
      retention: 'stateless test adapter',
      training: 'not used for test',
      verifiedAt: '2026-09-11',
      documentationUrl: 'https://example.invalid/provider',
    }],
  };
}
function snapshot() {
  const content = 'Ověřený lokální kontext.';
  return {
    schemaVersion: 1,
    generatedAt: '2026-09-10T00:00:00.000Z',
    records: [{
      id: 'local',
      type: 'local',
      content,
      sourceUrl: 'https://example.invalid/local',
      contentHash: sha256Hex(content),
      fetchedAt: '2026-09-10T00:00:00.000Z',
      lastVerifiedAt: '2026-09-10T00:00:00.000Z',
    }],
  };
}

test('Gemini fallback is stateless and sensitive content is blocked before fetch', async () => {
  const calls = [];
  const adapter = new GeminiFlashAdapter({
    apiKey: 'test-key',
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, async json() {
        return { steps: [{ content: [{ text: 'Bezpečná odpověď.' }] }] };
      } };
    },
  });
  const engine = new FrameMindEngine(config(adapter), snapshot());
  const answer = await engine.respond({
    text: 'Původní interní dotaz.',
    allowManagedProvider: true,
    providerText: 'Jak funguje hybridní agent?',
  });
  assert.equal(answer.providerUsed, true);
  assert.equal(calls.length, 1);
  const request = JSON.parse(calls[0].init.body);
  assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
  assert.equal(request.model, 'gemini-3.8-flash');
  assert.equal(request.store, false);
  assert.equal(request.tools, undefined);
  assert.match(request.input[0].content[0].text, /Jak funguje hybridní agent/);
  assert.doesNotMatch(request.input[0].content[0].text, /Původní interní dotaz/);

  const blocked = await engine.respond({
    text: 'Další dotaz.',
    allowManagedProvider: true,
    providerText: 'Kontakt je rodic@example.cz, telefon +420 777 123 456.',
  });
  assert.equal(blocked.providerUsed, false);
  assert.equal(calls.length, 1);
});

test('Sulafat TTS is stateless and declines sensitive output', async () => {
  const calls = [];
  const adapter = new GeminiSulafatTtsAdapter({
    apiKey: 'test-key',
    fetcher: async (_url, init) => {
      calls.push(init);
      return { ok: true, status: 200, async json() { return { output_audio: { data: 'cGNt' } }; } };
    },
  });
  const voice = await adapter.synthesize('Dobrý den, jak vám mohu pomoci?');
  assert.equal(voice?.voice, 'Sulafat');
  const request = JSON.parse(calls[0].body);
  assert.equal(request.model, 'gemini-3.1-flash-tts-preview');
  assert.equal(request.store, false);
  assert.equal(request.generation_config.speech_config[0].voice, 'Sulafat');
  assert.equal(await adapter.synthesize('Heslo klienta je tajné.'), null);
  assert.equal(calls.length, 1);
});

test('direct AzureSpeechAdapter calls are gated by policy when configured', async () => {
  const denyPolicy = new DataPolicy([{
    tenantId: 't1',
    domain: 'test.invalid',
    audience: 'general',
    processingMode: 'strict',
    dataMode: 'minimal',
    voice: { enabled: false, mode: 'off', locales: ['cs-CZ'], consentRequired: true },
    retention: { transcript: false, visitorMemory: false, leads: false },
    telemetry: { enabled: false, customerContentAllowed: false },
  }], [{
    id: 'azure-speech',
    allowedAudiences: ['general'],
    supportedPurposes: ['speech-to-text', 'text-to-speech'],
    allowedRegions: ['northeurope'],
    retention: 'real-time only',
    training: 'none',
    verifiedAt: '2026-09-11',
    documentationUrl: 'https://learn.microsoft.com/azure',
  }]);
  const adapter = new AzureSpeechAdapter({
    apiKey: 'secret',
    region: 'northeurope',
    dataPolicy: denyPolicy,
    tenantPolicy: {
      tenantId: 't1',
      domain: 'test.invalid',
      audience: 'general',
      processingMode: 'strict',
      dataMode: 'minimal',
      voice: { enabled: false, mode: 'off', locales: ['cs-CZ'], consentRequired: true },
      retention: { transcript: false, visitorMemory: false, leads: false },
      telemetry: { enabled: false, customerContentAllowed: false },
    },
  });
  await assert.rejects(
    async () => adapter.issueAuthorizationToken(),
    /Azure Speech token egress denied: managed-voice-disabled/
  );
});

test('direct GeminiFlashAdapter rejects unsafe content and respects policy', async () => {
  const adapter = new GeminiFlashAdapter({
    apiKey: 'test-key',
  });
  await assert.rejects(
    async () => adapter.generate({
      text: 'Telefon je 777 123 456 a email test@example.cz',
      locale: 'cs-CZ',
      context: { turn: 1, slots: {}, sourceIds: [] },
    }),
    /Gemini adapter rejected unsafe request content or PII/
  );
});
