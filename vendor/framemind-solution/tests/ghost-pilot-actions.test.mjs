import assert from 'node:assert/strict';
import test from 'node:test';
import {
  InPageActionDispatcher,
  InterruptWatcher,
  PendingActionCoordinator,
  collectDomInteractiveTargets,
  findInteractiveTargetIntent,
  hasExplicitUiActionIntent,
} from '../dist/index.js';

function createMockDom() {
  const elementsById = new Map();
  const selectorMap = new Map();
  const windowListeners = new Map();
  const storageMap = new Map();

  class MockCustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
      this.bubbles = Boolean(init.bubbles);
    }
  }

  function makeElement(tagName, attrs = {}, textContent = '') {
    const classes = new Set();
    const events = [];
    const el = {
      tagName: tagName.toUpperCase(),
      id: attrs.id || '',
      textContent,
      value: attrs.value || '',
      open: Boolean(attrs.open),
      clicked: 0,
      focused: false,
      scrolled: false,
      parentElement: null,
      events,
      classList: {
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
        contains: (c) => classes.has(c),
      },
      getAttribute: (k) => (k in attrs ? attrs[k] : null),
      scrollIntoView: () => {
        el.scrolled = true;
      },
      click: () => {
        el.clicked += 1;
      },
      focus: () => {
        el.focused = true;
      },
      dispatchEvent: (evt) => {
        events.push(evt.type);
        return true;
      },
      closest: (sel) => {
        if (sel === 'details' && el.parentElement?.tagName === 'DETAILS') return el.parentElement;
        if (sel.includes('[data-chat-panel]') && attrs['data-chat-panel']) return el;
        return null;
      },
      querySelector: (sel) => el._childQuery?.(sel) ?? null,
    };
    if (el.id) elementsById.set(el.id, el);
    return el;
  }

  const mockWindow = {
    CustomEvent: MockCustomEvent,
    scrollY: 0,
    scrollTo: () => {},
    addEventListener: (event, fn) => {
      const list = windowListeners.get(event) || [];
      list.push(fn);
      windowListeners.set(event, list);
    },
    removeEventListener: (event, fn) => {
      const list = windowListeners.get(event) || [];
      windowListeners.set(
        event,
        list.filter((item) => item !== fn),
      );
    },
    emit: (event, target) => {
      const list = [...(windowListeners.get(event) || [])];
      for (const fn of list) fn({ type: event, target });
    },
  };

  const mockStorage = {
    getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
  };

  const mockDocument = {
    defaultView: mockWindow,
    getElementById: (id) => elementsById.get(id) || null,
    querySelector: (sel) => {
      if (sel.startsWith('#')) return elementsById.get(sel.slice(1)) || null;
      return selectorMap.get(sel) || null;
    },
    querySelectorAll: (sel) => selectorMap.get(`all:${sel}`) || [],
    dispatchEvent: () => true,
  };

  mockWindow.document = mockDocument;

  return {
    scope: { window: mockWindow, document: mockDocument, sessionStorage: mockStorage },
    makeElement,
    selectorMap,
    mockWindow,
    mockStorage,
  };
}

test('GhostPilot 2.0: clickElement clicks tabs/buttons and opens <details> accordions', () => {
  const { scope, makeElement, selectorMap } = createMockDom();
  const dispatcher = new InPageActionDispatcher();

  const tabBtn = makeElement('button', { id: 'tab-voice', 'data-tab': 'voice' }, 'Voice & Actions');
  selectorMap.set('[data-tab="voice"]', tabBtn);

  const detailsEl = makeElement('details', { id: 'faq-price', open: false });
  const summaryEl = makeElement('summary', { id: 'faq-price-summary' }, 'Kolik stojí provoz?');
  summaryEl.parentElement = detailsEl;

  const clickedTab = dispatcher.dispatchAction(
    { id: 'act-1', tool: 'switch_tab', args: { selector: '[data-tab="voice"]' } },
    scope,
  );
  assert.equal(clickedTab, true);
  assert.equal(tabBtn.clicked, 1);
  assert.equal(tabBtn.scrolled, true);
  assert.equal(tabBtn.classList.contains('fm-highlight-pulse'), true);

  const openedFaq = dispatcher.dispatchAction(
    { id: 'act-2', tool: 'open_accordion', args: { target: 'faq-price-summary' } },
    scope,
  );
  assert.equal(openedFaq, true);
  assert.equal(detailsEl.open, true);

  dispatcher.cleanup(scope);
});

test('GhostPilot 2.0: fillField sets input value, dispatches input/change events and highlights', () => {
  const { scope, makeElement } = createMockDom();
  const dispatcher = new InPageActionDispatcher();

  const emailInput = makeElement('input', { id: 'contact-email' });
  const ok = dispatcher.dispatchAction(
    { id: 'fill-1', tool: 'fill_field', args: { target: '#contact-email', value: 'jan@example.com' } },
    scope,
  );
  assert.equal(ok, true);
  assert.equal(emailInput.value, 'jan@example.com');
  assert.equal(emailInput.focused, true);
  assert.deepEqual(emailInput.events, ['input', 'change']);
  assert.equal(emailInput.classList.contains('fm-highlight-pulse'), true);

  dispatcher.cleanup(scope);
});

test('GhostPilot 2.0: runActionChain executes sequence and stops immediately on user interrupt outside agent UI', async () => {
  const { scope, makeElement, mockWindow } = createMockDom();
  const dispatcher = new InPageActionDispatcher();

  const sec = makeElement('section', { id: 'cenik' }, 'Ceník');
  const card = makeElement('div', { id: 'card-voice' }, 'Tarif Voice');
  const chatPanel = makeElement('div', { id: 'chat', 'data-chat-panel': '1' });

  const executed = [];
  const pointed = [];
  let interrupted = false;

  dispatcher.runActionChain(
    [
      { action: { id: 's1', tool: 'scroll_to', args: { target: 'cenik' } }, delayMs: 0, settleMs: 10 },
      { action: { id: 's2', tool: 'click_element', args: { target: 'card-voice' } }, delayMs: 50, settleMs: 10 },
    ],
    {
      scope,
      onStep: (step) => executed.push(step.action.id),
      onPointTarget: (el, step) => pointed.push(step.action.id),
      onInterrupted: () => {
        interrupted = true;
      },
    },
  );

  await new Promise((r) => setTimeout(r, 25));
  assert.deepEqual(executed, ['s1']);
  assert.deepEqual(pointed, ['s1']);

  // Clicking inside agent UI must NOT interrupt the chain
  mockWindow.emit('pointerdown', chatPanel);
  assert.equal(interrupted, false);

  // User scrolling wheel on page MUST interrupt before step 2
  mockWindow.emit('wheel', sec);
  assert.equal(interrupted, true);

  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(executed, ['s1']);
  assert.equal(card.clicked, 0);

  dispatcher.cleanup(scope);
});

test('GhostPilot 2.0: CrossPageActionHandoff schedules and consumes pending DOM action on target pathname', () => {
  const { scope } = createMockDom();
  const dispatcher = new InPageActionDispatcher();

  const saved = dispatcher.scheduleCrossPageAction(
    {
      targetPath: '/cenik',
      action: { id: 'h1', tool: 'highlight_element', args: { target: '#voice-tier' } },
      caption: 'Zvýrazňuji tarif Voice & Actions…',
      createdAt: 1000,
      ttlMs: 10000,
    },
    scope,
  );
  assert.equal(saved, true);

  // Wrong pathname does not consume the action
  const wrongPage = dispatcher.consumeCrossPageAction('/weby', scope, 2000);
  assert.equal(wrongPage, null);

  // Matching pathname consumes and removes the action
  const matched = dispatcher.consumeCrossPageAction('/cenik/', scope, 2000);
  assert.ok(matched);
  assert.equal(matched.action.tool, 'highlight_element');
  assert.equal(matched.action.args.target, '#voice-tier');
  assert.equal(matched.caption, 'Zvýrazňuji tarif Voice & Actions…');

  // Second call returns null (already consumed)
  assert.equal(dispatcher.consumeCrossPageAction('/cenik', scope, 2000), null);
});

test('DOM Action Graph: collectDomInteractiveTargets & findInteractiveTargetIntent match sections, tabs and accordions', () => {
  const { scope, makeElement, selectorMap } = createMockDom();

  const secPricing = makeElement('section', { id: 'pricing' });
  const h2 = makeElement('h2', {}, 'Ceník a tarify');
  secPricing._childQuery = () => h2;

  const tabAi = makeElement('button', { 'data-filter': 'ai', role: 'tab' }, 'AI Projekty');
  const faqSummary = makeElement('summary', { id: 'faq-gdpr' }, 'Ochrana soukromí a GDPR');
  const faqDetails = makeElement('details', { id: 'details-gdpr' });
  faqSummary.parentElement = faqDetails;

  selectorMap.set('all:section[id], [data-section][id]', [secPricing]);
  selectorMap.set('all:[role="tab"], [data-tab], [data-filter], [data-service]', [tabAi]);
  selectorMap.set('all:details > summary', [faqSummary]);
  selectorMap.set('all:[data-fm-action], button[id]', []);

  const targets = collectDomInteractiveTargets(scope.document);
  assert.equal(targets.length, 3);

  assert.equal(hasExplicitUiActionIntent('Přepni na AI projekty'), true);
  assert.equal(hasExplicitUiActionIntent('Klikni na ceník a tarify'), true);

  const matchedTab = findInteractiveTargetIntent('Přepni na AI projekty', targets);
  assert.ok(matchedTab);
  assert.equal(matchedTab.kind, 'tab');
  assert.equal(matchedTab.tool, 'switch_tab');
  assert.equal(matchedTab.selector, '[data-filter="ai"]');

  const matchedAccordion = findInteractiveTargetIntent('Rozbal ochranu soukromí a GDPR', targets);
  assert.ok(matchedAccordion);
  assert.equal(matchedAccordion.kind, 'accordion');
  assert.equal(matchedAccordion.tool, 'open_accordion');
  assert.equal(matchedAccordion.selector, '#details-gdpr');
});

test('PendingActionCoordinator: scheduleSequence fires actions at sentence cue-points', () => {
  const coordinator = new PendingActionCoordinator();
  const executed = [];
  let speaking = true;

  coordinator.scheduleSequence(
    [
      { action: { id: 'a0', tool: 'scroll_to', args: { target: 'produkty' } }, sentenceIndex: 0 },
      { action: { id: 'a1', tool: 'highlight_element', args: { target: 'cenik' } }, sentenceIndex: 1 },
      { action: { id: 'a2', tool: 'click_element', args: { target: 'kontakt' } }, sentenceIndex: 2, timing: 'onSpeakEnd' },
    ],
    (act) => executed.push(act.id),
    () => speaking,
  );

  assert.equal(coordinator.isPending(), true);
  coordinator.notifySpeakStart();
  assert.deepEqual(executed, ['a0']);

  coordinator.notifyCuePoint(1);
  assert.deepEqual(executed, ['a0', 'a1']);

  speaking = false;
  coordinator.notifySpeakEnd();
  assert.deepEqual(executed, ['a0', 'a1', 'a2']);
  assert.equal(coordinator.isPending(), false);
});
