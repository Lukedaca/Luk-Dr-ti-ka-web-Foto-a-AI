import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FrameMindEngine,
  SemanticIntentIndex,
  collectIntentExamples,
  selectSemanticIntent,
  sha256Hex,
} from '../dist/index.js';

// 1.6.0 — sémantická rozhodovací vrstva (opt-in). Lexikální detekce zůstává první;
// vrstva vybírá jen existující záměr, text odpovědi skládá jeho pravidlo.

const now = new Date('2026-10-11T12:00:00.000Z');

function record(id, content) {
  return {
    id,
    type: id,
    content,
    sourceUrl: `https://club.example/${id}`,
    contentHash: sha256Hex(content),
    fetchedAt: '2026-10-11T00:00:00.000Z',
    lastVerifiedAt: '2026-10-11T00:00:00.000Z',
    expiresAt: '2027-06-30T23:59:59.000Z',
    critical: true,
    data: {},
  };
}

const snapshot = {
  schemaVersion: 1,
  generatedAt: '2026-10-11T00:00:00.000Z',
  records: [record('fees', 'Příspěvky jsou 3 000 Kč za pololetí.'), record('camp', 'Letní kemp je v srpnu.')],
};

const baseConfig = {
  mode: 'strict',
  locale: 'cs-CZ',
  intents: [
    { id: 'fees', keywords: ['prispevky'], examples: ['Kolik stojí příspěvky?'], priority: 18 },
    { id: 'camp', keywords: ['kemp'], examples: ['Máte letní kemp?'], priority: 18 },
    { id: 'contact_capture', examples: ['Můj telefon je 777 123 456'] },
    { id: 'no_rule', examples: ['Bez pravidla odpovědi'] },
  ],
  responses: [
    { intentId: 'fees', recordId: 'fees' },
    { intentId: 'camp', recordId: 'camp' },
    { intentId: 'contact_capture', sourceRequired: false, template: 'Kontakt předám.' },
  ],
  actions: [],
  unknownResponse: 'Nevím.',
  staleResponse: 'Staré.',
  provider: { enabled: false },
};

// Falešný „model“: vrací pevné skóre podle textu, jak by je spočítal hostitel.
function resolverFor(table, calls = []) {
  return async (text) => {
    calls.push(text);
    return table[text] ?? [];
  };
}

const engineWith = (semanticIntents) => new FrameMindEngine({ ...baseConfig, semanticIntents }, snapshot);

test('index: nejbližší příklad každého záměru, seřazeno podle podobnosti', () => {
  const index = new SemanticIntentIndex([
    { intentId: 'fees', vector: [1, 0, 0] },
    { intentId: 'fees', vector: [0.6, 0.8, 0] },
    { intentId: 'camp', vector: [0, 0, 1] },
    { intentId: 'broken', vector: [0, 0, 0] },
  ]);
  assert.equal(index.size, 3);
  const ranked = index.rank([0.6, 0.8, 0]);
  assert.equal(ranked[0].intentId, 'fees');
  assert.ok(Math.abs(ranked[0].score - 1) < 1e-9);
  assert.equal(ranked[1].intentId, 'camp');
  assert.deepEqual(index.rank([0, 0, 0]), []);
});

test('příklady k zakódování: examples i schválené exactExamples', () => {
  const texts = collectIntentExamples([
    { id: 'a', examples: ['Jedna', ' '], exactExamples: ['Dva'] },
    { id: 'b' },
  ]);
  assert.deepEqual(texts, [{ intentId: 'a', text: 'Jedna' }, { intentId: 'a', text: 'Dva' }]);
});

test('výběr: jen při dostatečném skóre i odstupu, vyloučený nebo neznámý záměr nikdy', () => {
  const known = new Set(['fees', 'camp', 'contact_capture']);
  const pick = (scores, cfg) => selectSemanticIntent(scores, known, cfg);
  assert.equal(pick([{ intentId: 'fees', score: 0.93 }, { intentId: 'camp', score: 0.85 }])?.intentId, 'fees');
  assert.equal(pick([{ intentId: 'fees', score: 0.86 }, { intentId: 'camp', score: 0.8 }]), null, 'pod prahem');
  assert.equal(pick([{ intentId: 'fees', score: 0.93 }, { intentId: 'camp', score: 0.91 }]), null, 'malý odstup');
  assert.equal(pick([{ intentId: 'ghost', score: 0.99 }]), null, 'neznámý záměr');
  assert.equal(
    pick([{ intentId: 'contact_capture', score: 0.97 }, { intentId: 'fees', score: 0.5 }], { excludeIntents: ['contact_capture'] }),
    null,
    'vyloučený záměr nepropadne na druhý v pořadí',
  );
  assert.equal(pick([{ intentId: 'fees', score: Number.NaN }]), null);
});

test('engine: parafrázi ze slov záměru (překlep, jiný tvar) rozhodne vrstva a odpoví pravidlo', async () => {
  const text = 'Kolik stoji prspevky?';
  const engine = engineWith({
    processing: 'local',
    resolver: resolverFor({ [text]: [{ intentId: 'fees', score: 0.94 }, { intentId: 'camp', score: 0.82 }] }),
  });
  const response = await engine.respond({ text, now });
  assert.equal(response.intent, 'fees');
  assert.equal(response.reason, 'known');
  assert.equal(response.text, 'Příspěvky jsou 3 000 Kč za pololetí.');
  assert.equal(response.semantic?.intentId, 'fees');
  assert.ok(Math.abs(response.semantic.margin - 0.12) < 1e-9);
});

test('2.6.0: parafráze se slovy mimo záměr jde na model, záměr zůstane jen návrhem', async () => {
  // Podobnost není doklad: 22. 10. 2026 „Jaká je historie klubu?“ dostalo sídlo (0,39).
  const text = 'Kolik se platí za fotbal?';
  const engine = engineWith({
    processing: 'local',
    resolver: resolverFor({ [text]: [{ intentId: 'fees', score: 0.94 }, { intentId: 'camp', score: 0.82 }] }),
  });
  const response = await engine.respond({ text, now });
  assert.equal(response.intent, 'unknown');
  assert.equal(response.reason, 'unknown');
  assert.equal(response.deferred, 'uncovered');
  assert.equal(response.suggestedIntent, 'fees');
  assert.equal(response.context.activeIntent, undefined);
});

test('engine: nejistá vrstva = chování jako bez ní (unknown → fallback hostitele)', async () => {
  const text = 'Tak to je špatný';
  const engine = engineWith({
    processing: 'local',
    resolver: resolverFor({ [text]: [{ intentId: 'camp', score: 0.9 }, { intentId: 'fees', score: 0.88 }] }),
  });
  const response = await engine.respond({ text, now });
  assert.equal(response.intent, 'unknown');
  assert.equal(response.semantic, undefined);
});

test('engine: lexikálně známý dotaz vrstvu vůbec nevolá', async () => {
  const calls = [];
  const engine = engineWith({ processing: 'local', resolver: resolverFor({}, calls) });
  const response = await engine.respond({ text: 'Kolik stojí příspěvky?', now });
  assert.equal(response.intent, 'fees');
  assert.deepEqual(calls, []);
});

test('engine: bez deklarace lokálního zpracování, při chybě modelu nebo bez pravidla se vrstva neuplatní', async () => {
  const text = 'Kolik se platí za fotbal?';
  const confident = [{ intentId: 'fees', score: 0.95 }, { intentId: 'camp', score: 0.5 }];

  const notLocal = await engineWith({ processing: 'cloud', resolver: resolverFor({ [text]: confident }) }).respond({ text, now });
  assert.equal(notLocal.intent, 'unknown');

  const failing = await engineWith({ processing: 'local', resolver: async () => { throw new Error('model down'); } }).respond({ text, now });
  assert.equal(failing.intent, 'unknown');

  const noRule = await engineWith({
    processing: 'local',
    resolver: resolverFor({ [text]: [{ intentId: 'no_rule', score: 0.99 }, { intentId: 'fees', score: 0.5 }] }),
  }).respond({ text, now });
  assert.equal(noRule.intent, 'unknown');
});

// 1.7.0 — vestavěný resolver bez modelu (znakové n-gramy + TF-IDF).
import { createNgramIntentResolver, ngramSemanticIntents } from '../dist/index.js';

test('n-gramy: parafráze se společným kmenem najde záměr, nesouvisející věta ne', async () => {
  const intents = [
    { id: 'fees', examples: ['Kolik stojí členské příspěvky?', 'Jak platit příspěvky'] },
    { id: 'camp', examples: ['Máte letní kemp?', 'Kdy je soustředění'] },
  ];
  const resolve = createNgramIntentResolver(intents);
  const ranked = (await resolve('Do kdy se platí členské?')).sort((a, b) => b.score - a.score);
  assert.equal(ranked[0].intentId, 'fees');
  const unrelated = (await resolve('Jaké bude počasí?')).sort((a, b) => b.score - a.score);
  assert.ok(!unrelated.length || unrelated[0].score < 0.35, JSON.stringify(unrelated[0]));
  assert.deepEqual(await resolve('   '), []);
});

test('n-gramy v enginu: nová parafráze odpoví pravidlem, mimo záběr zůstane unknown', async () => {
  const config = { ...baseConfig };
  const engine = new FrameMindEngine({ ...config, semanticIntents: ngramSemanticIntents(config.intents, { excludeIntents: ['contact_capture'] }) }, snapshot);
  const known = await engine.respond({ text: 'Máte nějaký letní kemp pro děti?', now });
  assert.equal(known.intent, 'camp');
  assert.equal(known.text, 'Letní kemp je v srpnu.');
  const outside = await new FrameMindEngine({ ...config, semanticIntents: ngramSemanticIntents(config.intents) }, snapshot)
    .respond({ text: 'Napiš mi recept na guláš', now });
  assert.equal(outside.intent, 'unknown');
});
