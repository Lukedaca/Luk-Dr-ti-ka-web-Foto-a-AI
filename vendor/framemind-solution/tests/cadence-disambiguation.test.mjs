import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FrameMindEngine,
  ResponseComposer,
  composeCadence,
  selectVariant,
  sha256Hex,
} from '../dist/index.js';

test('ConversationalCadence helpers select variants and compose rhythm', () => {
  const variants = ['Opener A', 'Opener B', 'Opener C'];
  const picked1 = selectVariant(variants, 'user query 1');
  const picked2 = selectVariant(variants, 'user query 1');
  assert.equal(picked1, picked2); // deterministic for same seed
  assert.ok(variants.includes(picked1));

  const text = composeCadence({
    opener: 'Rozumím vaší otázce.',
    core: 'Tvorba webu začíná na 19 900 Kč.',
    detail: 'Každý web má garanci rychlosti a SEO základ.',
    hook: 'Chcete nezávaznou kalkulaci?',
  });

  assert.equal(
    text,
    'Rozumím vaší otázce. Tvorba webu začíná na 19 900 Kč. Každý web má garanci rychlosti a SEO základ. Chcete nezávaznou kalkulaci?',
  );
});

test('ResponseComposer applies cadence when defined', () => {
  const composer = new ResponseComposer();
  const context = { turn: 1, slots: {}, sourceIds: [] };

  const res = composer.compose(
    'Cena je 14 900 Kč.',
    undefined,
    context,
    {
      openers: ['Zde je přehled:'],
      details: ['V ceně je kompletní nastavení.'],
      hooks: ['Máte zájem o demo?'],
    },
    'seed-query',
  );

  assert.equal(
    res,
    'Zde je přehled: Cena je 14 900 Kč. V ceně je kompletní nastavení. Máte zájem o demo?',
  );
});

test('FrameMindEngine performs conversational clarification (disambiguation) without fallback', async () => {
  const snapshot = {
    schemaVersion: 1,
    generatedAt: '2026-09-09T00:00:00.000Z',
    records: [
      {
        id: 'rec-web',
        type: 'pricing',
        content: 'Tvorba webu stojí 19 900 Kč.',
        sourceUrl: 'https://framemind.cz/weby',
        contentHash: sha256Hex('Tvorba webu stojí 19 900 Kč.'),
        fetchedAt: '2026-09-09T00:00:00.000Z',
        lastVerifiedAt: '2026-09-09T00:00:00.000Z',
        intents: ['pricing_web'],
      },
      {
        id: 'rec-agent',
        type: 'pricing',
        content: 'Hybridní AI agent stojí 14 900 Kč.',
        sourceUrl: 'https://framemind.cz/agenti',
        contentHash: sha256Hex('Hybridní AI agent stojí 14 900 Kč.'),
        fetchedAt: '2026-09-09T00:00:00.000Z',
        lastVerifiedAt: '2026-09-09T00:00:00.000Z',
        intents: ['pricing_agent'],
      },
    ],
  };

  const engine = new FrameMindEngine(
    {
      mode: 'strict',
      locale: 'cs-CZ',
      intents: [
        { id: 'pricing_general', keywords: ['kolik', 'cena', 'cenik'], priority: 5 },
        { id: 'pricing_web', keywords: ['web', 'webu', 'weby'], priority: 15 },
        { id: 'pricing_agent', keywords: ['agent', 'agenta', 'agenti'], priority: 15 },
      ],
      responses: [
        {
          intentId: 'pricing_general',
          sourceRequired: false,
          clarification: {
            question: 'Ráda vám upřesním cenu. O jakou službu máte zájem?',
            options: ['Tvorba webu', 'Hybridní AI agent'],
            intentMap: {
              web: 'web',
              agent: 'agent',
              'tvorba webu': 'web',
              'hybridni ai agent': 'agent',
            },
          },
        },
        {
          intentId: 'pricing_web',
          template: '{{record.content}}',
          sourceRequired: true,
          recordId: 'rec-web',
        },
        {
          intentId: 'pricing_agent',
          template: '{{record.content}}',
          sourceRequired: true,
          recordId: 'rec-agent',
        },
      ],
      actions: [],
      unknownResponse: 'Nerozumím dotazu.',
      staleResponse: 'Data jsou zastaralá.',
    },
    snapshot,
  );

  // Turn 1: Ambiguous general question "Kolik to stojí?"
  const res1 = await engine.respond({ text: 'Kolik to stoji?' });
  assert.equal(res1.intent, 'pricing_general');
  assert.equal(res1.text, 'Ráda vám upřesním cenu. O jakou službu máte zájem?');
  assert.deepEqual(res1.suggestions, ['Tvorba webu', 'Hybridní AI agent']);
  assert.equal(res1.discourse?.awaitingClarification?.type, 'pricing_general');

  // Turn 2: User answers with option "Tvorba webu"
  const res2 = await engine.respond({ text: 'Tvorba webu' });
  assert.equal(res2.intent, 'pricing_web');
  assert.match(res2.text, /19 900 Kč/);
  assert.equal(res2.discourse?.awaitingClarification, null); // cleared!
});
