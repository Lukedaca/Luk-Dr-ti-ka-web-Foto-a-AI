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

function createZeroKeywordEngine() {
  return new FrameMindEngine(
    {
      mode: 'strict',
      locale: 'cs-CZ',
      // Zero keywords, zero keywordGroups, zero examples! Pure declarative intents.
      intents: [
        { id: 'fees' },
        { id: 'web_pricing' },
        { id: 'hybrid_agent' },
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

test('2.5.0: Zero-keyword intent deduction directly from verified knowledge records', async () => {
  const engine = createZeroKeywordEngine();
  // No keyword list programmed; intent resolved strictly from grounded record content
  const res = await engine.respond({ text: 'Jaké jsou členské příspěvky?', now });
  assert.equal(res.intent, 'fees');
  assert.equal(res.reason, 'known');
  assert.match(res.text, /3 000 Kč/);
});

test('2.5.0: Zero-keyword follow-up sentence deduction (auto-facet) on already-seen record', async () => {
  const engine = createZeroKeywordEngine();
  // Turn 1: full overview of fees record
  await engine.respond({ text: 'Jaké jsou členské příspěvky?', now });

  // Turn 2: targeted follow-up on a detail inside the record (no facets exist in config)
  const res = await engine.respond({ text: 'A do kdy je splatnost?', now });
  assert.equal(res.intent, 'fees');
  assert.equal(res.reason, 'known');
  assert.equal(res.facet, 'deduced');
  assert.equal(res.text, 'Splatnost je 31. října a 28. února.');
});

test('2.5.0: Zero-keyword facet template content deduction without facet keywords', async () => {
  const engine = createZeroKeywordEngine();
  const res = await engine.respond({ text: 'Má hybridní agent hlasový výstup?', now });
  assert.equal(res.intent, 'hybrid_agent');
  assert.equal(res.reason, 'known');
  assert.equal(res.facet, 'voice');
  assert.match(res.text, /7 990 Kč/);
});

test('2.5.0: Deductive budget constraint reasoning over grounded pricing tiers', async () => {
  const engine = createZeroKeywordEngine();
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
