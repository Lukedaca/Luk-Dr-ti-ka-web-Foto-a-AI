import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLukasDiscourseContext,
  containsAnaphoricReference,
  isEllipticalQuery,
  resolveAnaphoraAndEllipsis,
  checkAmbiguousClarification,
  handleClarificationResponse,
  ENTITY_TYPES,
} from '../src/js/lukas-discourse-context.mjs';
import { buildLukasKnowledgeGraph } from '../src/js/lukas-nlg-engine.mjs';
import snapshot from '../knowledge/lukas.snapshot.json' with { type: 'json' };

test('LukasDiscourseContext: initial state and entity tracking', () => {
  const ctx = createLukasDiscourseContext();
  assert.equal(ctx.activeEntity, null);
  assert.equal(ctx.turnCount, 0);

  ctx.setEntity(ENTITY_TYPES.SERVICE_SPORTS, 'Sportovní fotografie', { category: 'sports' });
  assert.equal(ctx.activeEntity.type, ENTITY_TYPES.SERVICE_SPORTS);
  assert.equal(ctx.activeEntity.name, 'Sportovní fotografie');
  assert.equal(ctx.lastTopic, ENTITY_TYPES.SERVICE_SPORTS);

  ctx.advanceTurn('Fotíš fotbal?', 'Ano, fotím zápasy Viktorky.', 'direct_nlg');
  assert.equal(ctx.turnCount, 1);
  assert.equal(ctx.history.length, 1);
});

test('LukasDiscourseContext: detects anaphoric and elliptical queries', () => {
  assert.ok(containsAnaphoricReference('A kolik to stojí?'));
  assert.ok(containsAnaphoricReference('Jaký je u toho postup?'));
  assert.ok(containsAnaphoricReference('A cena?'));

  assert.ok(isEllipticalQuery('A cena?'));
  assert.ok(isEllipticalQuery('kolik stojí?'));
  assert.ok(isEllipticalQuery('postup'));
  assert.ok(!isEllipticalQuery('Tohle je dlouhá věta o focení fotbalu'));
});

test('LukasDiscourseContext: resolves anaphora for sports photo pricing and process', () => {
  const graph = buildLukasKnowledgeGraph(snapshot);
  const ctx = createLukasDiscourseContext();
  ctx.setEntity(ENTITY_TYPES.SERVICE_SPORTS, 'Sportovní fotografie', { category: 'sports' });

  const priceResult = resolveAnaphoraAndEllipsis('A cena?', ctx, graph);
  assert.ok(priceResult.handled);
  assert.match(priceResult.directAnswer, /sportovního focení/i);

  const processResult = resolveAnaphoraAndEllipsis('A jak to probíhá?', ctx, graph);
  assert.ok(processResult.handled);
  assert.match(processResult.directAnswer, /culling|výběr/i);
});

test('LukasDiscourseContext: resolves anaphora for portraits and AI agents', () => {
  const graph = buildLukasKnowledgeGraph(snapshot);
  const ctx = createLukasDiscourseContext();

  ctx.setEntity(ENTITY_TYPES.SERVICE_PORTRAITS, 'Portrétní fotografie', { category: 'portraits' });
  const portraitPrice = resolveAnaphoraAndEllipsis('Kolik to stojí?', ctx, graph);
  assert.ok(portraitPrice.handled);
  assert.match(portraitPrice.directAnswer, /Portrétní focení/i);

  ctx.setEntity(ENTITY_TYPES.SERVICE_AI_AGENTS, 'Vývoj AI Hybridních Agentů', { category: 'ai_agents' });
  const agentPrice = resolveAnaphoraAndEllipsis('A cena?', ctx, graph);
  assert.ok(agentPrice.handled);
  assert.match(agentPrice.directAnswer, /AI Hybridního Agenta/i);
});

test('LukasDiscourseContext: triggers clarification for ambiguous bare price query without context', () => {
  const ctx = createLukasDiscourseContext();
  const clar = checkAmbiguousClarification('Kolik to stojí?', ctx);
  assert.ok(clar.handled);
  assert.match(clar.text, /Lukáš nabízí sportovní fotografii/i);
  assert.equal(ctx.pendingClarification.topic, 'pricing_category');

  // Answer clarification with "sport"
  const resolved = handleClarificationResponse('sport', ctx);
  assert.ok(resolved.handled);
  assert.match(resolved.text, /sportovní fotografie/i);
  assert.equal(ctx.activeEntity.type, ENTITY_TYPES.SERVICE_SPORTS);
  assert.equal(ctx.pendingClarification, null);
});
