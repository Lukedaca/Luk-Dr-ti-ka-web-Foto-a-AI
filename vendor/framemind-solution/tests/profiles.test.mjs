import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defineAgentProfile,
  findProfileSection,
  validateProfileIntegrity,
  extractProfileSiteLinks,
  createSportsClubProfile,
  createAgencySaasProfile,
  createPersonalPortfolioProfile,
} from '../dist/index.js';

test('Agent Profiles: doménové profily mají striktně oddělené sekce a účel', () => {
  const sports = createSportsClubProfile();
  const agency = createAgencySaasProfile();
  const portfolio = createPersonalPortfolioProfile();

  assert.equal(sports.domain, 'sports-club');
  assert.equal(agency.domain, 'agency-saas');
  assert.equal(portfolio.domain, 'personal-portfolio');

  // Sportovní agent má klubové sekce
  const sportsSectionIds = sports.sections.map((s) => s.id);
  assert.ok(sportsSectionIds.includes('tymy'));
  assert.ok(sportsSectionIds.includes('nabor'));
  assert.ok(sportsSectionIds.includes('treninky'));
  assert.ok(!sportsSectionIds.includes('photo')); // Žádné míchání s SaaS

  // Agency agent má SaaS a vývojové sekce
  const agencySectionIds = agency.sections.map((s) => s.id);
  assert.ok(agencySectionIds.includes('weby'));
  assert.ok(agencySectionIds.includes('cenik'));
  assert.ok(agencySectionIds.includes('photo'));
  assert.ok(!agencySectionIds.includes('nabor')); // Žádné míchání s klubem

  // Portfolio agent má sekce fotografa a AI tvůrce
  const portfolioSectionIds = portfolio.sections.map((s) => s.id);
  assert.ok(portfolioSectionIds.includes('portfolio'));
  assert.ok(portfolioSectionIds.includes('skills'));
  assert.ok(portfolioSectionIds.includes('o-mne'));
  assert.ok(portfolioSectionIds.includes('spoluprace'));
  assert.ok(portfolioSectionIds.includes('kontakt'));
});

test('Agent Profiles: validace integrity profilu detekuje duplicity', () => {
  const valid = createAgencySaasProfile();
  const checkValid = validateProfileIntegrity(valid);
  assert.equal(checkValid.valid, true);
  assert.equal(checkValid.errors.length, 0);

  const broken = defineAgentProfile({
    id: 'broken-agent',
    name: 'Broken',
    domain: 'custom',
    version: '1.0.0',
    sections: [
      { id: 'dup', label: 'Dup 1', type: 'page', target: '/dup1' },
      { id: 'dup', label: 'Dup 2', type: 'page', target: '/dup2' },
    ],
    capabilities: [],
  });
  const checkBroken = validateProfileIntegrity(broken);
  assert.equal(checkBroken.valid, false);
  assert.match(checkBroken.errors[0], /Duplicate section id: dup/);
});

test('Agent Profiles: vyhledání sekce v profilu funguje přes id, název i aliasy', () => {
  const portfolio = createPersonalPortfolioProfile();

  const sec1 = findProfileSection(portfolio, 'portfolio');
  assert.ok(sec1);
  assert.equal(sec1.id, 'portfolio');

  const sec2 = findProfileSection(portfolio, 'fotky'); // alias
  assert.ok(sec2);
  assert.equal(sec2.id, 'portfolio');

  const sec3 = findProfileSection(portfolio, 'Ceník focení a služeb'); // label
  assert.ok(sec3);
  assert.equal(sec3.id, 'pricing');

  const secNotFound = findProfileSection(portfolio, 'nabor'); // cizí doména
  assert.equal(secNotFound, null);
});

test('Agent Profiles: extractProfileSiteLinks generuje validní odkazy pro navigaci', () => {
  const agency = createAgencySaasProfile();
  const links = extractProfileSiteLinks(agency);
  assert.ok(links.length >= 6);
  assert.equal(links[0].label, 'Webové stránky');
  assert.equal(links[0].path, '/weby');
});
