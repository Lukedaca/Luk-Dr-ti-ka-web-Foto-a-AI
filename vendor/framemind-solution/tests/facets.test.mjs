import assert from 'node:assert/strict';
import test from 'node:test';
import { pickFacet, ResponseComposer } from '../dist/index.js';

// 1.3.0 — odpověď k tomu, na co se návštěvník ptá. „Kdy je školička?“ vracelo celý
// záznam (věk, oblečení, kontakt, výzvu k náboru) a „A kde?“ propadlo na fallback.

const facets = [
  { id: 'when', keywords: ['kdy', 'v kolik'], template: 'W' },
  { id: 'where', keywords: ['kde', 'kam'], template: 'P' },
  { id: 'bring', keywords: ['s sebou', 'obleceni'], template: 'B' },
];

test('jeden aspekt vybere jeho šablonu', () => {
  assert.equal(pickFacet(facets, 'A kde to je?')?.id, 'where');
  assert.equal(pickFacet(facets, 'Co si vzít s sebou?')?.id, 'bring');
  assert.equal(pickFacet(facets, 'Jaké oblečení?')?.id, 'bring');
});

test('víc aspektů nebo žádný = bez aspektu', () => {
  assert.equal(pickFacet(facets, 'Kdy a kde je školička?'), undefined);
  assert.equal(pickFacet(facets, 'Školička'), undefined);
});

test('celá slova, ne podřetězce', () => {
  assert.equal(pickFacet(facets, 'kdykoliv'), undefined);
});

test('bez facets nic', () => {
  assert.equal(pickFacet(undefined, 'kde'), undefined);
  assert.equal(pickFacet([], 'kde'), undefined);
});

test('výčet s listConjunction, bez něj beze změny', () => {
  const composer = new ResponseComposer();
  const context = { slots: { days: ['pondělí', 'středa', 'čtvrtek'], one: ['pondělí'] } };
  assert.equal(composer.compose('{{days}}', undefined, context), 'pondělí,středa,čtvrtek');
  assert.equal(composer.compose('{{days}}', undefined, context, undefined, '', 'a'), 'pondělí, středa a čtvrtek');
  assert.equal(composer.compose('{{one}}', undefined, context, undefined, '', 'a'), 'pondělí');
});

test('2.0.0: pole objektů v šabloně a odstranění zdvojené tečky za zkratkou', () => {
  const composer = new ResponseComposer();
  const record = {
    id: 'partners',
    type: 'partners',
    content: '',
    sourceUrl: 'https://club.example',
    contentHash: 'x',
    fetchedAt: '2026-10-12T00:00:00Z',
    lastVerifiedAt: '2026-10-12T00:00:00Z',
    expiresAt: '2026-12-31T00:00:00Z',
    data: {
      address: 'Sokolská ul.',
      partners: [
        { name: 'Olomoucký kraj', url: 'https://olkraj.cz' },
        { name: 'Město Přerov', url: 'https://prerov.eu' },
        { name: 'FAČR', url: 'https://fotbal.cz' },
      ],
    },
  };
  assert.equal(
    composer.compose('Partnery jsou {{partners.name}} na {{address}}.', record, { slots: {} }, undefined, '', 'a'),
    'Partnery jsou Olomoucký kraj, Město Přerov a FAČR na Sokolská ul.',
  );
  assert.equal(
    composer.compose('Partnery jsou {{partners}}...', record, { slots: {} }, undefined, '', 'a'),
    'Partnery jsou Olomoucký kraj, Město Přerov a FAČR...',
  );
});

