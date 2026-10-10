import assert from 'node:assert/strict';
import test from 'node:test';
import { FrameMindEngine, IntentEngine, sha256Hex } from '../dist/index.js';

const context = { slots: {}, turn: 0 };

test('standalone social phrases cannot swallow an unseen request or apology with a topic', () => {
  const detector = new IntentEngine([
    { id: 'greeting', standalone: true, examples: ['Dobrý den'], keywords: ['ahoj'], priority: 500 },
    { id: 'thanks', standalone: true, examples: ['Děkuji moc'], keywords: ['diky'], priority: 500 },
    { id: 'contact', keywords: ['kontakt'], priority: 10 },
  ]);
  for (const text of ['DOBRÝ DEN!', 'ahoj']) assert.equal(detector.detect(text, context).id, 'greeting');
  for (const text of ['Dobrý den, jaký je kontakt?', 'Díky, potřebuji kontakt.']) {
    assert.equal(detector.detect(text, context).id, 'contact');
  }
  assert.equal(detector.detect('Ahoj, nerozumím rozpisu.', context).id, 'unknown');
  assert.equal(detector.detect('Děkuji moc!', context).id, 'thanks');
  // Existing integrations keep their previous matching unless they opt in.
  assert.equal(new IntentEngine([{ id: 'legacy', examples: ['Ahoj'] }]).detect('Ahoj světe', context).id, 'legacy');
});

test('the last mentioned slot wins regardless of configured pattern order, including repeated matches', () => {
  const patterns = [
    { slot: 'product', pattern: '\\bweb\\b', value: 'web' },
    { slot: 'product', pattern: '\\bagent\\b', value: 'agent' },
    { slot: 'category', pattern: '\\bu(\\d\\d?)\\b', value: 'U-$1' },
  ];
  for (const ordered of [patterns, [...patterns].reverse()]) {
    const engine = new IntentEngine([], ordered);
    assert.equal(engine.detect('agent, vlastně web', context).slots.product, 'web');
    assert.equal(engine.detect('web, vlastně agent', context).slots.product, 'agent');
    assert.equal(engine.detect('U9, oprava U11', context).slots.category, 'U-11');
  }
  const optional = new IntentEngine([], [{ slot: 'optional', pattern: 'x?', value: 'x' }]);
  assert.equal(optional.detect('web', context).slots.optional, 'x');
});

test('a correction in product context reaches the right record after stateless history replay', async () => {
  const config = {
    mode: 'strict', locale: 'cs-CZ', provider: { enabled: false },
    slotPatterns: [{ slot: 'product', pattern: '\\bweb\\b', value: 'web' }, { slot: 'product', pattern: '\\bagent\\b', value: 'agent' }],
    intents: [{ id: 'product', keywords: ['web', 'agent'], priority: 10 }, { id: 'pricing', keywords: ['cena'], priority: 10 }],
    responses: [{ intentId: 'product', sourceRequired: false, template: 'Jaké řešení potřebujete?' }, { intentId: 'pricing', selectBy: { slot: 'product', dataField: 'product' } }],
    actions: [], unknownResponse: 'Nevím.', staleResponse: 'Neaktuální.',
  };
  const snapshot = { schemaVersion: 1, generatedAt: '2026-10-10T00:00:00Z', records: [
    { id: 'web', type: 'pricing', data: { product: 'web' }, content: 'Web na míru.', sourceUrl: 'https://example.com/web', lastVerifiedAt: '2026-10-10T00:00:00Z', fetchedAt: '2026-10-10T00:00:00Z', contentHash: '' },
    { id: 'agent', type: 'pricing', data: { product: 'agent' }, content: 'Cena agenta.', sourceUrl: 'https://example.com/agent', lastVerifiedAt: '2026-10-10T00:00:00Z', fetchedAt: '2026-10-10T00:00:00Z', contentHash: '' },
  ] };
  for (const record of snapshot.records) record.contentHash = sha256Hex(record.content);
  const result = await new FrameMindEngine(config, snapshot).respond({ text: 'A cena?', history: ['agent, vlastně web'], now: new Date('2026-10-10T10:00:00Z') });
  assert.equal(result.intent, 'pricing');
  assert.equal(result.text, 'Web na míru.');
  assert.equal(result.source.url, 'https://example.com/web');
});
