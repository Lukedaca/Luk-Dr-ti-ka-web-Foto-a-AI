import assert from 'node:assert/strict';
import test from 'node:test';
import { FrameMindEngine, sha256Hex } from '../dist/index.js';

// Regrese z ostrého provozu 27. 9. 2026 (Viktorka, fcprerov.cz): po dotazu na nábor
// anaforický bonus unesl „Kdy je trénink?“ do šablony „napište věk“ a věk „7 let“
// se ignoroval. Lokální jádro smí odpovědět jen s vlastní přímou shodou.

const now = new Date('2026-09-27T12:00:00.000Z');

function record(id, type, content, data) {
  return {
    id,
    type,
    content,
    sourceUrl: `https://club.example/${id}`,
    contentHash: sha256Hex(content),
    fetchedAt: '2026-09-02T00:00:00.000Z',
    lastVerifiedAt: '2026-09-02T00:00:00.000Z',
    expiresAt: '2027-06-30T23:59:59.000Z',
    critical: true,
    data,
  };
}

function snapshot(records) {
  return {
    schemaVersion: 1,
    generatedAt: '2026-09-02T00:00:00.000Z',
    records: records ?? [
      record('school', 'school', 'Fotbalová školička je pro děti od 4 let.', { minAge: 4 }),
      record('recruitment', 'recruitment', 'Nábor dětí řeší klub podle ročníku.', {}),
      record('training', 'training', 'Tréninky podle tréninkového plánu.', {}),
      record('category-2019', 'age-category', 'Ročník 2019 je U-8.', { birthYear: 2019, category: 'U-8' }),
      record('category-2018', 'age-category', 'Ročník 2018 je U-9.', { birthYear: 2018, category: 'U-9' }),
    ],
  };
}

const ageRule = {
  intentId: 'age_category',
  requiredAnySlots: ['birthYear'],
  missingRecordId: 'school',
  missingTemplate: 'Školička je od {{minAge}} let. Napište věk nebo rok narození.',
  ageRangeTemplate: 'Dítěti je {{childAge}} let, takže je to ročník {{yearA}} ({{a.category}}) nebo {{yearB}} ({{b.category}}) podle data narozenin.',
  selectBy: { slot: 'birthYear', dataField: 'birthYear', recordType: 'age-category' },
  template: 'Ročník {{birthYear}} je kategorie {{category}}.',
};

function config(responses = [ageRule]) {
  return {
    mode: 'strict',
    locale: 'cs-CZ',
    intents: [
      {
        id: 'age_category',
        keywords: ['vek', 'rocnik', 'let'],
        followUpFor: ['age_category', 'recruitment'],
        priority: 35,
      },
      { id: 'recruitment', keywords: ['nabor', 'nabirate'], priority: 20 },
      { id: 'training', keywords: ['treninky', 'trenuje'], priority: 16 },
    ],
    responses: [
      ...responses,
      { intentId: 'recruitment', recordId: 'recruitment', template: 'Nábor řeší klub podle ročníku.' },
      { intentId: 'training', recordId: 'training', template: 'Tréninky najdete v tréninkovém plánu.' },
    ],
    actions: [],
    unknownResponse: 'Tuto informaci nemohu spolehlivě potvrdit.',
    staleResponse: 'Údaj je po datu ověření.',
    provider: { enabled: false },
  };
}

test('follow-up without own lexical match does not hijack an unrelated question', async () => {
  const engine = new FrameMindEngine(config(), snapshot());
  await engine.respond({ text: 'Nabíráte děti?', now });
  const response = await engine.respond({ text: 'Kdy je trénink?', now });
  assert.notEqual(response.intent, 'age_category');
  assert.equal(response.reason, 'unknown');
});

test('real lexical match beats the anaphora bonus of the previous topic', async () => {
  const engine = new FrameMindEngine(config(), snapshot());
  await engine.respond({ text: 'Synovi je 7 let, může k vám na nábor?', now });
  const response = await engine.respond({ text: 'A kdy trénujou?', now });
  assert.equal(response.intent, 'training');
  assert.equal(response.reason, 'known');
});

test('age without birth year answers both grounded categories instead of asking again', async () => {
  const engine = new FrameMindEngine(config(), snapshot());
  const response = await engine.respond({ text: 'Synovi je 7 let, může k vám na nábor?', now });
  assert.equal(response.intent, 'age_category');
  assert.equal(response.reason, 'known');
  assert.match(response.text, /2019 \(U-8\)/);
  assert.match(response.text, /2018 \(U-9\)/);
  assert.doesNotMatch(response.text, /Napište věk/);
});

test('age range falls back to the missing-slot question when a category record is absent', async () => {
  const records = snapshot().records.filter((item) => item.id !== 'category-2018');
  const engine = new FrameMindEngine(config(), snapshot(records));
  const response = await engine.respond({ text: 'Synovi je 7 let, může k vám na nábor?', now });
  assert.equal(response.reason, 'missing-slot');
  assert.match(response.text, /Napište věk/);
});

test('rule without ageRangeTemplate keeps the missing-slot behaviour', async () => {
  const { ageRangeTemplate, ...legacyRule } = ageRule;
  const engine = new FrameMindEngine(config([legacyRule]), snapshot());
  const response = await engine.respond({ text: 'Synovi je 7 let, může k vám na nábor?', now });
  assert.equal(response.reason, 'missing-slot');
});

test('message that itself carries the age still continues the previous topic', async () => {
  const engine = new FrameMindEngine(config(), snapshot());
  await engine.respond({ text: 'Nabíráte děti?', now });
  const response = await engine.respond({ text: 'Malej má 7, v listopadu 8, teď je září.', now });
  assert.equal(response.intent, 'age_category');
  assert.match(response.text, /U-9/);
});
