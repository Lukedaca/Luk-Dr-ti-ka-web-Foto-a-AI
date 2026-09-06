import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLukasDiscourseContext,
  handleConversationalRepair,
  ENTITY_TYPES,
} from '../src/js/lukas-discourse-context.mjs';

test('LukasConversationalRepair: correctly switches context to sports', () => {
  const ctx = createLukasDiscourseContext();
  ctx.setEntity(ENTITY_TYPES.SERVICE_PORTRAITS, 'Portrétní fotografie', { category: 'portraits' });

  const repair = handleConversationalRepair('Ne, myslel jsem fotbal', ctx);
  assert.ok(repair.handled);
  assert.equal(repair.intent, 'repair_sports');
  assert.equal(ctx.activeEntity.type, ENTITY_TYPES.SERVICE_SPORTS);
  assert.match(repair.text, /sportovní fotografii/i);
});

test('LukasConversationalRepair: correctly switches context to portraits', () => {
  const ctx = createLukasDiscourseContext();
  ctx.setEntity(ENTITY_TYPES.SERVICE_SPORTS, 'Sportovní fotografie', { category: 'sports' });

  const repair = handleConversationalRepair('Vlastně portréty', ctx);
  assert.ok(repair.handled);
  assert.equal(repair.intent, 'repair_portraits');
  assert.equal(ctx.activeEntity.type, ENTITY_TYPES.SERVICE_PORTRAITS);
  assert.match(repair.text, /portrétní focení/i);
});

test('LukasConversationalRepair: correctly switches context to AI agents', () => {
  const ctx = createLukasDiscourseContext();
  ctx.setEntity(ENTITY_TYPES.SERVICE_SPORTS, 'Sportovní fotografie', { category: 'sports' });

  const repair = handleConversationalRepair('Ne, chtěl jsem agenta', ctx);
  assert.ok(repair.handled);
  assert.equal(repair.intent, 'repair_agents');
  assert.equal(ctx.activeEntity.type, ENTITY_TYPES.SERVICE_AI_AGENTS);
  assert.match(repair.text, /AI Hybridní Agenty/i);
});

test('LukasConversationalRepair: correctly switches context to contact', () => {
  const ctx = createLukasDiscourseContext();
  const repair = handleConversationalRepair('Vlastně kontakt', ctx);
  assert.ok(repair.handled);
  assert.equal(repair.intent, 'repair_contact');
  assert.equal(ctx.activeEntity.type, ENTITY_TYPES.CONTACT);
  assert.match(repair.text, /721 624 429/);
});
