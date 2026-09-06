import test from 'node:test';
import assert from 'node:assert/strict';
import {
  composeCadence,
  selectVariant,
  formatLukasSportsReply,
  formatLukasPortraitReply,
  formatLukasAgentReply,
  formatLukasPricingReply,
  formatLukasProcessReply,
  formatLukasContactReply,
} from '../src/js/lukas-conversational-style.mjs';
import { buildLukasKnowledgeGraph } from '../src/js/lukas-nlg-engine.mjs';
import snapshot from '../knowledge/lukas.snapshot.json' with { type: 'json' };

test('LukasConversationalStyle: composeCadence combines 4 parts smoothly', () => {
  const result = composeCadence({
    opener: 'Ahoj!',
    core: 'Tady je informace.',
    detail: 'A zde je detail.',
    hook: 'Chceš vědět víc?',
  });
  assert.equal(result, 'Ahoj! Tady je informace. A zde je detail. Chceš vědět víc?');
});

test('LukasConversationalStyle: selectVariant produces deterministic variant', () => {
  const variants = ['Var A', 'Var B', 'Var C'];
  const v1 = selectVariant(variants, 'seed1');
  const v2 = selectVariant(variants, 'seed1');
  assert.equal(v1, v2);
  assert.ok(variants.includes(v1));
});

test('LukasConversationalStyle: formats sports and portrait replies with 4-phase cadence', () => {
  const graph = buildLukasKnowledgeGraph(snapshot);
  const sports = formatLukasSportsReply('fotbal', graph);
  assert.ok(sports);
  assert.match(sports, /Viktorie Přerov/i);
  assert.match(sports, /\?/); // contains hook question

  const portrait = formatLukasPortraitReply('portret', graph);
  assert.ok(portrait);
  assert.match(portrait, /ateliér|exteriér/i);
  assert.match(portrait, /\?/);
});

test('LukasConversationalStyle: formats AI agent, pricing and process replies', () => {
  const graph = buildLukasKnowledgeGraph(snapshot);
  const agent = formatLukasAgentReply('agenti', graph);
  assert.ok(agent);
  assert.match(agent, /AI Hybridní/i);

  const pricing = formatLukasPricingReply('cena', graph);
  assert.ok(pricing);
  assert.match(pricing, /Ceník|kalkul/i);

  const process = formatLukasProcessReply('postup', graph);
  assert.ok(process);
  assert.match(process, /Konzultace|Plánování|Realizace/i);
});
