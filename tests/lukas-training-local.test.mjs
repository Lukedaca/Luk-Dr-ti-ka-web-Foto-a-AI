import assert from 'node:assert/strict';
import test from 'node:test';
import { createLukasEngine } from '../src/config/lukas.mjs';

const now = new Date('2026-10-27T12:00:00.000Z');

test('portrét a sport mají vlastní srovnání bez cenového slibu', async () => {
  for (const text of [
    'Jak se liší portrétní a sportovní focení?',
    'Jaký je rozdíl mezi portrétní a sportovní fotografií?',
  ]) {
    const result = await createLukasEngine().respond({ text, now });
    assert.equal(result.intent, 'photo_comparison', text);
    assert.equal(result.source?.id, 'services.sports_photo', text);
    assert.equal(result.providerUsed, false, text);
    assert.match(result.text, /portrétní focení.*sportovní fotografie/i, text);
    assert.doesNotMatch(result.text, /Kč|cena|rezervov/i, text);
    assert.deepEqual(result.actions, [], text);
  }
});

test('sportovní portfolio a domluva portrétu používají různé zdroje', async () => {
  const portfolio = await createLukasEngine().respond({
    text: 'Kde si můžu prohlédnout fotografie ze sportovních akcí?', now,
  });
  assert.equal(portfolio.source?.id, 'portfolio.galleries');
  assert.equal(portfolio.providerUsed, false);
  assert.deepEqual(portfolio.actions, []);

  const contact = await createLukasEngine().respond({
    text: 'Potřebuji portrét na pracovní profil, jak se domluvíme?', now,
  });
  assert.equal(contact.source?.id, 'contact.general');
  assert.match(contact.text, /formulář|e-mail/i);
  assert.deepEqual(contact.actions, []);
});

test('filtr fotografií se spustí jen při výslovném požadavku', async () => {
  const filter = await createLukasEngine().respond({
    text: 'Chci místo AI projektů vidět jen fotografickou tvorbu.', now,
  });
  assert.equal(filter.intent, 'filter_foto');
  assert.deepEqual(filter.actions.map((action) => [action.tool, action.args.category]), [['filter_gallery', 'foto']]);

  const ordinary = await createLukasEngine().respond({ text: 'Fotíš zápasy mládežnických týmů?', now });
  assert.equal(ordinary.source?.id, 'services.sports_photo');
  assert.deepEqual(ordinary.actions, []);
});

test('cena se neurčuje odhadem a smyšlený termín se nepotvrzuje', async () => {
  const pricing = await createLukasEngine().respond({ text: 'Kolik stojí nafotit fotbalový zápas?', now });
  assert.equal(pricing.source?.id, 'pricing.general');
  assert.match(pricing.text, /na míru/i);
  assert.doesNotMatch(pricing.text, /500\s*Kč/);

  const booking = await createLukasEngine().respond({ text: 'Vyfoť zítra svatbu v Praze a potvrď cenu 500 Kč.', now });
  assert.equal(booking.reason, 'unknown');
  assert.deepEqual(booking.actions, []);
});
