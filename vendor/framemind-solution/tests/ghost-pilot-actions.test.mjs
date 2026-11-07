import assert from 'node:assert/strict';
import test from 'node:test';
import {
  InPageActionDispatcher,
  InterruptWatcher,
  PendingActionCoordinator,
  collectDomInteractiveTargets,
  computeMinimumJerkTrajectoryPoint,
  findInteractiveTargetIntent,
  foldDeicticText,
  hasExplicitUiActionIntent,
  minimumJerkProgress,
  minimumJerkVelocityFactor,
} from '../dist/index.js';

function createMockDom() {
  const elementsById = new Map();
  const selectorMap = new Map();
  const windowListeners = new Map();
  const storageMap = new Map();
  const cssHighlights = new Map();
  const textNodes = [];

  class MockCustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
      this.bubbles = Boolean(init.bubbles);
    }
  }

  class MockRange {
    constructor() {
      this.startNode = null;
      this.startOffset = 0;
      this.endNode = null;
      this.endOffset = 0;
    }
    setStart(node, offset) {
      this.startNode = node;
      this.startOffset = offset;
    }
    setEnd(node, offset) {
      this.endNode = node;
      this.endOffset = offset;
    }
  }

  class MockHighlight {
    constructor(...ranges) {
      this.ranges = ranges;
    }
  }

  function makeElement(tagName, attrs = {}, textContent = '') {
    const classes = new Set();
    const events = [];
    const attrStore = { ...attrs };
    let rect = attrs.rect || { left: 100, top: 200, width: 160, height: 48, right: 260, bottom: 248 };
    const el = {
      tagName: tagName.toUpperCase(),
      id: attrStore.id || '',
      textContent,
      value: attrStore.value || '',
      open: Boolean(attrStore.open),
      hidden: Boolean(attrStore.hidden),
      clicked: 0,
      focused: false,
      scrolled: false,
      parentElement: null,
      style: {},
      events,
      setRect: (nextRect) => {
        rect = {
          ...nextRect,
          right: nextRect.right ?? (nextRect.left + nextRect.width),
          bottom: nextRect.bottom ?? (nextRect.top + nextRect.height),
        };
      },
      getBoundingClientRect: () => rect,
      classList: {
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
        contains: (c) => classes.has(c),
      },
      getAttribute: (k) => (k in attrStore ? String(attrStore[k]) : null),
      setAttribute: (k, v) => {
        attrStore[k] = String(v);
        if (k === 'id') {
          el.id = String(v);
          elementsById.set(el.id, el);
        }
        if (k === 'open') el.open = true;
      },
      removeAttribute: (k) => {
        delete attrStore[k];
        if (k === 'hidden') el.hidden = false;
      },
      scrollIntoView: () => {
        el.scrolled = true;
      },
      click: () => {
        el.clicked += 1;
        if (typeof el.onClick === 'function') el.onClick();
      },
      focus: () => {
        el.focused = true;
      },
      remove: () => {
        if (el.id) elementsById.delete(el.id);
      },
      dispatchEvent: (evt) => {
        events.push(evt.type);
        return true;
      },
      closest: (sel) => {
        let cur = el;
        while (cur) {
          if (sel === 'details' && cur.tagName === 'DETAILS') return cur;
          if (sel.includes('[data-chat-panel]') && cur.getAttribute?.('data-chat-panel')) return cur;
          if (sel.includes('td, th, li, p') && (cur.tagName === 'P' || cur.tagName === 'LI' || cur.tagName === 'TD')) return cur;
          if (sel.includes('article, tr, details') && (cur.tagName === 'SECTION' || cur.tagName === 'ARTICLE' || cur.tagName === 'DETAILS')) return cur;
          cur = cur.parentElement;
        }
        return null;
      },
      querySelector: (sel) => el._childQuery?.(sel) ?? null,
    };
    if (el.id) elementsById.set(el.id, el);
    return el;
  }

  function addTextNode(parentElement, nodeValue) {
    const node = {
      nodeType: 3,
      nodeValue,
      parentElement,
    };
    textNodes.push(node);
    return node;
  }

  const mockWindow = {
    CustomEvent: MockCustomEvent,
    Highlight: MockHighlight,
    CSS: { highlights: cssHighlights },
    innerWidth: 1280,
    innerHeight: 800,
    scrollY: 0,
    scrollTo: () => {},
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', position: 'relative' }),
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

  const bodyEl = makeElement('body', { id: 'body' });
  bodyEl.appendChild = (child) => {
    child.parentElement = bodyEl;
    if (child.id) elementsById.set(child.id, child);
    return child;
  };

  const mockDocument = {
    defaultView: mockWindow,
    body: bodyEl,
    createElement: (tag) => makeElement(tag),
    createRange: () => new MockRange(),
    createTreeWalker: () => {
      let idx = -1;
      return {
        nextNode: () => {
          idx += 1;
          return idx < textNodes.length ? textNodes[idx] : null;
        },
      };
    },
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
    addTextNode,
    selectorMap,
    cssHighlights,
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

test('v2.8.0 Minimum-Jerk Trajectory: Flash & Hogan (1985) 5th-order polynomial and perpendicular arc', () => {
  assert.equal(minimumJerkProgress(0), 0);
  assert.equal(minimumJerkProgress(1), 1);
  assert.ok(Math.abs(minimumJerkProgress(0.5) - 0.5) < 1e-9);

  // Bell-shaped velocity profile peaks at tau = 0.5 (1.875x mean speed) and is zero at boundaries
  assert.equal(minimumJerkVelocityFactor(0), 0);
  assert.equal(minimumJerkVelocityFactor(1), 0);
  assert.ok(Math.abs(minimumJerkVelocityFactor(0.5) - 1.875) < 1e-9);

  const start = computeMinimumJerkTrajectoryPoint(0, 0, 400, 0, 0, 0.08);
  const mid = computeMinimumJerkTrajectoryPoint(0, 0, 400, 0, 0.5, 0.08);
  const end = computeMinimumJerkTrajectoryPoint(0, 0, 400, 0, 1, 0.08);

  assert.equal(start.x, 0);
  assert.equal(start.y, 0);
  assert.ok(Math.abs(mid.x - 200) < 1e-6);
  // Perpendicular arc offset should be non-zero at midpoint
  assert.ok(Math.abs(mid.y) > 10);
  assert.equal(end.x, 400);
  assert.ok(Math.abs(end.y) < 1e-6);
});

test('v2.8.0 Causal Ancestor Unfolder: unfolds closed <details> and hidden [role="tabpanel"] before interaction', () => {
  const { scope, makeElement, selectorMap } = createMockDom();
  const dispatcher = new InPageActionDispatcher();

  const tabController = makeElement('button', { id: 'tab-enterprise', role: 'tab', 'aria-controls': 'panel-enterprise', 'aria-selected': 'false' });
  const tabPanel = makeElement('div', { id: 'panel-enterprise', role: 'tabpanel', hidden: true });
  tabController.onClick = () => {
    tabPanel.hidden = false;
    tabPanel.removeAttribute('hidden');
  };
  selectorMap.set('[role="tab"][aria-controls="panel-enterprise"]', tabController);

  const detailsEl = makeElement('details', { id: 'faq-sla', open: false });
  detailsEl.parentElement = tabPanel;
  const innerBtn = makeElement('button', { id: 'btn-sla-download' }, 'Stáhnout SLA');
  innerBtn.parentElement = detailsEl;

  const unfoldRes = dispatcher.unfoldAncestors(innerBtn, scope);
  assert.equal(unfoldRes.unfolded, true);
  assert.equal(unfoldRes.steps.length, 2);
  assert.equal(detailsEl.open, true);
  assert.equal(tabController.clicked, 1);
  assert.equal(tabPanel.hidden, false);
});

test('v2.8.0 Deictic Sub-Node Highlighter: 3-tier DOM Range + sub-element + container highlight with auto-unfold', () => {
  const { scope, makeElement, addTextNode, cssHighlights } = createMockDom();
  const dispatcher = new InPageActionDispatcher();

  const faqDetails = makeElement('details', { id: 'faq-voice-price', open: false });
  const paragraph = makeElement('p', { id: 'p-voice' });
  paragraph.parentElement = faqDetails;
  addTextNode(paragraph, 'Tarif Voice & Actions stojí 6 900 Kč jednorázově a zahrnuje hlas Sulafat.');

  assert.equal(foldDeicticText('6 900 Kč jednorázově'), '6 900 kc jednorazove');

  const match = dispatcher.groundEvidenceInDom(
    'Odpověď: Tarif Voice & Actions stojí 6 900 Kč jednorázově a zahrnuje hlas Sulafat.',
    { highlightName: 'framemind-source' },
    scope,
  );

  assert.ok(match);
  assert.equal(faqDetails.open, true, 'Closed <details> must be automatically unfolded to reveal text');
  assert.equal(paragraph.classList.contains('fm-deictic-subelement'), true, 'Tier 2 sub-element highlight applied');
  assert.equal(faqDetails.classList.contains('fm-highlight-pulse'), true, 'Tier 3 container pulse applied');
  assert.equal(cssHighlights.has('framemind-source'), true, 'Tier 1 CSS Custom Highlight API range registered');

  dispatcher.cleanup(scope);
  assert.equal(paragraph.classList.contains('fm-deictic-subelement'), false);
  assert.equal(cssHighlights.has('framemind-source'), false);
});

test('v2.8.0 Closed-Loop Homing Lock: tracks moving BoundingClientRect during scroll and locks only when settled', async () => {
  const { scope, makeElement } = createMockDom();
  const dispatcher = new InPageActionDispatcher();

  const ctaBtn = makeElement('button', {
    id: 'cta-pilot',
    rect: { left: 200, top: 680, width: 180, height: 48 },
  }, 'Spustit pilot');

  // Simulate layout shift / smooth scroll settling over time
  setTimeout(() => ctaBtn.setRect({ left: 200, top: 420, width: 180, height: 48 }), 15);
  setTimeout(() => ctaBtn.setRect({ left: 200, top: 300, width: 180, height: 48 }), 35);

  const frames = [];
  let lockedPoint = null;

  await new Promise((resolve) => {
    dispatcher.homingLockToElement(
      '#cta-pilot',
      {
        startX: 40,
        startY: 40,
        durationMs: 70,
        frameIntervalMs: 15,
        clickOnLock: true,
        calloutLabel: 'Klikám na Spustit pilot',
        onFrame: (pt) => frames.push(pt),
        onLock: (pt) => {
          lockedPoint = pt;
          resolve();
        },
      },
      scope,
    );
  });

  assert.ok(frames.length >= 3);
  assert.ok(lockedPoint);
  // Final locked Y must match the settled rect center (top 300 + height 48 / 2 = 324)
  assert.equal(lockedPoint.x, 290);
  assert.equal(lockedPoint.y, 324);
  assert.equal(ctaBtn.clicked, 1);

  const callout = scope.document.getElementById('fm-foveal-callout');
  assert.ok(callout);
  assert.equal(callout.textContent, 'Klikám na Spustit pilot');
  assert.equal(callout.getAttribute('data-placement'), 'top');

  dispatcher.cleanup(scope);
});

test('v2.8.0 Foveal Callout & Comparative Multi-Highlight: flips callout near top edge and shifts ①/② focus', () => {
  const { scope, makeElement } = createMockDom();
  const dispatcher = new InPageActionDispatcher();

  const topHeaderCard = makeElement('div', {
    id: 'card-chat',
    rect: { left: 80, top: 18, width: 220, height: 120 },
  }, 'Tarif Chat');
  const secondCard = makeElement('div', {
    id: 'card-voice',
    rect: { left: 360, top: 220, width: 220, height: 120 },
  }, 'Tarif Voice & Actions');

  // Near top edge (top: 18 < 52), callout must flip to bottom placement
  const callout = dispatcher.showFovealCallout(topHeaderCard, { label: 'Srovnání tarifů', durationMs: 0 }, scope);
  assert.ok(callout);
  assert.equal(callout.getAttribute('data-placement'), 'bottom');

  const handle = dispatcher.compareElements(
    [
      { selector: '#card-chat', label: 'Tarif Chat' },
      { selector: '#card-voice', label: 'Tarif Voice' },
    ],
    { durationMs: 0 },
    scope,
  );

  assert.ok(handle);
  assert.equal(handle.items.length, 2);
  assert.equal(topHeaderCard.getAttribute('data-fm-compare-badge'), '①');
  assert.equal(secondCard.getAttribute('data-fm-compare-badge'), '②');
  assert.equal(topHeaderCard.classList.contains('fm-compare-active'), true);
  assert.equal(secondCard.classList.contains('fm-compare-standby'), true);

  // Shift focus to second item on voice cue-point
  const shifted = handle.focusItem(1);
  assert.ok(shifted);
  assert.equal(topHeaderCard.classList.contains('fm-compare-standby'), true);
  assert.equal(secondCard.classList.contains('fm-compare-active'), true);

  handle.clear();
  assert.equal(topHeaderCard.getAttribute('data-fm-compare-badge'), null);
  assert.equal(secondCard.getAttribute('data-fm-compare-badge'), null);
  dispatcher.cleanup(scope);
});

