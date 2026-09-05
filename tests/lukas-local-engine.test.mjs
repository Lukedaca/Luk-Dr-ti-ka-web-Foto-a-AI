import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasExplicitUiActionIntent,
  findSiteLinkIntent,
  PendingNavigationManager,
} from '../vendor/framemind-solution/dist/index.js';
import { createLukasEngine, LUKAS_PROFILE } from '../src/config/lukas.mjs';

test('Lukáš AI Engine: fakta o Lukášovi a lokalitě jsou přesná', async () => {
  const engine = createLukasEngine();
  const res = await engine.respond({ text: 'Kdo je Lukáš Drštička?' });
  assert.equal(res.reason, 'known');
  assert.match(res.text, /Lukáš Drštička/);
  assert.match(res.text, /Přerov/);
  assert.match(res.text, /1\.\s*FC Viktorie Přerov/);
});

test('Lukáš AI Engine: sportovní fotografie a fotbal', async () => {
  const engine = createLukasEngine();
  const res = await engine.respond({ text: 'Otevři sportovní fotky' });
  assert.equal(res.reason, 'known');
  assert.match(res.text, /sportovní fotografie/i);
  assert.match(res.text, /Viktorie Přerov/i);
  assert.ok(res.actions && res.actions.length > 0);
  assert.equal(res.actions[0].tool, 'scroll_to');
  assert.equal(res.actions[0].args.section, 'portfolio');
});

test('Lukáš AI Engine: portrétní fotografie a ateliér', async () => {
  const engine = createLukasEngine();
  const res = await engine.respond({ text: 'Máte focení v ateliéru a portréty?' });
  assert.equal(res.reason, 'known');
  assert.match(res.text, /portrétní fotografie/i);
  assert.match(res.text, /ateliér/i);
});

test('Lukáš AI Engine: AI chatboty a hybridní agenti', async () => {
  const engine = createLukasEngine();
  const res = await engine.respond({ text: 'Otevři AI agenty' });
  assert.equal(res.reason, 'known');
  assert.match(res.text, /hybridních agentů/i);
  assert.ok(res.actions && res.actions.length > 0);
  assert.equal(res.actions[0].tool, 'scroll_to');
  assert.equal(res.actions[0].args.section, 'hybridni-agent');
});

test('Lukáš AI Engine: ceník a postup spolupráce', async () => {
  const engine = createLukasEngine();
  const resPricing = await engine.respond({ text: 'Kolik stojí focení?' });
  assert.equal(resPricing.reason, 'known');
  assert.match(resPricing.text, /kalkulují na míru/i);
  assert.match(resPricing.text, /lukas\.drsticka@gmail\.com/);

  const resProcess = await engine.respond({ text: 'Jak probíhá spolupráce a jaké jsou kroky?' });
  assert.equal(resProcess.reason, 'known');
  assert.match(resProcess.text, /4 jednoduché kroky/i);
  assert.match(resProcess.text, /Konzultace/i);
});

test('Lukáš AI Engine: akce pro filtraci galerie, motiv a showreel', async () => {
  const engine = createLukasEngine();

  const resAi = await engine.respond({ text: 'Filtruj jen AI fotky' });
  assert.equal(resAi.reason, 'known');
  assert.ok(resAi.actions && resAi.actions.length > 0);
  assert.equal(resAi.actions[0].tool, 'filter_gallery');
  assert.equal(resAi.actions[0].args.category, 'ai');

  const resFoto = await engine.respond({ text: 'Ukaž jen fotky' });
  assert.equal(resFoto.reason, 'known');
  assert.ok(resFoto.actions && resFoto.actions.length > 0);
  assert.equal(resFoto.actions[0].tool, 'filter_gallery');
  assert.equal(resFoto.actions[0].args.category, 'foto');

  const resTheme = await engine.respond({ text: 'Přepni na světlý režim' });
  assert.equal(resTheme.reason, 'known');
  assert.ok(resTheme.actions && resTheme.actions.length > 0);
  assert.equal(resTheme.actions[0].tool, 'toggle_theme');

  const resShowreel = await engine.respond({ text: 'Pusť showreel video' });
  assert.equal(resShowreel.reason, 'known');
  assert.ok(resShowreel.actions && resShowreel.actions.length > 0);
  assert.equal(resShowreel.actions[0].tool, 'play_showreel');
});

test('SiteNavigation: párování na fotogalerie v /galerie/*', () => {
  const liveGalleries = [
    { label: 'Přerov vs Velká Bystrice', path: '/galerie/prerov-vs-velka-bystrice/' },
    { label: 'Přerov vs Želatovice', path: '/galerie/prerov-vs-zelatovice/' },
    { label: 'Přerov vs Postřelmov', path: '/galerie/prerov-vs-postelmov/' },
    { label: 'Sigma vs Mainz', path: '/galerie/sigma-vs-mainz/' },
    { label: 'Portfolio', path: '#portfolio' },
    { label: 'Kontakt', path: '#kontakt' },
  ];

  assert.equal(hasExplicitUiActionIntent('otevři galerii Přerov vs Velká Bystrice'), true);
  const matchBystrice = findSiteLinkIntent('otevři galerii Přerov vs Velká Bystrice', liveGalleries);
  assert.ok(matchBystrice);
  assert.equal(matchBystrice.path, '/galerie/prerov-vs-velka-bystrice/');

  const matchZelatovice = findSiteLinkIntent('otevři galerii Želatovice', liveGalleries);
  assert.ok(matchZelatovice);
  assert.equal(matchZelatovice.path, '/galerie/prerov-vs-zelatovice/');
});

test('SiteNavigation: PendingNavigationManager odloží přechod do dohrání TTS', () => {
  const navManager = new PendingNavigationManager();
  let executed = false;
  let voiceActive = true;

  navManager.schedule(
    { id: 'gallery-nav', tool: 'navigate', args: { path: '/galerie/prerov-vs-velka-bystrice/' } },
    () => { executed = true; },
    () => voiceActive,
    50,
  );

  assert.equal(navManager.isPending(), true);
  assert.equal(executed, false);

  voiceActive = false;
  assert.equal(navManager.flush(), true);
  assert.equal(executed, true);
  assert.equal(navManager.isPending(), false);
});
