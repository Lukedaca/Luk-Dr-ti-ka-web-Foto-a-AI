import assert from 'node:assert/strict';
import test from 'node:test';
import { FrameMindEngine, isNegatedRequest, sha256Hex, uncoveredTerms } from '../dist/index.js';

// 2.6.0 — brána lokální odpovědi. Vzory z regresního testu 22. 10. 2026 na fcprerov.cz.
const now = new Date('2026-10-22T12:00:00.000Z');

function record(id, content, data = {}) {
  return {
    id,
    type: id,
    content,
    sourceUrl: `https://club.example/${id}`,
    contentHash: sha256Hex(content),
    fetchedAt: '2026-10-21T00:00:00.000Z',
    lastVerifiedAt: '2026-10-21T00:00:00.000Z',
    expiresAt: '2027-10-21T00:00:00.000Z',
    critical: true,
    data,
  };
}

const snapshot = {
  schemaVersion: 1,
  generatedAt: '2026-10-21T00:00:00.000Z',
  records: [
    record('address', 'Sídlo klubu je Sokolská 734/28, Přerov.'),
    record('articles', 'Články a novinky klubu.'),
  ],
};

function engine(extra = {}) {
  return new FrameMindEngine({
    mode: 'strict',
    locale: 'cs-CZ',
    intents: [
      { id: 'address', keywords: ['sidlo', 'adresa'], examples: ['Kde sídlí klub?'], priority: 10 },
      { id: 'articles', keywords: ['clanky', 'clanek', 'novinky'], priority: 10 },
    ],
    responses: [
      { intentId: 'address', recordId: 'address' },
      { intentId: 'articles', recordId: 'articles' },
    ],
    actions: [],
    unknownResponse: 'Nevím.',
    staleResponse: 'Staré.',
    provider: { enabled: false },
    answerGate: { neutralTerms: ['klub'] },
    ...extra,
  }, snapshot);
}

test('přímý dotaz na téma záměru odpoví jádro samo', async () => {
  const res = await engine().respond({ text: 'Jaké je sídlo klubu?', now });
  assert.equal(res.intent, 'address');
  assert.equal(res.reason, 'known');
  assert.equal(res.deferred, undefined);
});

test('zápor nebo oprava nikdy nedostane odmítnutou odpověď znovu', async () => {
  for (const text of ['Nechci sídlo klubu', 'Chtěl jsem historii klubu a ne sídlo', 'To ne, sídlo nechci']) {
    const res = await engine().respond({ text, now });
    assert.equal(res.reason, 'unknown', text);
    assert.equal(res.deferred, 'negation', text);
    assert.equal(res.suggestedIntent, 'address', text);
  }
});

test('stejná odpověď podruhé za sebou jde na model', async () => {
  const e = engine();
  const first = await e.respond({ text: 'Jaké je sídlo klubu?', now });
  assert.equal(first.reason, 'known');
  const second = await e.respond({ text: 'Jaké je sídlo klubu?', now });
  assert.equal(second.reason, 'unknown');
  assert.equal(second.deferred, 'repeat');
  assert.equal(second.suggestedIntent, 'address');
});

test('dotaz, ve kterém je téma záměru jen okrajově, jde na model', async () => {
  const text = 'Jaká je nálada v klubu? Podle článku vidím, že pan trenér Jemelka není moc spokojený';
  const res = await engine().respond({ text, now });
  assert.equal(res.reason, 'unknown');
  assert.equal(res.deferred, 'uncovered');
  assert.equal(res.suggestedIntent, 'articles');
  assert.equal(res.context.activeIntent, undefined);
});

test('vypnutá brána = chování před 2.6.0', async () => {
  const res = await engine({ answerGate: { enabled: false } }).respond({ text: 'Nechci sídlo klubu', now });
  assert.equal(res.intent, 'address');
  assert.equal(res.reason, 'known');
});

test('pokrytí: sloty, zmínky, čísla a slova značky nejsou cizí slova', () => {
  const vocabulary = ['trenink', 'treninky'];
  assert.deepEqual(uncoveredTerms('Kdy má trénink syn, je mu osm let?', vocabulary), ['syn']);
  assert.deepEqual(uncoveredTerms('Kdy jsou tréninky U-11?', vocabulary, { slotPatterns: [{ slot: 'category', pattern: '\\bu-?11\\b', value: 'U-11' }] }), []);
  assert.deepEqual(uncoveredTerms('Trénink se Slavonínem v říjnu', vocabulary, { mentionValues: ['FK Slavonín'] }), []);
  assert.deepEqual(uncoveredTerms('Tréninky Viktorie', vocabulary, { neutralTerms: ['Viktorie'] }), []);
  assert.deepEqual(uncoveredTerms('Jaká je historie klubu?', ['sidlo', 'klub']), ['historie']);
});

test('zápor: jen záporné přání, ne každé „ne“ ve slově', () => {
  for (const text of ['Nechci sídlo', 'To jsem nechtěl', 'Myslel jsem tréninky a ne zápasy', 'Ne, to ne']) {
    assert.equal(isNegatedRequest(text), true, text);
  }
  for (const text of ['Není trénink zrušený?', 'Kdy je nejbližší zápas?', 'Nebo v sobotu?']) {
    assert.equal(isNegatedRequest(text), false, text);
  }
});

test('kontrastivní oprava na známý záměr („Nechci X, ale Y“ / „Myslel jsem Y a ne X“) odpoví na Y', async () => {
  for (const text of ['Nechci sídlo, ale články', 'Myslel jsem články klubu a ne sídlo']) {
    const res = await engine().respond({ text, now });
    assert.equal(res.intent, 'articles', text);
    assert.equal(res.reason, 'known', text);
    assert.equal(res.deferred, undefined, text);
  }
});

test('otevřený poradní nebo názorový dotaz nespustí statickou šablonu a jde na model', async () => {
  for (const text of ['Co si myslíš o sídle klubu?', 'Má podle tebe smysl sledovat články klubu?']) {
    const res = await engine().respond({ text, now });
    assert.equal(res.reason, 'unknown', text);
    assert.equal(res.deferred, 'uncovered', text);
  }
});
