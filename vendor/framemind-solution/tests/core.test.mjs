import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FrameMindEngine,
  KnowledgeStore,
  NoopLearningSink,
  PrivacyGuard,
  VoiceCapability,
  sha256Hex,
} from '../dist/index.js';

const hash = sha256Hex;

function snapshot(expiresAt = '2027-06-30T23:59:59.000Z') {
  return {
    schemaVersion: 1,
    generatedAt: '2026-09-02T00:00:00.000Z',
    records: [
      {
        id: 'school',
        type: 'school',
        content: 'Fotbalová školička je pro děti od 4 let.',
        sourceUrl: 'https://club.example/school',
        contentHash: hash('Fotbalová školička je pro děti od 4 let.'),
        fetchedAt: '2026-09-02T00:00:00.000Z',
        lastVerifiedAt: '2026-09-02T00:00:00.000Z',
        expiresAt,
        critical: true,
        intents: ['age_category'],
        data: { minAge: 4 },
      },
      {
        id: 'category-2018',
        type: 'age-category',
        content: 'Ročník 2018 je kategorie U-9.',
        sourceUrl: 'https://club.example/teams',
        contentHash: hash('Ročník 2018 je kategorie U-9.'),
        fetchedAt: '2026-09-02T00:00:00.000Z',
        lastVerifiedAt: '2026-09-02T00:00:00.000Z',
        expiresAt,
        critical: true,
        intents: ['age_category'],
        data: { birthYear: 2018, category: 'U-9' },
      },
    ],
  };
}

function config(mode = 'strict', adapter) {
  return {
    mode,
    locale: 'cs-CZ',
    intents: [
      {
        id: 'greeting',
        examples: ['Ahoj', 'Dobrý den'],
        keywords: ['ahoj', 'zdravim'],
        priority: 20,
      },
      {
        id: 'age_category',
        keywords: ['vek', 'stare', 'stary', 'rocnik'],
        keywordGroups: [['nabor', 'skolicka'], ['stare', 'skolicka']],
        followUpFor: ['age_category', 'recruitment'],
        priority: 5,
      },
    ],
    responses: [
      {
        intentId: 'greeting',
        sourceRequired: false,
        template: 'Ahoj! Jsem místní AI agentka. Jak vám mohu pomoci?',
      },
      {
        intentId: 'age_category',
        requiredAnySlots: ['birthYear'],
        missingRecordId: 'school',
        missingTemplate: 'Fotbalová školička je pro děti od {{minAge}} let. Pro přesné zařazení napište věk nebo rok narození.',
        selectBy: { slot: 'birthYear', dataField: 'birthYear', recordType: 'age-category' },
        template: 'Podle aktuálního rozdělení je ročník {{birthYear}} kategorie {{category}}.',
      },
    ],
    actions: [
      {
        id: 'teams',
        tool: 'navigate',
        intentIds: ['age_category'],
        args: { path: '/teams', label: 'Týmy' },
        requireExplicitNavigation: true,
      },
    ],
    unknownResponse: 'Tuto informaci nemohu spolehlivě potvrdit.',
    staleResponse: 'Tento údaj je po datu ověření; ověřte ho u klubu.',
    provider: { enabled: Boolean(adapter), ...(adapter ? { adapter } : {}) },
  };
}

test('known question is answered locally without provider', async () => {
  let calls = 0;
  const adapter = {
    id: 'test',
    enabled: true,
    async generate() {
      calls += 1;
      return { text: 'remote', providerId: 'test' };
    },
  };
  const engine = new FrameMindEngine(config('strict', adapter), snapshot());
  const response = await engine.respond({
    text: 'Pro jak staré děti je nábor a školička?',
    now: new Date('2026-09-02T12:00:00.000Z'),
  });
  assert.equal(response.local, true);
  assert.equal(response.providerUsed, false);
  assert.match(response.text, /od 4 let/);
  assert.equal(response.reason, 'missing-slot');
  assert.equal(calls, 0);
});

test('source-free conversational intent answers locally without a fake citation', async () => {
  const engine = new FrameMindEngine(config(), snapshot());
  const response = await engine.respond({ text: 'Ahoj' });
  assert.equal(response.reason, 'known');
  assert.equal(response.providerUsed, false);
  assert.equal(response.source, undefined);
  assert.match(response.text, /Jak vám mohu pomoci/);
});

test('follow-up keeps ephemeral context and resolves birth year', async () => {
  const engine = new FrameMindEngine(config(), snapshot());
  await engine.respond({ text: 'Pro jak staré děti je nábor a školička?', now: new Date('2026-09-02T12:00:00.000Z') });
  const response = await engine.respond({
    text: 'Malej má 7, v listopadu 8, teď je září.',
    now: new Date('2026-09-02T12:00:00.000Z'),
  });
  assert.equal(response.intent, 'age_category');
  assert.equal(response.context.slots.birthYear, 2018);
  assert.match(response.text, /U-9/);
  assert.equal(response.source?.url, 'https://club.example/teams');
});

test('unknown question does not hallucinate or call provider in strict mode', async () => {
  let calls = 0;
  const adapter = { id: 'test', enabled: true, async generate() { calls += 1; return { text: 'remote', providerId: 'test' }; } };
  const engine = new FrameMindEngine(config('strict', adapter), snapshot());
  const response = await engine.respond({ text: 'Kolik váží trenérův pes?', allowManagedProvider: true });
  assert.equal(response.reason, 'unknown');
  assert.equal(response.text, config().unknownResponse);
  assert.equal(calls, 0);
});

test('managed provider requires explicit request and remains after local resolution', async () => {
  let calls = 0;
  const adapter = { id: 'test', enabled: true, async generate() { calls += 1; return { text: 'remote answer', providerId: 'test' }; } };
  const engine = new FrameMindEngine(config('managed', adapter), snapshot());
  const local = await engine.respond({ text: 'Pro jak staré děti je školička?' });
  assert.equal(local.providerUsed, false);
  const denied = await engine.respond({ text: 'Neznámý dotaz' });
  assert.equal(denied.providerUsed, false);
  const stillDenied = await engine.respond({ text: 'Neznámý dotaz', allowManagedProvider: true });
  assert.equal(stillDenied.providerUsed, false);
  const remote = await engine.respond({
    text: 'Neznámý dotaz obsahující osobní údaj',
    allowManagedProvider: true,
    providerText: 'Redigovaný neznámý dotaz',
  });
  assert.equal(remote.providerUsed, true);
  assert.equal(remote.text, 'remote answer');
  assert.equal(calls, 1);
});

test('expired critical record produces safe stale answer', async () => {
  const engine = new FrameMindEngine(config(), snapshot('2026-08-31T23:59:59.000Z'));
  const response = await engine.respond({ text: 'Dítě je ročník 2018, kam patří?', now: new Date('2026-09-02T12:00:00.000Z') });
  assert.equal(response.reason, 'stale');
  assert.match(response.text, /po datu ověření/);
  assert.equal(response.actions.length, 0);
});

test('actions require explicit navigation and reject query strings', () => {
  const guard = new PrivacyGuard('strict');
  assert.equal(guard.validateAction({ id: 'safe', tool: 'navigate', args: { path: '/teams' } }), true);
  assert.equal(guard.validateAction({ id: 'leak', tool: 'navigate', args: { path: '/teams?q=user-text' } }), false);
  assert.equal(guard.validateAction({ id: 'raw', tool: 'contact', args: { text: 'conversation' } }), false);
  assert.equal(guard.validateAction({ id: 'external', tool: 'navigate', args: { path: '//evil.example' } }), false);
});

test('knowledge hash is computed and verified against content', () => {
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const tampered = snapshot();
  tampered.records[0].content = 'Pozměněný obsah';
  assert.throws(() => new KnowledgeStore(tampered), /contentHash does not match content/);
});

test('navigation permission expires after the current turn', async () => {
  const engine = new FrameMindEngine(config(), snapshot());
  const requested = await engine.respond({
    text: 'Otevři týmy pro ročník 2018',
    availablePaths: ['/teams'],
  });
  assert.equal(requested.actions.length, 1);
  const later = await engine.respond({ text: 'Dítě je ročník 2018, kam patří?', availablePaths: ['/teams'] });
  assert.equal(later.actions.length, 0);
  assert.equal(later.context.slots.navigationRequested, undefined);
});

test('required session IDs isolate contexts in a shared engine', async () => {
  const isolatedConfig = { ...config(), sessions: { requireSessionId: true, maxSessions: 10 } };
  const engine = new FrameMindEngine(isolatedConfig, snapshot());
  await assert.rejects(() => engine.respond({ text: 'Ahoj' }), /sessionId is required/);
  await engine.respond({ text: 'Dítě je ročník 2018, kam patří?', sessionId: 'session_A' });
  const other = await engine.respond({
    text: 'Malej má 7, v listopadu 8, teď je září.',
    sessionId: 'session_B',
    now: new Date('2026-09-02T12:00:00.000Z'),
  });
  assert.equal(other.intent, 'unknown');
  assert.equal(other.context.slots.birthYear, undefined);
});

test('managed provider receives only deliberate text and allowlisted context', async () => {
  let received;
  const adapter = {
    id: 'test',
    enabled: true,
    async generate(request) {
      received = request;
      return { text: 'remote', providerId: 'test' };
    },
  };
  const managed = config('managed', adapter);
  managed.provider.allowedContextSlots = ['birthYear'];
  const engine = new FrameMindEngine(managed, snapshot());
  await engine.respond({ text: 'Dítě je ročník 2018, kam patří?' });
  await engine.respond({
    text: 'Moje tajná původní zpráva',
    allowManagedProvider: true,
    providerText: 'Bezpečně připravený dotaz',
  });
  assert.equal(received.text, 'Bezpečně připravený dotaz');
  assert.deepEqual(received.context.slots, { birthYear: 2018 });
  assert.deepEqual(received.context.sourceIds, []);
  assert.equal(received.context.slots.currentYear, undefined);
});

test('intent matching rejects substring evidence and unsafe tenant regex', async () => {
  const guarded = config();
  guarded.intents.push({ id: 'dangerous', patterns: ['(a+)+$'], priority: 100 });
  guarded.responses.push({ intentId: 'dangerous', sourceRequired: false, template: 'bad' });
  const engine = new FrameMindEngine(guarded, snapshot());
  const substring = await engine.respond({ text: 'Člověk čeká venku.' });
  assert.equal(substring.intent, 'unknown');
  const unsafe = await engine.respond({ text: `${'a'.repeat(1000)}!` });
  assert.equal(unsafe.intent, 'unknown');
});

test('local speech recognition needs positive availability proof and sets processLocally', async () => {
  class LocalRecognition {
    static async available(options) {
      assert.deepEqual(options, { langs: ['cs-CZ'], processLocally: true });
      return 'available';
    }
    lang = '';
    continuous = true;
    interimResults = false;
    processLocally = false;
    start() {}
    stop() {}
  }
  const capability = await new VoiceCapability().localSpeechRecognition({ SpeechRecognition: LocalRecognition });
  assert.equal(capability.available, true);
  const recognition = capability.create();
  assert.equal(recognition.processLocally, true);
  assert.equal(recognition.lang, 'cs-CZ');
});

test('speech recognition without availability proof is disabled and install is never called', async () => {
  let installCalls = 0;
  class UnknownRecognition {
    static async install() { installCalls += 1; }
    lang = '';
    continuous = false;
    interimResults = false;
    start() {}
    stop() {}
  }
  const capability = await new VoiceCapability().localSpeechRecognition({ SpeechRecognition: UnknownRecognition });
  assert.equal(capability.available, false);
  assert.equal(capability.reason, 'availability-unknown');
  assert.equal(installCalls, 0);
});

test('TTS accepts only a Czech voice explicitly marked localService true', () => {
  const voice = { name: 'Local Czech', lang: 'cs-CZ', localService: true };
  const local = new VoiceCapability().localTts({ speechSynthesis: { getVoices: () => [voice] } });
  assert.equal(local.available, true);
  assert.equal(local.voice, voice);
  const remote = new VoiceCapability().localTts({ speechSynthesis: { getVoices: () => [{ lang: 'cs-CZ' }] } });
  assert.equal(remote.available, false);
});

test('NoopLearningSink stores nothing and resolves', async () => {
  const sink = new NoopLearningSink();
  assert.equal(sink.id, 'noop');
  await sink.record({ kind: 'intent-correction', payload: { only: 'test fixture' } });
});
