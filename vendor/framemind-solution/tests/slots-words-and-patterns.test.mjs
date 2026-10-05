import assert from 'node:assert/strict';
import test from 'node:test';
import { FrameMindEngine, sha256Hex } from '../dist/index.js';

// 1.2.3 — rodič píše věk slovem („je mu osm“) nebo kategorii tak, jak ji zná z webu
// („kdy trénuje u9“). Obojí dřív propadlo na fallback, i když jádro data mělo.

const now = new Date('2026-09-28T12:00:00.000Z');

function record(id, type, content, data) {
  return {
    id,
    type,
    content,
    sourceUrl: `https://club.example/${id}`,
    contentHash: sha256Hex(content),
    fetchedAt: '2026-09-28T00:00:00.000Z',
    lastVerifiedAt: '2026-09-28T00:00:00.000Z',
    expiresAt: '2027-06-30T23:59:59.000Z',
    critical: true,
    data,
  };
}

const snapshot = {
  schemaVersion: 1,
  generatedAt: '2026-09-28T00:00:00.000Z',
  records: [
    record('training-meta', 'training', 'Rozpis tréninků podle kategorií.', {}),
    record('t-2019', 'training-age', 'U-8', { birthYear: 2019, category: 'U-8', schedule: 'po 16:30' }),
    record('t-2018', 'training-age', 'U-9', { birthYear: 2018, category: 'U-9', schedule: 'pá 16:30' }),
    record('t-2017', 'training-age', 'U-10', { birthYear: 2017, category: 'U-10', schedule: 'út 16:00' }),
  ],
};

const trainingRule = {
  intentId: 'training',
  requiredAnySlots: ['birthYear', 'category'],
  missingRecordId: 'training-meta',
  missingTemplate: 'Kolik je dítěti let?',
  selectBy: [
    { slot: 'birthYear', dataField: 'birthYear', recordType: 'training-age' },
    { slot: 'category', dataField: 'category', recordType: 'training-age' },
  ],
  template: '{{category}}: {{schedule}}',
  ageRangeTemplate: '{{a.category}}: {{a.schedule}}; {{b.category}}: {{b.schedule}}',
};

function config(extra = {}) {
  return {
    mode: 'strict',
    locale: 'cs-CZ',
    intents: [{ id: 'training', keywords: ['treninky', 'trenuje', 'trenink'], priority: 16 }],
    responses: [trainingRule],
    actions: [],
    unknownResponse: 'Tuto informaci nemohu spolehlivě potvrdit.',
    staleResponse: 'Údaj je po datu ověření.',
    provider: { enabled: false },
    slotPatterns: [{ slot: 'category', pattern: '\\bu ?-? ?(\\d\\d?)\\b', value: 'U-$1' }],
    ...extra,
  };
}

test('age written as a word is understood', async () => {
  for (const [text, age] of [
    ['Je mu osm, kdy by chodil na tréninky?', 8],
    ['Dceři je sedm let, kdy trénuje?', 7],
    ['Mám osmiletého syna, kdy je trénink?', 8],
    ['Synovi bude devět, ale teď je mu osm. Kdy trénuje?', 8],
  ]) {
    const response = await new FrameMindEngine(config(), snapshot).respond({ text, now });
    assert.equal(response.context.slots.childAge, age, text);
  }
});

test('word age resolves both candidate categories', async () => {
  const response = await new FrameMindEngine(config(), snapshot).respond({ text: 'Je mu osm, kdy trénuje?', now });
  assert.equal(response.reason, 'known');
  assert.equal(response.text, 'U-9: pá 16:30; U-10: út 16:00');
});

test('numbers that are not an age do not become one', async () => {
  for (const text of ['Kolik stojí osm dresů?', 'Kdy je trénink, v pět?', 'Trénink je od pěti']) {
    const response = await new FrameMindEngine(config(), snapshot).respond({ text, now });
    assert.equal(response.context.slots.childAge, undefined, text);
  }
});

test('tenant slot pattern picks the category the visitor typed', async () => {
  for (const text of ['kdy trenuje u9', 'Kdy trénuje U-9?', 'trénink U 9']) {
    const response = await new FrameMindEngine(config(), snapshot).respond({ text, now });
    assert.equal(response.context.slots.category, 'U-9', text);
    assert.equal(response.reason, 'known', text);
    assert.equal(response.text, 'U-9: pá 16:30', text);
  }
});

test('category without a record is not guessed', async () => {
  const response = await new FrameMindEngine(config(), snapshot).respond({ text: 'kdy trenuje u15', now });
  assert.notEqual(response.reason, 'known');
});

test('unsafe tenant slot patterns are ignored', async () => {
  const response = await new FrameMindEngine(
    config({ slotPatterns: [{ slot: 'category', pattern: '(a+)+$', value: 'X' }] }),
    snapshot,
  ).respond({ text: 'kdy trenuje aaaa', now });
  assert.equal(response.context.slots.category, undefined);
});

test('single selectBy object keeps working', async () => {
  const response = await new FrameMindEngine(
    config({ responses: [{ ...trainingRule, requiredAnySlots: ['birthYear'], selectBy: trainingRule.selectBy[0] }] }),
    snapshot,
  ).respond({ text: 'Ročník 2018, kdy trénuje?', now });
  assert.equal(response.text, 'U-9: pá 16:30');
});

// 1.2.4 — výchozí záznam (`recordId`) a výběr podle slotu (`selectBy`) v jednom pravidle:
// „Děláte automatizace?“ → „A kolik to stojí?“ má dát cenu automatizací, samotné
// „Kolik to stojí?“ dál výchozí ceník.
test('selectBy with a present slot wins over recordId, recordId stays the default', async () => {
  const records = [
    record('price-default', 'pricing', 'Ceník agentů', { product: 'agents' }),
    record('price-automation', 'pricing', 'Cena automatizací', { product: 'automation' }),
  ];
  const cfg = {
    mode: 'strict',
    locale: 'cs-CZ',
    intents: [
      { id: 'automation', keywords: ['automatizace'], priority: 20 },
      { id: 'pricing', keywordGroups: [['kolik', 'stoji']], priority: 20 },
    ],
    slotPatterns: [{ slot: 'product', pattern: 'automatiz', value: 'automation' }],
    responses: [
      { intentId: 'automation', recordId: 'price-automation', template: 'Ano.' },
      { intentId: 'pricing', recordId: 'price-default', selectBy: { slot: 'product', dataField: 'product', recordType: 'pricing' }, template: '{{record.content}}' },
    ],
    actions: [],
    unknownResponse: 'Nevím.',
    staleResponse: 'Staré.',
    provider: { enabled: false },
  };
  const snap = { schemaVersion: 1, generatedAt: '2026-09-28T00:00:00.000Z', records };
  const plain = await new FrameMindEngine(cfg, snap).respond({ text: 'Kolik to stojí?', now });
  assert.equal(plain.text, 'Ceník agentů');
  const followUp = await new FrameMindEngine(cfg, snap).respond({ text: 'A kolik to stojí?', history: ['Děláte automatizace?'], now });
  assert.equal(followUp.text, 'Cena automatizací');
});
