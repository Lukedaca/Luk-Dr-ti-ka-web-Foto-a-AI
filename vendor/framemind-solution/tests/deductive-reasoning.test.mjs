import assert from 'node:assert/strict';
import test from 'node:test';
import { FrameMindEngine, sha256Hex } from '../dist/index.js';

const now = new Date('2026-10-21T12:00:00.000Z');

function makeRecord(id, type, content, data = {}) {
  return {
    id,
    type,
    content,
    sourceUrl: `https://test.example/${id}`,
    contentHash: sha256Hex(content),
    fetchedAt: '2026-10-21T00:00:00.000Z',
    lastVerifiedAt: '2026-10-21T00:00:00.000Z',
    expiresAt: '2027-10-21T00:00:00.000Z',
    critical: true,
    data,
  };
}

const testSnapshot = {
  schemaVersion: 1,
  generatedAt: '2026-10-21T00:00:00.000Z',
  records: [
    makeRecord(
      'fees.rec',
      'fees',
      'Členské příspěvky se hradí pololetně: 3 000 Kč za pololetí. Splatnost je 31. října a 28. února. Platební údaje jsou v členské sekci; hotově jen po domluvě s vedením.',
      { amount: 3000 },
    ),
    makeRecord(
      'pricing.web',
      'web',
      'Ceník webů: Landing page od 6 900 Kč, One-page web od 8 900 Kč, Firemní web od 12 900 Kč.',
      { product: 'websites' },
    ),
    makeRecord(
      'agent.rec',
      'agent',
      'Hybridní agent spojuje lokální znalostní bázi s ovládáním webu.',
      { product: 'agents' },
    ),
  ],
};

function createZeroKeywordEngine(keywords = {}) {
  return new FrameMindEngine(
    {
      mode: 'strict',
      locale: 'cs-CZ',
      // Zero keywords, zero keywordGroups, zero examples! Pure declarative intents.
      intents: [
        { id: 'fees', ...(keywords.fees ? { keywords: keywords.fees } : {}) },
        { id: 'web_pricing', ...(keywords.web_pricing ? { keywords: keywords.web_pricing } : {}) },
        { id: 'hybrid_agent', ...(keywords.hybrid_agent ? { keywords: keywords.hybrid_agent } : {}) },
      ],
      responses: [
        {
          intentId: 'fees',
          recordId: 'fees.rec',
          // No facets configured! Sentence deduction will auto-derive facets on follow-up turns.
        },
        {
          intentId: 'web_pricing',
          recordId: 'pricing.web',
        },
        {
          intentId: 'hybrid_agent',
          recordId: 'agent.rec',
          template: '{{record.content}}',
          facets: [
            {
              id: 'voice',
              keywords: [], // Zero keywords on facet! Must deduce from template content.
              template: 'Tarif Voice & Actions (7 990 Kč) obsahuje hlasový výstup.',
            },
          ],
        },
      ],
      actions: [],
      unknownResponse: 'Tuto informaci nemohu spolehlivě potvrdit.',
      staleResponse: 'Údaj je po datu ověření.',
      provider: { enabled: false },
    },
    testSnapshot,
  );
}

// 2.6.0: odvození z obsahu záznamu je návrh, ne odpověď. Rozhoduje model s kontextem
// (22. 10. 2026: „Ahoj, jak se vede?“ odvodilo trenéra školičky, „1:1 nic moc“ sponzoring).
function assertDeferred(res, intentId) {
  assert.equal(res.intent, 'unknown');
  assert.equal(res.reason, 'unknown');
  assert.equal(res.deferred, 'deduced');
  assert.equal(res.suggestedIntent, intentId);
  assert.equal(res.text, 'Tuto informaci nemohu spolehlivě potvrdit.');
}

test('2.6.0: Zero-keyword intent deduction only suggests the intent, the model answers', async () => {
  const engine = createZeroKeywordEngine();
  assertDeferred(await engine.respond({ text: 'Jaké jsou členské příspěvky?', now }), 'fees');
});

test('2.6.0: Zero-keyword follow-up deduction never sets the topic for later turns', async () => {
  const engine = createZeroKeywordEngine();
  await engine.respond({ text: 'Jaké jsou členské příspěvky?', now });
  const res = await engine.respond({ text: 'A do kdy je splatnost?', now });
  assert.equal(res.reason, 'unknown');
  assert.equal(res.context.activeIntent, undefined);
});

test('2.6.0: Zero-keyword facet deduction is deferred as well', async () => {
  const engine = createZeroKeywordEngine();
  assertDeferred(await engine.respond({ text: 'Má hybridní agent hlasový výstup?', now }), 'hybrid_agent');
});

test('2.5.0: Deductive budget constraint reasoning over grounded pricing tiers of a lexical intent', async () => {
  const engine = createZeroKeywordEngine({ web_pricing: ['web', 'rozpocet'] });
  const res = await engine.respond({ text: 'Mám rozpočet 10 000 Kč na web', now });
  assert.equal(res.intent, 'web_pricing');
  assert.equal(res.context.slots.budgetKc, 10000);
  assert.match(res.text, /Do rozpočtu 10 000 Kč se vejde: Landing page \(6 900 Kč\), One-page web \(8 900 Kč\)\./);
});

test('2.5.0: Strict out-of-scope protection rejects ungrounded questions without hallucination', async () => {
  const engine = createZeroKeywordEngine();
  const res1 = await engine.respond({ text: 'Kdo vyhraje zítra Wimbledon?', now });
  assert.equal(res1.intent, 'unknown');
  assert.equal(res1.reason, 'unknown');

  const res2 = await engine.respond({ text: 'Jaké bude zítra počasí v Olomouci?', now });
  assert.equal(res2.intent, 'unknown');
  assert.equal(res2.reason, 'unknown');
});

test('Přirozená doptávka s konverzačním mostem odvodí jen příslušnou větu záznamu bez předprogramovaných slov', async () => {
  const engine = createZeroKeywordEngine({ fees: ['prispevky', 'clenske'] });
  const turn1 = await engine.respond({ text: 'Kolik stojí členské příspěvky?', now });
  assert.equal(turn1.intent, 'fees');
  assert.equal(turn1.reason, 'known');

  const turn2 = await engine.respond({ text: 'Super, díky, a do kdy je splatnost?', now });
  assert.equal(turn2.intent, 'fees');
  assert.equal(turn2.reason, 'known');
  assert.equal(turn2.facet, 'deduced');
  assert.match(turn2.text, /Splatnost je 31\. října a 28\. února\./);
  assert.doesNotMatch(turn2.text, /3 000 Kč za pololetí/);

  const turn3 = await engine.respond({ text: 'Aha rozumím, a dá se platit na ruku?', now });
  assert.equal(turn3.intent, 'fees');
  assert.equal(turn3.reason, 'known');
  assert.equal(turn3.facet, 'deduced');
  assert.match(turn3.text, /hotově jen po domluvě s vedením/i);
  assert.doesNotMatch(turn3.text, /3 000 Kč za pololetí/);
});
