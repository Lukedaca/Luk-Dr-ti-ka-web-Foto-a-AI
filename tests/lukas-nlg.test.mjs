import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLukasKnowledgeGraph,
  synthesizeLukasDialogue,
} from '../src/js/lukas-nlg-engine.mjs';
import snapshot from '../knowledge/lukas.snapshot.json' with { type: 'json' };

test('Lukas NLG Engine: builds knowledge graph with structured records', () => {
  const graph = buildLukasKnowledgeGraph(snapshot);
  assert.ok(graph.about);
  assert.ok(graph.sportsPhoto);
  assert.ok(graph.portraitPhoto);
  assert.ok(graph.aiAgents);
  assert.ok(graph.pricing);
  assert.ok(graph.contact);
  assert.match(graph.about.content, /Lukáš Drštička/);
});

test('Lukas NLG Engine: dynamically deduces mood and studio work for jak se vede', () => {
  const graph = buildLukasKnowledgeGraph(snapshot);
  const reply = synthesizeLukasDialogue('jak se vede ?', graph);
  assert.ok(reply);
  assert.match(reply, /Mám se skvěle/i);
  assert.match(reply, /Viktorie Přerov/i);
  assert.match(reply, /FrameMind/i);
});

test('Lukas NLG Engine: deduces recent news and match galleries for co je nového', () => {
  const graph = buildLukasKnowledgeGraph(snapshot);
  const reply = synthesizeLukasDialogue('co je nového ?', graph);
  assert.ok(reply);
  assert.match(reply, /novinek/i);
  assert.match(reply, /Viktorku/i);
  assert.match(reply, /galerie/i);
});

test('Lukas NLG Engine: transparently discloses identity as AI Hybridní Agent', () => {
  const graph = buildLukasKnowledgeGraph(snapshot);
  const reply = synthesizeLukasDialogue('Kdo jsi?', graph);
  assert.ok(reply);
  assert.match(reply, /AI Hybridní Agent/i);
  assert.match(reply, /Lukáš/i);
});

test('Lukas NLG Engine: explains creator origins', () => {
  const graph = buildLukasKnowledgeGraph(snapshot);
  const reply = synthesizeLukasDialogue('Kdo tě vytvořil?', graph);
  assert.ok(reply);
  assert.match(reply, /Lukáš Drštička/i);
  assert.match(reply, /Přerov/i);
});

test('Lukas NLG Engine: deduces sports photography facts', () => {
  const graph = buildLukasKnowledgeGraph(snapshot);
  const reply = synthesizeLukasDialogue('Fotíš fotbalové zápasy?', graph);
  assert.ok(reply);
  assert.match(reply, /Viktorie Přerov/i);
  assert.match(reply, /zápas/i);
});

test('Lukas NLG Engine: deduces AI hybrid agents expertise', () => {
  const graph = buildLukasKnowledgeGraph(snapshot);
  const reply = synthesizeLukasDialogue('Jak fungují tvoji AI hybridní agenti?', graph);
  assert.ok(reply);
  assert.match(reply, /Vývoj AI Hybridních Agentů/i);
  assert.match(reply, /hybridní agenty/i);
});

test('Lukas NLG Engine: provides empathetic fallback instead of unknown or error', () => {
  const graph = buildLukasKnowledgeGraph(snapshot);
  const reply = synthesizeLukasDialogue('Jaké je počasí na Marsu?', graph, { isFallback: true });
  assert.ok(reply);
  assert.match(reply, /AI Hybridní Agent/i);
  assert.match(reply, /nemám v ověřeném přehledu přímou odpověď/i);
  assert.match(reply, /portfoli/i);
});
