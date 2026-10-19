import assert from 'node:assert/strict';
import test from 'node:test';
import { FrameMindEngine, sha256Hex } from '../dist/index.js';

// 1.8.0 — „Jak jsme hráli se Slavonínem?“ dostalo poslední zápas s Velkou Bystřicí (11. 10.
// 2026): záznam se vybíral jen podle týmu a jmenovaného soupeře jádro přehlíželo. Výběr
// podle zmínky bere známé hodnoty z živých záznamů, ne ze seznamu frází v konfiguraci.

const now = new Date('2026-10-12T08:00:00.000Z');

function record(id, type, data) {
  const content = `${id} ${JSON.stringify(data)}`;
  return {
    id,
    type,
    content,
    sourceUrl: `https://club.example/${id}`,
    contentHash: sha256Hex(content),
    fetchedAt: '2026-10-12T07:00:00.000Z',
    lastVerifiedAt: '2026-10-12T07:00:00.000Z',
    expiresAt: '2026-10-20T00:00:00.000Z',
    data,
  };
}

// Pořadí v úložišti = pořadí přednosti (odehrané od nejnovějšího, nadcházející od nejbližšího).
const records = [
  record('last.muzi-a', 'match-last', { team: 'Muži A', opponent: 'FK Velká Bystřice', score: '0:4' }),
  record('next.muzi-a', 'match-next', { team: 'Muži A', opponent: 'FK Slavonín', when: 'v sobotu 17. 10.' }),
  record('played.1', 'match-played', { team: 'Muži A', opponent: 'FK Velká Bystřice', score: '0:4' }),
  record('played.2', 'match-played', { team: 'Muži A', opponent: '1. HFK Olomouc', score: '0:5' }),
  record('played.3', 'match-played', { team: 'Muži A', opponent: 'Sokol Velké Losiny', score: '0:1' }),
  record('played.4', 'match-played', { team: 'Muži B', opponent: 'FC DUKLA Hranice', score: '2:2' }),
  record('played.5', 'match-played', { team: 'U-15', opponent: 'Kuřim', score: '3:1' }),
  record('played.6', 'match-played', { team: 'U-10', opponent: 'SK Hranice', score: '1:3' }),
  record('upcoming.1', 'match-upcoming', { team: 'Muži A', opponent: 'FK Slavonín', when: 'v sobotu 17. 10.' }),
  record('upcoming.2', 'match-upcoming', { team: 'U-10', opponent: 'SK Hranice', when: 'v sobotu 17. 10.' }),
  record('upcoming.3', 'match-upcoming', { team: 'U-14', opponent: 'Kuřim', when: 'v sobotu 17. 10.' }),
];

const lastRule = {
  intentId: 'match_last',
  recordId: 'last.muzi-a',
  selectBy: [
    { mentioned: true, dataField: 'opponent', recordType: 'match-played', template: 'P {{team}} {{score}} {{opponent}}' },
    { mentioned: true, dataField: 'opponent', recordType: 'match-upcoming', template: 'U {{team}} {{when}} {{opponent}}' },
    { slot: 'team', dataField: 'team', recordType: 'match-last' },
  ],
  template: 'L {{team}} {{score}} {{opponent}}',
};

function engine() {
  return new FrameMindEngine({
    mode: 'strict',
    locale: 'cs-CZ',
    intents: [{ id: 'match_last', keywordGroups: [['jak', 'hrali'], ['jak', 'hralo'], ['jak', 'dopadl']], priority: 30 }],
    slotPatterns: [
      { slot: 'team', pattern: '\\b(acko|muzi a)\\b', value: 'Muži A' },
      { slot: 'team', pattern: '\\b(becko|muzi b)\\b', value: 'Muži B' },
      { slot: 'team', pattern: '\\bu ?-? ?(\\d\\d?)\\b', value: 'U-$1' },
    ],
    responses: [lastRule],
    actions: [],
    unknownResponse: 'Nevím.',
    staleResponse: 'Staré.',
    provider: { enabled: false },
  }, { schemaVersion: 1, generatedAt: '2026-10-12T07:00:00.000Z', records });
}

async function ask(text) {
  return engine().respond({ text, now });
}

test('bez zmínky soupeře platí výchozí záznam jako dřív', async () => {
  const result = await ask('Jak dopadl poslední zápas?');
  assert.equal(result.text, 'L Muži A 0:4 FK Velká Bystřice');
});

test('jmenovaný soupeř, se kterým se hrálo, vybere ten zápas i v jiném pádě', async () => {
  assert.equal((await ask('Jak jsme hráli s Olomoucí?')).text, 'P Muži A 0:5 1. HFK Olomouc');
  assert.equal((await ask('Jak jsme hráli s Velkou Bystřicí?')).text, 'P Muži A 0:4 FK Velká Bystřice');
  assert.equal((await ask('Jak jsme hráli s Velkými Losinami?')).text, 'P Muži A 0:1 Sokol Velké Losiny');
});

test('soupeř, se kterým se teprve hraje, nedostane jiný odehraný zápas', async () => {
  const result = await ask('Jak jsme hráli se Slavonínem?');
  assert.equal(result.text, 'U Muži A v sobotu 17. 10. FK Slavonín');
});

test('dva různí soupeři stejného jména: rozhodne tým z dotazu, jinak jádro neodpoví', async () => {
  assert.equal((await ask('Jak hrálo béčko s Hranicemi?')).text, 'P Muži B 2:2 FC DUKLA Hranice');
  assert.equal((await ask('Jak hrálo U-10 s Hranicemi?')).text, 'P U-10 1:3 SK Hranice');
  const ambiguous = await ask('Jak jsme hráli s Hranicemi?');
  assert.notEqual(ambiguous.reason, 'known');
  assert.doesNotMatch(ambiguous.text, /Bystřice/);
});

test('tým z dotazu zužuje i zmínku: Kuřim u U-14 je nadcházející, ne odehraný zápas U-15', async () => {
  assert.equal((await ask('Jak hrálo U-14 s Kuřimí?')).text, 'U U-14 v sobotu 17. 10. Kuřim');
  assert.equal((await ask('Jak hrálo U-15 s Kuřimí?')).text, 'P U-15 3:1 Kuřim');
});

test('zmíněný soupeř bez záznamu v žádném výběru nepropadne na výchozí zápas', async () => {
  const result = await ask('Jak hrálo béčko se Slavonínem?');
  assert.notEqual(result.reason, 'known');
  assert.doesNotMatch(result.text, /Bystřice/);
});

test('neznámé jméno v dotazu výběr neovlivní', async () => {
  const result = await ask('Jak dopadl zápas se Zbrojovkou?');
  assert.equal(result.text, 'L Muži A 0:4 FK Velká Bystřice');
});

test('prošlý záznam zmínku nevyhraje: odehraný zápas místo propadlého termínu', async () => {
  // Widget drží engine celou návštěvu; termín z dřívějšího načtení po výkopu propadne.
  const expired = { ...record('upcoming.old', 'match-upcoming', { team: 'Muži A', opponent: 'FK Velká Bystřice', when: 'v neděli 11. 10.' }), expiresAt: '2026-10-11T15:00:00.000Z' };
  const nextRule = { ...lastRule, intentId: 'match_last', selectBy: [lastRule.selectBy[1], lastRule.selectBy[0], lastRule.selectBy[2]] };
  const engine = new FrameMindEngine({
    mode: 'strict',
    locale: 'cs-CZ',
    intents: [{ id: 'match_last', keywordGroups: [['jak', 'hraje']], priority: 30 }],
    responses: [nextRule],
    actions: [],
    unknownResponse: 'Nevím.',
    staleResponse: 'Staré.',
    provider: { enabled: false },
  }, { schemaVersion: 1, generatedAt: '2026-10-12T07:00:00.000Z', records: [expired, ...records] });
  const result = await engine.respond({ text: 'Jak hraje áčko ve Velké Bystřici?', now });
  assert.equal(result.text, 'P Muži A 0:4 FK Velká Bystřice');
});

test('jméno soupeře není doklad záměru: sémantická vrstva ho nedostane', async () => {
  // „Ahoj, jak hraje áčko ve Velké Bystřici ?“ (11. 10.): slova soupeře rozředila n-gramy pod práh.
  const seen = [];
  const engine = new FrameMindEngine({
    mode: 'strict',
    locale: 'cs-CZ',
    intents: [{ id: 'match_last', keywordGroups: [['jak', 'dopadl']], priority: 30 }],
    responses: [lastRule],
    actions: [],
    unknownResponse: 'Nevím.',
    staleResponse: 'Staré.',
    provider: { enabled: false },
    semanticIntents: {
      processing: 'local',
      resolver: async (text) => { seen.push(text); return [{ intentId: 'match_last', score: 0.9 }]; },
    },
  }, { schemaVersion: 1, generatedAt: '2026-10-12T07:00:00.000Z', records });
  const result = await engine.respond({ text: 'Ahoj, jak hraje áčko ve Velké Bystřici ?', now });
  assert.deepEqual(seen, ['Ahoj, jak hraje áčko ve ?']);
  // Výběr záznamu ale zmínku vidí celou.
  assert.equal(result.text, 'P Muži A 0:4 FK Velká Bystřice');
});
