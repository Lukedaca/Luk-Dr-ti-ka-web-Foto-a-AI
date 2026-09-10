import assert from 'node:assert/strict';
import test from 'node:test';
import {
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