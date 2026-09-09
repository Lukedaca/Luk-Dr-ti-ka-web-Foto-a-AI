import assert from 'node:assert/strict';
import test from 'node:test';
import {
  InPageActionDispatcher,
  PendingActionCoordinator,
} from '../dist/index.js';

test('InPageActionDispatcher handles environments without DOM gracefully', () => {
  const dispatcher = new InPageActionDispatcher();
  const emptyScope = {};

  assert.equal(dispatcher.findTargetElement('#pricing', emptyScope), null);
  assert.equal(dispatcher.highlightElement('#pricing', {}, emptyScope), false);
  assert.equal(dispatcher.scrollTo(500, {}, emptyScope), false);
  assert.equal(dispatcher.dispatchCustomEvent('test:event', {}, undefined, emptyScope), false);
  assert.equal(dispatcher.dispatchAction({ id: 'a1', tool: 'scroll_to', args: { target: '#hero' } }, emptyScope), false);
});

test('InPageActionDispatcher safely finds elements and rejects invalid selectors', () => {
  const dispatcher = new InPageActionDispatcher();

  const mockElem = { id: 'pricing-table', classList: { add() {}, remove() {} } };
  const mockDoc = {
    getElementById(id) {
      return id === 'pricing-table' ? mockElem : null;
    },
    querySelector(sel) {
      return sel === '.pricing-card' ? mockElem : null;
    },
  };
  const mockScope = { document: mockDoc };

  assert.equal(dispatcher.findTargetElement('pricing-table', mockScope), mockElem);
  assert.equal(dispatcher.findTargetElement('#pricing-table', mockScope), mockElem);
  assert.equal(dispatcher.findTargetElement('.pricing-card', mockScope), mockElem);

  // Malicious or broken selectors must be safely rejected without calling querySelector
  assert.equal(dispatcher.findTargetElement('<script>alert(1)</script>', mockScope), null);
  assert.equal(dispatcher.findTargetElement('body{background:red}', mockScope), null);
});

test('InPageActionDispatcher highlights element and schedules cleanup', async () => {
  const dispatcher = new InPageActionDispatcher();

  const classes = new Set();
  let scrolled = false;
  const mockElem = {
    id: 'contact',
    classList: {
      add(cls) { classes.add(cls); },
      remove(cls) { classes.delete(cls); },
    },
    scrollIntoView() { scrolled = true; },
  };

  const mockScope = {
    document: {
      getElementById(id) { return id === 'contact' ? mockElem : null; },
    },
  };

  const res = dispatcher.highlightElement('contact', { durationMs: 50, pulseClass: 'pulse-active' }, mockScope);
  assert.equal(res, true);
  assert.equal(scrolled, true);
  assert.equal(classes.has('pulse-active'), true);

  // Wait for auto cleanup timer
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(classes.has('pulse-active'), false);
});

test('InPageActionDispatcher dispatches custom events and actions', () => {
  const dispatcher = new InPageActionDispatcher();

  let receivedEvent = null;
  const mockWindow = {
    CustomEvent: class {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
    dispatchEvent(evt) {
      receivedEvent = evt;
      return true;
    },
  };
  const mockScope = { window: mockWindow };

  const success = dispatcher.dispatchAction(
    { id: 'act-filter', tool: 'filter_gallery', args: { category: 'portraits' } },
    mockScope,
  );

  assert.equal(success, true);
  assert.equal(receivedEvent?.type, 'framemind:action:filter_gallery');
  assert.deepEqual(receivedEvent?.detail, { category: 'portraits' });
});

test('PendingActionCoordinator coordinates actions with TTS lifecycle', () => {
  const coordinator = new PendingActionCoordinator();

  let executed = null;
  let voiceSpeaking = true;

  // 1. Schedule onSpeakEnd
  coordinator.schedule(
    { id: 'nav-1', tool: 'navigate', args: { path: '/cenik' } },
    (action) => { executed = action; },
    () => voiceSpeaking,
    { timing: 'onSpeakEnd' },
  );

  assert.equal(coordinator.isPending(), true);
  assert.equal(executed, null);

  // Speaking starts - should NOT execute yet
  coordinator.notifySpeakStart();
  assert.equal(executed, null);

  // Speaking ends - should execute
  voiceSpeaking = false;
  const flushed = coordinator.notifySpeakEnd();
  assert.equal(flushed, true);
  assert.equal(coordinator.isPending(), false);
  assert.equal(executed?.args?.path, '/cenik');
});

test('PendingActionCoordinator executes onSpeakStart', () => {
  const coordinator = new PendingActionCoordinator();

  let executed = null;
  let voiceSpeaking = true;

  coordinator.schedule(
    { id: 'highlight-1', tool: 'highlight_element', args: { selector: '#hero' } },
    (action) => { executed = action; },
    () => voiceSpeaking,
    { timing: 'onSpeakStart' },
  );

  assert.equal(coordinator.isPending(), true);
  assert.equal(executed, null);

  const flushed = coordinator.notifySpeakStart();
  assert.equal(flushed, true);
  assert.equal(executed?.tool, 'highlight_element');
  assert.equal(coordinator.isPending(), false);
});

test('PendingActionCoordinator cancels scheduled actions', () => {
  const coordinator = new PendingActionCoordinator();

  let executed = null;
  coordinator.schedule(
    { id: 'act-cancel', tool: 'navigate', args: { path: '/kontakty' } },
    (action) => { executed = action; },
    () => true,
  );

  assert.equal(coordinator.isPending(), true);
  coordinator.cancel();
  assert.equal(coordinator.isPending(), false);

  coordinator.notifySpeakEnd();
  assert.equal(executed, null);
});
