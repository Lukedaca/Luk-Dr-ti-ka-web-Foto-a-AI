import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLukasDiscourseContext,
  generateSuggestedFollowUps,
  ENTITY_TYPES,
} from '../src/js/lukas-discourse-context.mjs';
import {
  handleLukasConversationalTurn,
  buildLukasKnowledgeGraph,
} from '../src/js/lukas-nlg-engine.mjs';
import snapshot from '../knowledge/lukas.snapshot.json' with { type: 'json' };

test('LukasFollowUpSuggestions: generates sports-specific chips', () => {
  const ctx = createLukasDiscourseContext();
  ctx.setEntity(ENTITY_TYPES.SERVICE_SPORTS, 'Sportovní fotografie', { category: 'sports' });

  const chips = generateSuggestedFollowUps('fotbal', '', ctx);
  assert.ok(Array.isArray(chips));
  assert.ok(chips.length >= 2);
  assert.ok(chips.some((c) => /sportovn|fotk/i.test(c)));
});

test('LukasFollowUpSuggestions: generates portrait-specific chips', () => {
  const ctx = createLukasDiscourseContext();
  ctx.setEntity(ENTITY_TYPES.SERVICE_PORTRAITS, 'Portrétní fotografie', { category: 'portraits' });

  const chips = generateSuggestedFollowUps('portret', '', ctx);
  assert.ok(Array.isArray(chips));
  assert.ok(chips.some((c) => /portrét/i.test(c)));
});

test('LukasFollowUpSuggestions: generates AI agent-specific chips', () => {
  const ctx = createLukasDiscourseContext();
  ctx.setEntity(ENTITY_TYPES.SERVICE_AI_AGENTS, 'Vývoj AI Hybridních Agentů', { category: 'ai_agents' });

  const chips = generateSuggestedFollowUps('ai agent', '', ctx);
  assert.ok(Array.isArray(chips));
  assert.ok(chips.some((c) => /agent/i.test(c)));
});

test('LukasConversationalTurn: end-to-end multi-turn conversation flow', () => {
  const graph = buildLukasKnowledgeGraph(snapshot);
  const ctx = createLukasDiscourseContext();

  // Turn 1: Sportovní focení
  const turn1 = handleLukasConversationalTurn('Fotíš fotbal?', graph, { discourseContext: ctx });
  assert.ok(turn1.handled);
  assert.equal(ctx.activeEntity.type, ENTITY_TYPES.SERVICE_SPORTS);
  assert.ok(turn1.suggestions.length > 0);

  // Turn 2: Anaphora "A cena?"
  const turn2 = handleLukasConversationalTurn('A cena?', graph, { discourseContext: ctx });
  assert.ok(turn2.handled);
  assert.match(turn2.text, /sportovního focení/i);

  // Turn 3: Conversational repair "Ne, myslel jsem portréty"
  const turn3 = handleLukasConversationalTurn('Ne, myslel jsem portréty', graph, { discourseContext: ctx });
  assert.ok(turn3.handled);
  assert.equal(ctx.activeEntity.type, ENTITY_TYPES.SERVICE_PORTRAITS);

  // Turn 4: Anaphora on newly repaired entity "Jak probíhá focení?"
  const turn4 = handleLukasConversationalTurn('Jak to probíhá?', graph, { discourseContext: ctx });
  assert.ok(turn4.handled);
  assert.match(turn4.text, /Portrétní focení/i);
});
