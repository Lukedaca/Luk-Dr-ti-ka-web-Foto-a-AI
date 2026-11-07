import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { DataPolicy, FrameMindVoiceAdapter } from '../dist/index.js';

function fixture(overrides = {}) {
  const tenant = {
    tenantId: 'viktorka', domain: 'example.test', audience: 'may-include-minors',
    processingMode: 'strict', dataMode: 'minimal',
    voice: { enabled: true, mode: 'managed', provider: 'framemind-voice', region: 'eu', locales: ['cs-CZ', 'en-US'], consentRequired: true },
    retention: { transcript: false, visitorMemory: false, leads: false },
    telemetry: { enabled: false, customerContentAllowed: false },
  };
  const provider = {
    id: 'framemind-voice', allowedAudiences: ['may-include-minors'],
    supportedPurposes: ['text-to-speech', 'speech-to-text'], allowedRegions: ['eu'],
    retention: 'no conversation storage', training: 'no training on requests',
    verifiedAt: '2026-10-28', documentationUrl: 'https://example.test/voice-policy',
  };
  const dataPolicy = new DataPolicy([tenant], [provider]);
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/v1/transcribe')) return Response.json({ text: 'Otevři kodex klubu' });
    return new Response(new Uint8Array([82, 73, 70, 70]), { headers: { 'content-type': 'audio/wav' } });
  };
  const adapter = new FrameMindVoiceAdapter({
    baseUrl: 'https://voice.example.test/private/', serviceToken: 'private-test-key', tenant, dataPolicy,
    voiceByLocale: { 'cs-CZ': 'clear', 'en-US': 'english_female' }, fetcher, ...overrides,
  });
  return { tenant, dataPolicy, calls, adapter };
}

function wav() {
  const audio = new Uint8Array(48);
  audio.set([82, 73, 70, 70], 0);
  audio.set([87, 65, 86, 69], 8);
  return audio.buffer;
}

test('voice adapter sends activated, tenant-scoped TTS and STT to its configured service', async () => {
  const { adapter, calls } = fixture();
  const spoken = await adapter.synthesize({ text: 'Dobrý den', locale: 'cs-CZ', voiceActivated: true });
  assert.equal(spoken.providerId, 'framemind-voice');
  assert.equal(spoken.voice, 'clear');
  assert.equal(spoken.contentType, 'audio/wav');
  const heard = await adapter.transcribe({ audio: wav(), locale: 'cs-CZ', voiceActivated: true });
  assert.equal(heard.text, 'Otevři kodex klubu');
  assert.deepEqual(calls.map((call) => call.url), [
    'https://voice.example.test/private/v1/synthesize',
    'https://voice.example.test/private/v1/transcribe',
  ]);
  assert.equal(calls[0].init.headers.get('x-framemind-tenant'), 'viktorka');
  assert.equal(calls[0].init.headers.get('authorization'), 'Bearer private-test-key');
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(calls[0].init.cache, 'no-store');
  assert.deepEqual(JSON.parse(calls[0].init.body), { text: 'Dobrý den', locale: 'cs-CZ', voice: 'clear' });
  assert.equal(calls[1].init.headers.get('x-framemind-locale'), 'cs-CZ');
});

test('voice adapter fails closed before any network request', async () => {
  const { adapter, calls } = fixture();
  await assert.rejects(adapter.synthesize({ text: 'Dobrý den', locale: 'cs-CZ' }), /voice-not-activated/);
  await assert.rejects(adapter.transcribe({ audio: wav(), locale: 'cs-CZ' }), /voice-not-activated/);
  await assert.rejects(adapter.synthesize({ text: 'E-mail je someone@example.com', locale: 'cs-CZ', voiceActivated: true }), /visitor-personal-data-denied/);
  await assert.rejects(adapter.synthesize({ text: 'Interní údaje', locale: 'cs-CZ', voiceActivated: true, origin: 'internal' }), /protected-data-class/);
  await assert.rejects(adapter.synthesize({ text: 'Dobrý den', locale: 'cs-CZ', voiceActivated: true, origin: 'untrusted-value' }), /Invalid speech text origin/);
  await assert.rejects(adapter.synthesize({ text: 'Hello', locale: 'fr-FR', voiceActivated: true }), /locale/);
  await assert.rejects(adapter.synthesize({ text: 'Hello', locale: 'en-US', voice: 'other', voiceActivated: true }), /Voice is not configured/);
  await assert.rejects(adapter.transcribe({ audio: new ArrayBuffer(48), locale: 'cs-CZ', voiceActivated: true }), /Invalid voice audio/);
  assert.equal(calls.length, 0);
});

test('one tenant cannot use another tenant\'s voice policy', async () => {
  const base = fixture();
  const otherTenant = { ...base.tenant, tenantId: 'another-agent' };
  const { adapter, calls } = fixture({ tenant: otherTenant, dataPolicy: base.dataPolicy });
  await assert.rejects(adapter.synthesize({ text: 'Dobrý den', locale: 'cs-CZ', voiceActivated: true }), /unknown-tenant/);
  await assert.rejects(adapter.transcribe({ audio: wav(), locale: 'cs-CZ', voiceActivated: true }), /unknown-tenant/);
  assert.equal(calls.length, 0);
});

test('external changes to tenant settings do not redirect a constructed adapter', async () => {
  const { adapter, tenant, calls } = fixture();
  tenant.tenantId = 'another-agent';
  tenant.voice.locales = ['en-US'];
  await adapter.synthesize({ text: 'Dobrý den', locale: 'cs-CZ', voiceActivated: true });
  assert.equal(calls[0].init.headers.get('x-framemind-tenant'), 'viktorka');
});

test('voice endpoint refuses insecure or credential-bearing network URLs', () => {
  assert.throws(() => fixture({ baseUrl: 'http://voice.example.test/' }), /HTTPS/);
  assert.throws(() => fixture({ baseUrl: 'https://user:password@voice.example.test/' }), /HTTPS/);
  assert.doesNotThrow(() => fixture({ baseUrl: 'http://127.0.0.1:8765/' }));
});

test('service errors, incorrect media types, and oversized responses do not become speech', async () => {
  const badType = fixture({ fetcher: async () => new Response('not audio', { headers: { 'content-type': 'text/html' } }) });
  await assert.rejects(badType.adapter.synthesize({ text: 'Dobrý den', locale: 'cs-CZ', voiceActivated: true }), /Invalid voice audio response/);
  const oversized = fixture({ fetcher: async () => new Response('x', { headers: { 'content-type': 'audio/wav', 'content-length': '8000001' } }) });
  await assert.rejects(oversized.adapter.synthesize({ text: 'Dobrý den', locale: 'cs-CZ', voiceActivated: true }), /too large/);
  const failure = fixture({ fetcher: async () => new Response('private error body', { status: 503 }) });
  await assert.rejects(failure.adapter.transcribe({ audio: wav(), locale: 'cs-CZ', voiceActivated: true }), /^Error: Voice service request failed with 503$/);
});

test('aborting a visitor request aborts the service request', async () => {
  let downstreamSignal;
  const { adapter } = fixture({ fetcher: async (_url, init) => {
    downstreamSignal = init.signal;
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  } });
  const controller = new AbortController();
  const pending = adapter.synthesize({ text: 'Dobrý den', locale: 'cs-CZ', voiceActivated: true, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, /aborted/);
  assert.equal(downstreamSignal.aborted, true);
});

test('timeout also covers a response whose body stalls', async () => {
  const { adapter } = fixture({ timeoutMs: 20, fetcher: async (_url, init) => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
        init.signal.addEventListener('abort', () => controller.error(new Error('response aborted')), { once: true });
      },
    });
    return new Response(body, { headers: { 'content-type': 'audio/wav' } });
  } });
  await assert.rejects(adapter.synthesize({ text: 'Dobrý den', locale: 'cs-CZ', voiceActivated: true }), /response aborted/);
});

test('an already aborted request never reaches the service', async () => {
  const { adapter, calls } = fixture();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(adapter.transcribe({ audio: wav(), locale: 'cs-CZ', voiceActivated: true, signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls.length, 0);
});

test('voice adapter exchanges a request and audio over an actual loopback HTTP connection', async (t) => {
  const received = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    received.push({ path: req.url, tenant: req.headers['x-framemind-tenant'], body: Buffer.concat(chunks).toString('utf8') });
    res.writeHead(200, { 'content-type': 'audio/wav', 'cache-control': 'no-store' });
    res.end(Buffer.from([82, 73, 70, 70, 1, 2, 3]));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const { adapter } = fixture({ baseUrl: `http://127.0.0.1:${port}/`, fetcher: undefined });
  const result = await adapter.synthesize({ text: 'Ahoj', locale: 'cs-CZ', voiceActivated: true });
  assert.equal(result.audio.byteLength, 7);
  assert.equal(received[0].path, '/v1/synthesize');
  assert.equal(received[0].tenant, 'viktorka');
  assert.deepEqual(JSON.parse(received[0].body), { text: 'Ahoj', locale: 'cs-CZ', voice: 'clear' });
});
