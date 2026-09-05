import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeNavTarget,
  sanitizeNavLinks,
  normalizeNavText,
  hasExplicitUiActionIntent,
  findSiteLinkIntent,
  findSiteMenuIntent,
  collectDomSiteLinks,
  collectDomSiteMenus,
  PendingNavigationManager,
} from '../dist/index.js';

const sampleLinks = sanitizeNavLinks([
  { label: 'Eshop', path: 'https://eos.fcprerov.cz/public-store/1' },
  { label: 'Galerie', path: '/galerie' },
  { label: 'Program zápasů', path: '/program-zapasu' },
  { label: 'U-10', path: '/tym/510-u-10' },
  { label: 'Kontakty', path: '/kontakty' },
  { label: 'Ceník', path: '/cenik' },
  { label: 'Weby', path: '/weby' },
], 50, (p) => normalizeNavTarget(p, 'https://www.fcprerov.cz', 'fcprerov.cz'));

test('normalizeNavTarget handles apex, relative paths and security', () => {
  assert.equal(normalizeNavTarget('/galerie'), '/galerie');
  assert.equal(normalizeNavTarget('/cenik'), '/cenik');
  assert.equal(normalizeNavTarget('https://www.fcprerov.cz/program-zapasu', 'https://www.fcprerov.cz', 'fcprerov.cz'), '/program-zapasu');
  assert.equal(normalizeNavTarget('https://eos.fcprerov.cz/public-store/1', 'https://www.fcprerov.cz', 'fcprerov.cz'), 'https://eos.fcprerov.cz/public-store/1');
  assert.equal(normalizeNavTarget('javascript:alert(1)'), null);
  assert.equal(normalizeNavTarget('http://eos.fcprerov.cz/public-store/1', 'https://www.fcprerov.cz', 'fcprerov.cz'), null);
  assert.equal(normalizeNavTarget('https://evil.example.com/phish', 'https://www.fcprerov.cz', 'fcprerov.cz'), null);
  assert.equal(normalizeNavTarget('/../secret'), null);
});

test('hasExplicitUiActionIntent detects navigation intent and ignores passive questions', () => {
  assert.equal(hasExplicitUiActionIntent('otevři ceník'), true);
  assert.equal(hasExplicitUiActionIntent('ukaž mi nabídku webů'), true);
  assert.equal(hasExplicitUiActionIntent('přejdi na kontakty'), true);
  assert.equal(hasExplicitUiActionIntent('chci vidět galerii'), true);
  assert.equal(hasExplicitUiActionIntent('prosím najdi fotky ze svatby'), true);
  assert.equal(hasExplicitUiActionIntent('zobraz program zápasů'), true);
  assert.equal(hasExplicitUiActionIntent('rozbal nabídku služeb'), true);

  assert.equal(hasExplicitUiActionIntent('kdy a kde trénujete?'), false);
  assert.equal(hasExplicitUiActionIntent('jak se dnes máš?'), false);
  assert.equal(hasExplicitUiActionIntent('kolik je hodin?'), false);
  assert.equal(hasExplicitUiActionIntent('je mu sedm let'), false);
});

test('findSiteLinkIntent correctly resolves matching site links', () => {
  assert.deepEqual(findSiteLinkIntent('otevři mi e-shop', sampleLinks), sampleLinks[0]);
  assert.deepEqual(findSiteLinkIntent('ukaž fanshop', sampleLinks), sampleLinks[0]);
  assert.deepEqual(findSiteLinkIntent('zobraz galerii', sampleLinks), sampleLinks[1]);
  assert.deepEqual(findSiteLinkIntent('ukaž fotky', sampleLinks), sampleLinks[1]);
  assert.deepEqual(findSiteLinkIntent('ukaž program zápasů', sampleLinks), sampleLinks[2]);
  assert.deepEqual(findSiteLinkIntent('přejdi na kontakty', sampleLinks), sampleLinks[4]);
  assert.deepEqual(findSiteLinkIntent('kolik to stojí, otevři ceník', sampleLinks), sampleLinks[5]);
  assert.deepEqual(findSiteLinkIntent('chci vidět weby', sampleLinks), sampleLinks[6]);

  assert.equal(findSiteLinkIntent('chci recept na palačinky', sampleLinks), null);
});

test('findSiteMenuIntent matches dropdown menus and prevents accidental trigger on broad questions', () => {
  const sampleMenus = [
    {
      label: 'Služby',
      links: [
        { label: 'Tvorba webů', path: '/weby' },
        { label: 'Hybridní agenti', path: '/produkty/hybridni-agent' },
      ],
    },
    {
      label: 'Klub',
      links: [
        { label: 'O klubu', path: '/o-klubu' },
        { label: 'Trenéři', path: '/treneri' },
      ],
    },
  ];

  assert.deepEqual(findSiteMenuIntent('otevři nabídku Služby', sampleMenus), sampleMenus[0]);
  assert.deepEqual(findSiteMenuIntent('ukaž menu Služby', sampleMenus), sampleMenus[0]);
  assert.deepEqual(findSiteMenuIntent('otevři klub', sampleMenus), sampleMenus[1]);

  // Content questions containing the word "klub" should NOT open the menu
  assert.equal(findSiteMenuIntent('Jak přihlásím dítě do klubu?', sampleMenus), null);
  assert.equal(findSiteMenuIntent('Kdo je šéftrenérem klubu?', sampleMenus), null);
  assert.equal(findSiteMenuIntent('ukaž mi soupisku klubu', sampleMenus), null);
});

test('PendingNavigationManager handles schedule, flush and cancel', () => {
  const manager = new PendingNavigationManager();
  assert.equal(manager.isPending(), false);

  let executedAction = null;
  const action = { id: 'nav-test', tool: 'navigate', args: { path: '/cenik', label: 'Ceník' } };

  manager.schedule(action, (act) => { executedAction = act; }, () => false);
  assert.equal(manager.isPending(), true);
  assert.deepEqual(manager.getPending(), action);

  const flushed = manager.flush();
  assert.equal(flushed, true);
  assert.equal(manager.isPending(), false);
  assert.deepEqual(executedAction, action);

  // Cancellation test
  let secondExecuted = null;
  manager.schedule(action, (act) => { secondExecuted = act; }, () => false);
  assert.equal(manager.isPending(), true);
  manager.cancel();
  assert.equal(manager.isPending(), false);
  assert.equal(secondExecuted, null);
});

test('collectDomSiteLinks and collectDomSiteMenus work with DOM mock', () => {
  const mockDoc = {
    querySelectorAll: (selector) => {
      if (selector === 'a[href]') {
        return [
          { getAttribute: (attr) => attr === 'href' ? '/cenik' : null, textContent: 'Ceník' },
          { getAttribute: (attr) => attr === 'href' ? '/weby' : null, textContent: 'Weby' },
          { getAttribute: (attr) => attr === 'href' ? '/embed/agent' : null, textContent: 'Ignored' },
        ];
      }
      if (selector.includes('.nav-item-top')) {
        return [
          {
            textContent: 'Produkty ▼',
            closest: () => ({
              querySelectorAll: () => [
                { getAttribute: (attr) => attr === 'href' ? '/photo' : null, textContent: 'Photo AI' },
                { getAttribute: (attr) => attr === 'href' ? '/sports' : null, textContent: 'Sports' },
              ],
            }),
          },
        ];
      }
      return [];
    },
  };

  const links = collectDomSiteLinks(mockDoc);
  assert.equal(links.length, 2);
  assert.equal(links[0].label, 'Ceník');
  assert.equal(links[0].path, '/cenik');

  const menus = collectDomSiteMenus(mockDoc);
  assert.equal(menus.length, 1);
  assert.equal(menus[0].label, 'Produkty');
  assert.equal(menus[0].links.length, 2);
  assert.equal(menus[0].links[0].label, 'Photo AI');
});
