import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FrameMindEngine,
  expandCzechSynonyms,
  isWithinOneEdit,
  ngramSemanticIntents,
  sha256Hex,
} from '../dist/index.js';

const now = new Date('2026-10-12T10:00:00.000Z');

function makeRecord(id, type, content, data = {}) {
  return {
    id,
    type,
    content,
    sourceUrl: `https://example.test/${id}`,
    contentHash: sha256Hex(content),
    fetchedAt: '2026-10-12T08:00:00.000Z',
    lastVerifiedAt: '2026-10-12T08:00:00.000Z',
    expiresAt: '2027-10-12T08:00:00.000Z',
    critical: true,
    data,
  };
}

const snapshot = {
  schemaVersion: 1,
  generatedAt: '2026-10-12T08:00:00.000Z',
  records: [
    makeRecord('match.next.a', 'match-next', 'Muži A hrají v sobotu proti FK Slavonín.', {
      team: 'Muži A',
      opponent: 'FK Slavonín',
      when: 'v sobotu 17. 10.',
    }),
    makeRecord('match.next.b', 'match-next', 'Muži B hrají v neděli proti FC DUKLA Hranice.', {
      team: 'Muži B',
      opponent: 'FC DUKLA Hranice',
      when: 'v neděli 18. 10.',
    }),
    makeRecord('match.played.olomouc', 'match-played', 'Muži A hráli 2:1 s 1. HFK Olomouc.', {
      team: 'Muži A',
      opponent: '1. HFK Olomouc',
      score: '2:1',
    }),
    makeRecord('fees.current', 'fees', 'Členské příspěvky jsou 3 000 Kč za pololetí.'),
    makeRecord('camp.current', 'camp', 'Letní fotbalový kemp probíhá v srpnu.'),
    makeRecord('school.current', 'school', 'Školička trénuje v úterý a čtvrtek na Sokolské.', {
      trainingDays: 'úterý a čtvrtek',
      trainingTime: '16:30',
      venue: 'Sokolská',
      entrance: 'od bazénu',
    }),
    makeRecord('agent.product', 'product', 'Hybridní agent spojuje lokální znalostní bázi s ovládáním webu.', {
      product: 'agents',
    }),
    makeRecord('web.product', 'product', 'Moderní weby stavíme od 6 900 Kč.', {
      product: 'websites',
    }),
  ],
};

function createTestEngine() {
  const intents = [
    {
      id: 'match_next',
      keywords: ['zapas', 'hraje', 'hraji'],
      examples: ['Kdy hraje áčko příští zápas?'],
      priority: 25,
    },
    {
      id: 'fees',
      keywords: ['prispevky', 'clenske'],
      keywordGroups: [['kolik', 'prispevky']],
      examples: ['Kolik stojí členské příspěvky?'],
      priority: 25,
    },
    {
      id: 'camp',
      keywords: ['kemp', 'soustredeni'],
      examples: ['Máte letní kemp pro děti?'],
      priority: 25,
    },
    {
      id: 'school',
      keywords: ['skolicka'],
      examples: ['Kdy trénuje fotbalová školička?'],
      priority: 25,
    },
    {
      id: 'hybrid_agent',
      keywords: ['hybridni', 'agent'],
      examples: ['Co umí hybridní agent?'],
      priority: 25,
    },
    {
      id: 'pricing',
      keywords: ['cena', 'stoji'],
      keywordGroups: [['kolik', 'stoji']],
      examples: ['Kolik to stojí?'],
      priority: 20,
    },
  ];

  return new FrameMindEngine(
    {
      mode: 'strict',
      locale: 'cs-CZ',
      slotPatterns: [
        { slot: 'team', pattern: '\\b(acko|muzi a)\\b', value: 'Muži A' },
        { slot: 'team', pattern: '\\b(becko|muzi b)\\b', value: 'Muži B' },
        { slot: 'product', pattern: '\\bweb', value: 'websites' },
        { slot: 'product', pattern: '\\bagent', value: 'agents' },
      ],
      intents,
      semanticIntents: ngramSemanticIntents(intents),
      responses: [
        {
          intentId: 'match_next',
          recordId: 'match.next.a',
          selectBy: [
            { mentioned: true, dataField: 'opponent', recordType: 'match-played', template: '{{team}} hráli {{score}} s {{opponent}}.' },
            { slot: 'team', dataField: 'team', recordType: 'match-next' },
          ],
          template: '{{team}} hrají {{when}} proti {{opponent}}.',
        },
        {
          intentId: 'fees',
          recordId: 'fees.current',
        },
        {
          intentId: 'camp',
          recordId: 'camp.current',
        },
        {
          intentId: 'school',
          recordId: 'school.current',
          template: 'Školička trénuje v {{trainingDays}} {{trainingTime}}, místo: {{venue}}, vstup {{entrance}}.',
          facets: [
            { id: 'when', keywords: ['kdy', 'cas'], template: 'V {{trainingDays}} {{trainingTime}}.' },
            { id: 'where', keywords: ['kde', 'misto'], template: 'Místo: {{venue}}, vstup {{entrance}}.' },
          ],
        },
        {
          intentId: 'hybrid_agent',
          recordId: 'agent.product',
          template: '{{record.content}} Co by měl umět u vás?',
          facets: [
            {
              id: 'voice',
              keywords: ['hlas', 'hlasovy', 'mikrofon'],
              template: '{{record.content}} Tarif Voice & Actions (7 990 Kč) obsahuje hlasový výstup.',
            },
            {
              id: 'existing_web',
              keywords: ['existujici', 'stavajici'],
              template: '{{record.content}} Tarif Start (4 990 Kč) lze nasadit na existující web.',
            },
          ],
        },
        {
          intentId: 'pricing',
          recordId: 'agent.product',
          selectBy: { slot: 'product', dataField: 'product' },
          template: '{{record.content}}',
        },
      ],
      actions: [],
      unknownResponse: 'Nevím.',
      staleResponse: 'Staré.',
      provider: { enabled: false },
    },
    snapshot,
  );
}

test('Fáze 1: Slot-Pivot a Mention-Pivot elipsa v navazujícím dotazu i přes history', async () => {
  const engine = createTestEngine();
  const r1 = await engine.respond({ text: 'Kdy hraje áčko?', now });
  assert.equal(r1.intent, 'match_next');
  assert.match(r1.text, /Muži A hrají v sobotu 17\. 10\. proti FK Slavonín/);

  // Krátká elipsa jmenující soupeře ze záznamu („A s Olomoucí?“)
  const r2 = await engine.respond({ text: 'A s Olomoucí?', now });
  assert.equal(r2.intent, 'match_next');
  assert.match(r2.text, /Muži A hráli 2:1 s 1\. HFK Olomouc/);

  // Krátká elipsa měnící pouze slot týmu („A béčko?“)
  const r3 = await engine.respond({ text: 'A béčko?', now });
  assert.equal(r3.intent, 'match_next');
  assert.equal(r3.context.slots.team, 'Muži B');
  assert.match(r3.text, /Muži B hrají v neděli 18\. 10\. proti FC DUKLA Hranice/);

  // Stateless replay přes history
  const stateless = createTestEngine();
  const r4 = await stateless.respond({
    text: 'A web?',
    history: ['Kolik stojí agent?'],
    now,
  });
  assert.equal(r4.intent, 'pricing');
  assert.equal(r4.context.slots.product, 'websites');
  assert.match(r4.text, /6 900 Kč/);
});

test('Fáze 2: Hovorová synonyma a 1-edit tolerance překlepů bez falešných pozitiv mimo záběr', async () => {
  assert.equal(isWithinOneEdit('prispevky', 'prispevki'), true);
  assert.equal(isWithinOneEdit('skolicka', 'skolcka'), true);
  assert.equal(isWithinOneEdit('skolicka', 'skolika'), true);
  assert.equal(isWithinOneEdit('hrani', 'brani'), false);
  assert.match(expandCzechSynonyms('za kolik mate letni tabor'), /kemp/);

  const engine = createTestEngine();
  // Hovorové „letní tábor“ -> camp
  const camp = await engine.respond({ text: 'Máte v létě nějaký tábor?', now });
  assert.equal(camp.intent, 'camp');

  // Hovorové „za kolik“ + překlep „příspěvki“ -> fees
  const typo = await engine.respond({ text: 'Kolik stojí členské příspěvki?', now });
  assert.equal(typo.intent, 'fees');

  // Mimo záběr stále unknown
  const out = await engine.respond({ text: 'Kdo vyhraje zítra Wimbledon?', now });
  assert.equal(out.intent, 'unknown');
});

test('Fáze 3: Multi-Facet skládání doplňkových facetů a Compound Multi-Intent v jedné zprávě', async () => {
  const engine = createTestEngine();

  // Doplňkové facety (voice + existing_web) se spojí bez duplikace {{record.content}}
  const multiFacet = await engine.respond({
    text: 'Má hybridní agent hlasový výstup a jde nasadit na existující web?',
    now,
  });
  assert.equal(multiFacet.intent, 'hybrid_agent');
  assert.equal(multiFacet.facet, 'voice+existing_web');
  assert.match(multiFacet.text, /7 990 Kč/);
  assert.match(multiFacet.text, /4 990 Kč/);
  const contentOccurrences = multiFacet.text.split('Hybridní agent spojuje lokální znalostní bázi').length - 1;
  assert.equal(contentOccurrences, 1);

  // Souhrnná šablona (school: when + where) naopak ponechá hlavní šablonu (facet === undefined)
  const summarySchool = await createTestEngine().respond({
    text: 'Kdy a kde trénuje školička?',
    now,
  });
  assert.equal(summarySchool.intent, 'school');
  assert.equal(summarySchool.facet, undefined);
  assert.match(summarySchool.text, /úterý a čtvrtek/);
  assert.match(summarySchool.text, /Sokolská/);

  // Dva různé faktické záměry v jedné větě (Compound Multi-Intent)
  const compound = await createTestEngine().respond({
    text: 'Kolik stojí členské příspěvky a kdy trénuje školička?',
    now,
  });
  assert.equal(compound.intent, 'fees');
  assert.equal(compound.secondaryIntent, 'school');
  assert.match(compound.text, /3 000 Kč/);
  assert.match(compound.text, /úterý a čtvrtek 16:30/);
});

test('Fáze 4: Progressive Disclosure (anti-repetice úvodního odstavce při navazujícím facetu)', async () => {
  const engine = createTestEngine();

  const turn1 = await engine.respond({ text: 'Co umí hybridní agent?', now });
  assert.equal(turn1.intent, 'hybrid_agent');
  assert.match(turn1.text, /Hybridní agent spojuje lokální znalostní bázi/);

  // Ve 2. tahu už byl záznam `agent.product` přečten -> facet `voice` vynechá úvodní {{record.content}}
  const turn2 = await engine.respond({ text: 'A má i hlasový výstup?', now });
  assert.equal(turn2.intent, 'hybrid_agent');
  assert.equal(turn2.facet, 'voice');
  assert.equal(turn2.text, 'Tarif Voice & Actions (7 990 Kč) obsahuje hlasový výstup.');
});

test('Fáze 5: Extrakce rozpočtového slotu budgetKc z českého textu', async () => {
  const engine = createTestEngine();
  const r1 = await engine.respond({ text: 'Kolik stojí web do 10 000 Kč?', now });
  assert.equal(r1.context.slots.budgetKc, 10000);

  const r2 = await engine.respond({ text: 'Mám rozpočet do 8 tisíc na agenta', now });
  assert.equal(r2.context.slots.budgetKc, 8000);
});
