import assert from 'node:assert/strict';
import test from 'node:test';
import { FrameMindEngine, sha256Hex } from '../dist/index.js';

// 1.3.0 — aspekty odpovědi, doptávka „A kde?“, závislé sloty a živé záznamy.
// Vše opt-in: konfigurace bez nich se chová jako 1.2.4.

const now = new Date('2026-10-06T12:00:00.000Z');

function record(id, type, content, data, overrides = {}) {
  return {
    id,
    type,
    content,
    sourceUrl: `https://club.example/${id}`,
    contentHash: sha256Hex(content),
    fetchedAt: '2026-10-06T00:00:00.000Z',
    lastVerifiedAt: '2026-10-06T00:00:00.000Z',
    expiresAt: '2027-06-30T23:59:59.000Z',
    critical: true,
    data,
    ...overrides,
  };
}

const snapshot = {
  schemaVersion: 1,
  generatedAt: '2026-10-06T00:00:00.000Z',
  records: [
    record('school', 'football-school', 'Školička.', { days: ['pondělí', 'čtvrtek'], time: '16–17', venue: 'ZŠ Za Mlýnem', bring: 'pití' }),
    record('fees', 'fees', 'Příspěvky 3 000 Kč.', {}),
  ],
};

const config = {
  mode: 'strict',
  locale: 'cs-CZ',
  listConjunction: 'a',
  intents: [
    { id: 'school', keywords: ['skolicka'], priority: 18 },
    { id: 'fees', keywords: ['prispevky'], priority: 18 },
    { id: 'greeting', examples: ['Ahoj', 'Dobrý den'], priority: 10 },
    { id: 'match_next', keywordGroups: [['kdy', 'hraje']], priority: 30 },
  ],
  responses: [
    {
      intentId: 'school',
      recordId: 'school',
      template: 'Školička je v {{days}} {{time}}.',
      facets: [
        { id: 'where', keywords: ['kde', 'kam'], template: 'Na {{venue}}.' },
        { id: 'bring', keywords: ['s sebou'], template: 'Stačí {{bring}}.' },
      ],
    },
    { intentId: 'fees', recordId: 'fees' },
    {
      intentId: 'greeting',
      sourceRequired: false,
      template: 'Dobrý den!',
      facets: [{ id: 'informal', keywords: ['ahoj', 'cau'], template: 'Ahoj!' }],
    },
    { intentId: 'match_next', recordId: 'match.next.a', template: '{{team}} hrají {{when}}.' },
  ],
  actions: [],
  unknownResponse: 'Nevím.',
  staleResponse: 'Staré.',
  provider: { enabled: false },
};

const engine = () => new FrameMindEngine(config, snapshot);

test('aspekt odpoví jen na to, na co se ptáš', async () => {
  const response = await engine().respond({ text: 'Kde je školička?', now });
  assert.equal(response.text, 'Na ZŠ Za Mlýnem.');
  assert.equal(response.facet, 'where');
  assert.equal(response.reason, 'known');
});

test('bez aspektu hlavní šablona s přirozeným výčtem', async () => {
  const response = await engine().respond({ text: 'Kdy je školička?', now });
  assert.equal(response.text, 'Školička je v pondělí a čtvrtek 16–17.');
  assert.equal(response.facet, undefined);
});

test('doptávka „A kde?“ navazuje na předchozí téma', async () => {
  const shared = engine();
  await shared.respond({ text: 'Kdy je školička?', now });
  const response = await shared.respond({ text: 'A kde?', now });
  assert.equal(response.text, 'Na ZŠ Za Mlýnem.');
  assert.equal(response.intent, 'school');
  assert.equal(response.reason, 'known');
});

test('doptávka funguje i bezstavově přes history', async () => {
  const response = await engine().respond({ text: 'A co s sebou?', history: ['Kdy je školička?'], now });
  assert.equal(response.text, 'Stačí pití.');
});

test('doptávka bez předchozího tématu zůstává neznámá', async () => {
  const response = await engine().respond({ text: 'A kde?', now });
  assert.equal(response.reason, 'unknown');
});

test('dlouhá nesouvisející zpráva se za doptávku nepovažuje', async () => {
  const shared = engine();
  await shared.respond({ text: 'Kdy je školička?', now });
  const response = await shared.respond({ text: 'A kde se dá v Přerově dobře najíst po zápase?', now });
  assert.equal(response.reason, 'unknown');
});

test('pozdrav podle tónu návštěvníka', async () => {
  assert.equal((await engine().respond({ text: 'Ahoj', now })).text, 'Ahoj!');
  assert.equal((await engine().respond({ text: 'Dobrý den', now })).text, 'Dobrý den!');
});

test('pravidlo bez facets se chová jako v 1.2.4', async () => {
  const response = await engine().respond({ text: 'Kolik stojí příspěvky?', now });
  assert.equal(response.text, 'Příspěvky 3 000 Kč.');
  assert.equal(response.facet, undefined);
});

const childConfig = {
  ...config,
  slotPatterns: [
    { slot: 'child', pattern: '\\bsyn', value: 'syn' },
    { slot: 'child', pattern: '\\bdcer', value: 'dcera' },
  ],
  intents: [...config.intents, { id: 'recruitment', keywords: ['prihlasit'], priority: 20 }],
  responses: [...config.responses, { intentId: 'recruitment', sourceRequired: false, template: 'Nábor.' }],
};

test('věk syna se nepřenáší na dceru', async () => {
  const shared = new FrameMindEngine({ ...childConfig, slotDependencies: { child: ['childAge', 'birthYear'] } }, snapshot);
  const first = await shared.respond({ text: 'Synovi je 7, chci ho přihlásit', now });
  assert.equal(first.context.slots.childAge, 7);
  const second = await shared.respond({ text: 'Chci přihlásit dceru', now });
  assert.equal(second.context.slots.child, 'dcera');
  assert.equal(second.context.slots.childAge, undefined);
});

test('věk ve stejné zprávě jako nové dítě zůstává', async () => {
  const shared = new FrameMindEngine({ ...childConfig, slotDependencies: { child: ['childAge', 'birthYear'] } }, snapshot);
  await shared.respond({ text: 'Synovi je 7, chci ho přihlásit', now });
  const response = await shared.respond({ text: 'Dceři je 6, chci ji přihlásit', now });
  assert.equal(response.context.slots.childAge, 6);
});

test('bez slotDependencies věk zůstává jako v 1.2.4', async () => {
  const shared = new FrameMindEngine(childConfig, snapshot);
  await shared.respond({ text: 'Synovi je 7, chci ho přihlásit', now });
  const response = await shared.respond({ text: 'Chci přihlásit dceru', now });
  assert.equal(response.context.slots.childAge, 7);
});

test('upsertRecords doplní živý záznam do běžícího engine', async () => {
  const shared = engine();
  assert.notEqual((await shared.respond({ text: 'Kdy hraje áčko?', now })).reason, 'known');
  shared.upsertRecords([record('match.next.a', 'match-next', 'Muži A hrají v neděli.', { team: 'Muži A', when: 'v neděli' })]);
  const response = await shared.respond({ text: 'Kdy hraje áčko?', now });
  assert.equal(response.text, 'Muži A hrají v neděli.');
});

test('upsertRecords odmítne neplatný záznam', () => {
  assert.throws(() => engine().upsertRecords([record('bad', 'x', 'X', {}, { sourceUrl: 'http://club.example/bad' })]));
});
