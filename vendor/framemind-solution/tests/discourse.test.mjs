import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DiscourseContext,
  FrameMindEngine,
  IntentEngine,
  defineAgentProfile,
  sha256Hex,
} from '../dist/index.js';

test('DiscourseContext tracks active and recent entities', () => {
  const dc = new DiscourseContext({ maxRecentEntities: 3 });

  dc.setEntity('service', 'Weby', { price: 19900 });
  assert.equal(dc.getEntity()?.name, 'Weby');
  assert.equal(dc.getEntity('service')?.data?.price, 19900);

  dc.setEntity('service', 'Agenti', { price: 14900 });
  assert.equal(dc.getEntity()?.name, 'Agenti');

  dc.setEntity('service', 'Foto', { price: 2900 });
  dc.setEntity('player', 'Jan Novak', { number: 10 });

  // Recency queue should have max 3 entries
  const snap = dc.snapshot();
  assert.equal(snap.recentEntities.length, 3);
  assert.equal(snap.recentEntities[0].name, 'Jan Novak');
  assert.equal(snap.recentEntities[1].name, 'Foto');
  assert.equal(snap.recentEntities[2].name, 'Agenti');
});

test('DiscourseContext detects anaphora and repair queries', () => {
  const dc = new DiscourseContext();

  assert.equal(dc.isAnaphoraQuery('A kolik to stoji?'), true);
  assert.equal(dc.isAnaphoraQuery('A cena?'), true);
  assert.equal(dc.isAnaphoraQuery('Kde vlastne hraji?'), true);
  assert.equal(dc.isAnaphoraQuery('kolik stoji listek?'), true);
  assert.equal(dc.isAnaphoraQuery('V kolik hodin zacina zapas?'), false);

  assert.equal(dc.isRepairQuery('Ne, myslel jsem web'), true);
  assert.equal(dc.isRepairQuery('Vlastne myslim agenta'), true);
  assert.equal(dc.isRepairQuery('Pardon, chci fotbal'), true);
  assert.equal(dc.isRepairQuery('Jaky je program na vikend?'), false);

  assert.equal(dc.extractRepairSubject('Ne, myslel jsem web'), 'web');
  assert.equal(dc.extractRepairSubject('Vlastne, agenta'), 'agenta');
});

test('DiscourseContext clarifies and snapshots state', () => {
  const dc = new DiscourseContext();
  dc.setAwaitingClarification({
    type: 'pricing_disambiguation',
    question: 'Myslíte cenu webu nebo hybridního agenta?',
    options: ['Tvorba webu', 'Hybridní agent'],
  });

  const snap = dc.snapshot();
  assert.equal(snap.awaitingClarification?.type, 'pricing_disambiguation');
  assert.equal(snap.awaitingClarification?.options.length, 2);

  dc.clearAwaitingClarification();
  assert.equal(dc.snapshot().awaitingClarification, null);
});

test('FrameMindEngine attaches suggestions and updates discourse snapshot', async () => {
  const profile = defineAgentProfile({
    id: 'test-agent',
    name: 'Test Agent',
    domain: 'agency-saas',
    version: '1.1.0',
    sections: [
      { id: 'webs', label: 'Weby', type: 'page', target: '/weby' },
    ],
    capabilities: [
      { name: 'nav', tools: ['navigate'], description: 'Navigation' },
    ],
    entities: [
      {
        type: 'service',
        name: 'Weby',
        keywords: ['web', 'stranky'],
        suggestedFollowUps: ['Kolik stojí web?', 'Jak dlouho trvá realizace?'],
      },
    ],
    suggestedFollowUps: {
      greeting: ['Co nabízíte?', 'Jak fungují agenti?'],
    },
  });

  const snapshot = {
    schemaVersion: 1,
    generatedAt: '2026-09-09T00:00:00.000Z',
    records: [
      {
        id: 'rec-webs',
        type: 'service',
        content: 'Tvoříme moderní weby od 19 900 Kč.',
        sourceUrl: 'https://framemind.cz/weby',
        contentHash: sha256Hex('Tvoříme moderní weby od 19 900 Kč.'),
        fetchedAt: '2026-09-09T00:00:00.000Z',
        lastVerifiedAt: '2026-09-09T00:00:00.000Z',
        intents: ['pricing'],
      },
    ],
  };

  const engine = new FrameMindEngine(
    {
      mode: 'strict',
      locale: 'cs-CZ',
      profile,
      intents: [
        { id: 'greeting', keywords: ['ahoj', 'dobry den'], priority: 10 },
        { id: 'pricing', keywords: ['cena', 'kolik', 'ceny'], priority: 10 },
      ],
      responses: [
        { intentId: 'greeting', template: 'Dobrý den! Jak vám mohu pomoci?', sourceRequired: false },
        { intentId: 'pricing', template: '{{record.content}}', sourceRequired: true, recordId: 'rec-webs' },
      ],
      actions: [],
      unknownResponse: 'Nerozumím.',
      staleResponse: 'Data jsou neaktuální.',
    },
    snapshot,
  );

  // 1. First turn - greeting
  const res1 = await engine.respond({ text: 'Ahoj' });
  assert.equal(res1.intent, 'greeting');
  assert.deepEqual(res1.suggestions, ['Co nabízíte?', 'Jak fungují agenti?']);
  assert.equal(res1.discourse?.turn, 1);

  // 2. Second turn with repair query
  const res2 = await engine.respond({ text: 'Ne, myslel jsem kolik stoji web' });
  assert.equal(res2.intent, 'pricing');
  assert.match(res2.text, /19 900 Kč/);
  assert.equal(res2.discourse?.activeEntity?.name, 'Weby');
  assert.deepEqual(res2.suggestions, ['Kolik stojí web?', 'Jak dlouho trvá realizace?']);
  assert.equal(res2.discourse?.turn, 2);

  // 3. Third turn: inflected query with stemmer ("o vašich webech")
  const res3 = await engine.respond({ text: 'Rada bych vedela o tech webech' });
  assert.equal(res3.discourse?.activeEntity?.name, 'Weby');
});

test('Czech stemming matches inflected words in IntentEngine', () => {
  const intentEngine = new IntentEngine([
    { id: 'pricing', keywords: ['cena', 'cenik'], priority: 10 },
    { id: 'tickets', keywords: ['listek', 'vstupenka'], priority: 10 },
    { id: 'webs', keywords: ['web', 'stranka'], priority: 10 },
  ]);

  const testCases = [
    { query: 'jakou mate cenou', expectedIntent: 'pricing' },
    { query: 'kolik stoji ty listky', expectedIntent: 'tickets' },
    { query: 'mluvme o novem webu', expectedIntent: 'webs' },
    { query: 'tvorba novych webu a aplikaci', expectedIntent: 'webs' },
  ];

  for (const tc of testCases) {
    const match = intentEngine.detect(tc.query, { turn: 0, slots: {}, sourceIds: [] });
    assert.equal(match.id, tc.expectedIntent, `Query "${tc.query}" should match ${tc.expectedIntent}, got ${match.id}`);
  }
});


