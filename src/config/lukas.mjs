import snapshot from '../../knowledge/lukas.snapshot.json' with { type: 'json' };
import {
  FrameMindEngine,
  NoopLearningSink,
  VoiceCapability,
  createPersonalPortfolioProfile,
} from '../../vendor/framemind-solution/dist/index.js';

export const LUKAS_PROFILE = createPersonalPortfolioProfile({
  id: 'lukas-drsticka-portfolio',
  name: 'Lukáš Drštička AI',
  domain: 'personal-portfolio',
  version: '1.0.0',
  disclosure: 'Ahoj, jsem Lukáš AI. Umím si s tebou povídat, provést tě portfoliem a ovládat web: vyfiltrovat fotky, ukázat ceník, přetočit showreel i přepnout vzhled.',
  privacyNotice: 'V soukromém režimu se veškerá konverzace a navigace zpracovávají lokálně ve vašem prohlížeči.',
});

export const lukasConfig = {
  mode: 'strict',
  locale: 'cs-CZ',
  sourceLabel: 'Oficiální portfolio Lukáš Drštička',
  profile: LUKAS_PROFILE,
  intents: [
    {
      id: 'greeting',
      examples: [
        'Ahoj',
        'Dobrý den',
        'Ahoj Lukáši',
        'Čau',
        'Zdravím',
        'Dobré ráno',
        'Dobrý večer',
      ],
      keywords: ['ahoj', 'cau', 'zdravim', 'nazdar', 'cus'],
      keywordGroups: [['dobry', 'den'], ['dobre', 'rano'], ['dobry', 'vecer']],
      priority: 30,
    },
    {
      id: 'farewell',
      examples: [
        'Na shledanou',
        'Měj se',
        'Mějte se hezky',
        'Zatím ahoj',
        'Čau zatím',
      ],
      keywords: ['nashledanou', 'nashle', 'sbohem'],
      keywordGroups: [['na', 'shledanou'], ['mej', 'se'], ['zatim', 'ahoj']],
      priority: 30,
    },
    {
      id: 'identity_ai',
      examples: [
        'Kdo jsi?',
        'Co jsi zač?',
        'Jsi AI?',
        'Jsi robot?',
        'Představ se',
      ],
      keywords: ['robot', 'bot'],
      keywordGroups: [['kdo', 'jsi'], ['co', 'jsi'], ['jsi', 'ai'], ['jsi', 'clovek']],
      priority: 40,
    },
    {
      id: 'capabilities',
      examples: [
        'Co umíš?',
        'S čím mi pomůžeš?',
        'Jak tě ovládat?',
        'Co tady zvládneš?',
      ],
      keywordGroups: [['co', 'umis'], ['s', 'cim', 'pomuzes'], ['jak', 'fungujes']],
      priority: 35,
    },
    {
      id: 'about',
      examples: [
        'Kdo je Lukáš Drštička?',
        'O Lukášovi',
        'Řekni mi o sobě',
        'O mně',
        'Kdo to fotí?',
      ],
      keywords: ['drsticka', 'autor'],
      keywordGroups: [['kdo', 'je', 'lukas'], ['o', 'mne'], ['rekni', 'o', 'sobe']],
      priority: 45,
    },
    {
      id: 'sports_photo',
      examples: [
        'Sportovní fotografie',
        'Fotíš fotbal?',
        'Focení zápasů',
        'Viktorka Přerov focení',
        'Sportovní akce',
        'Otevři sportovní fotky',
      ],
      keywords: ['sport', 'fotbal', 'zapas', 'zapasu'],
      keywordGroups: [['sportovni', 'foto'], ['sportovni', 'fotky'], ['sportovni', 'fotografie'], ['foceni', 'zapasu']],
      priority: 55,
    },
    {
      id: 'portrait_photo',
      examples: [
        'Portréty',
        'Portrétní focení',
        'Focení v ateliéru',
        'Kreativní portréty',
        'Portrét s kouřem',
      ],
      keywords: ['portret', 'portrety', 'atelier'],
      keywordGroups: [['portretni', 'foceni'], ['foceni', 'atelieru'], ['kreativni', 'portret']],
      priority: 50,
    },
    {
      id: 'ai_agents',
      examples: [
        'AI chatboty',
        'Hybridní agent',
        'Vývoj AI řešení',
        'Automatizace',
        'Fotograf AI',
        'Co nabízíš v oblasti AI a chatbotů?',
        'Otevři AI agenty',
      ],
      keywords: ['agent', 'agenty', 'chatbot', 'chatboty', 'semiagent', 'automatizace'],
      keywordGroups: [['hybridni', 'agent'], ['vyvoj', 'ai'], ['ai', 'reseni'], ['ai', 'agent'], ['ai', 'agenty'], ['oblasti', 'ai']],
      priority: 55,
    },
    {
      id: 'pricing',
      examples: [
        'Ceník',
        'Kolik to stojí?',
        'Ceny focení',
        'Cena za focení',
        'Kolik stojí portrét?',
        'Kolik stojí AI agent?',
      ],
      keywords: ['cenik', 'ceny', 'tarify', 'kalkulace'],
      keywordGroups: [['kolik', 'stoji'], ['cena', 'foceni'], ['ceny', 'sluzeb']],
      priority: 55,
    },
    {
      id: 'process',
      examples: [
        'Jak probíhá spolupráce?',
        'Jak pracuješ?',
        'Postup spolupráce',
        'Kroky realizace',
      ],
      keywordGroups: [['jak', 'pracujes'], ['postup', 'spoluprace'], ['kroky', 'realizace'], ['jak', 'probiha']],
      priority: 45,
    },
    {
      id: 'portfolio',
      examples: [
        'Ukaž portfolio',
        'Otevři portfolio',
        'Fotogalerie',
        'Ukaž fotky',
        'Chci vidět práce',
      ],
      keywords: ['portfolio', 'galerie', 'fotky'],
      keywordGroups: [['ukaz', 'portfolio'], ['otevri', 'portfolio'], ['chci', 'videt', 'fotky']],
      priority: 45,
    },
    {
      id: 'contact',
      examples: [
        'Kontakt',
        'Kde tě najdu?',
        'Napiš mi',
        'Telefon a email',
        'Spojení na Lukáše',
      ],
      keywords: ['kontakt', 'telefon', 'email', 'spojeni'],
      keywordGroups: [['kde', 'te', 'najdu'], ['jak', 'se', 'spojit'], ['otevri', 'kontakt']],
      priority: 45,
    },
    {
      id: 'filter_ai',
      examples: [
        'Filtruj AI',
        'Ukaž jen AI fotky',
        'Zobraz AI projekty',
      ],
      keywordGroups: [['filtruj', 'ai'], ['jen', 'ai'], ['zobraz', 'ai']],
      priority: 55,
    },
    {
      id: 'filter_foto',
      examples: [
        'Filtruj fotografie',
        'Ukaž jen fotky',
        'Zobraz fotografie',
      ],
      keywordGroups: [['filtruj', 'foto'], ['jen', 'fotky'], ['zobraz', 'fotografie']],
      priority: 55,
    },
    {
      id: 'filter_all',
      examples: [
        'Ukaž vše',
        'Všechny projekty',
        'Zruš filtr',
      ],
      keywordGroups: [['ukaz', 'vse'], ['vsechny', 'projekty'], ['zrus', 'filtr']],
      priority: 55,
    },
    {
      id: 'theme_toggle',
      examples: [
        'Přepni režim',
        'Změň motiv',
        'Světlý režim',
        'Tmavý režim',
      ],
      keywords: ['motiv'],
      keywordGroups: [['prepni', 'rezim'], ['svetly', 'rezim'], ['tmavy', 'rezim'], ['zmen', 'motiv']],
      priority: 50,
    },
    {
      id: 'showreel',
      examples: [
        'Pusť showreel',
        'Ukaž video',
        'Spusť video',
      ],
      keywords: ['showreel'],
      keywordGroups: [['pust', 'showreel'], ['spust', 'video'], ['ukaz', 'showreel']],
      priority: 50,
    },
  ],
  responses: [
    {
      intentId: 'greeting',
      sourceRequired: false,
      template: 'Ahoj! Jsem Lukáš AI. Mohu tě provést portfoliem, vyfiltrovat fotky, ukázat ceník, showreel nebo kontakty. O čem bys chtěl vědět víc?',
    },
    {
      intentId: 'farewell',
      sourceRequired: false,
      template: 'Měj se hezky! Kdykoliv budeš potřebovat nafotit zápas, portrét nebo postavit AI agenta, jsem ti kdykoliv k dispozici.',
    },
    {
      intentId: 'identity_ai',
      sourceRequired: false,
      template: LUKAS_PROFILE.disclosure,
    },
    {
      intentId: 'capabilities',
      sourceRequired: false,
      template: 'Jako hybridní agent umím přímo ovládat web: přejít na portfolio, vyfiltrovat jen sportovní fotky či AI projekty, pustit showreel, přepnout vzhled a otevřít kontaktní formulář.',
    },
    {
      intentId: 'about',
      recordId: 'about.lukas',
      template: '{{record.content}}',
    },
    {
      intentId: 'sports_photo',
      recordId: 'services.sports_photo',
      template: '{{record.content}}',
    },
    {
      intentId: 'portrait_photo',
      recordId: 'services.portrait_photo',
      template: '{{record.content}}',
    },
    {
      intentId: 'ai_agents',
      recordId: 'services.ai_agents',
      template: '{{record.content}}',
    },
    {
      intentId: 'pricing',
      recordId: 'pricing.general',
      template: '{{record.content}}',
    },
    {
      intentId: 'process',
      recordId: 'process.workflow',
      template: '{{record.content}}',
    },
    {
      intentId: 'portfolio',
      recordId: 'portfolio.galleries',
      template: 'Otevírám portfolio. {{record.content}}',
    },
    {
      intentId: 'contact',
      recordId: 'contact.general',
      template: 'Otevírám kontakt. {{record.content}}',
    },
    {
      intentId: 'filter_ai',
      sourceRequired: false,
      template: 'Filtruji portfolio na AI projekty a hybridní agenty.',
    },
    {
      intentId: 'filter_foto',
      sourceRequired: false,
      template: 'Filtruji portfolio na fotografie (sport a portréty).',
    },
    {
      intentId: 'filter_all',
      sourceRequired: false,
      template: 'Zobrazuji všechny projekty v portfoliu.',
    },
    {
      intentId: 'theme_toggle',
      sourceRequired: false,
      template: 'Přepínám barevný režim webu.',
    },
    {
      intentId: 'showreel',
      sourceRequired: false,
      template: 'Spouštím showreel video.',
    },
  ],
  actions: [
    { id: 'act-portfolio', tool: 'scroll_to', intentIds: ['portfolio', 'portfolio_galleries'], args: { section: 'portfolio' }, requireExplicitNavigation: true },
    { id: 'act-about', tool: 'scroll_to', intentIds: ['about'], args: { section: 'o-mne' }, requireExplicitNavigation: true },
    { id: 'act-sports-photo', tool: 'scroll_to', intentIds: ['sports_photo'], args: { section: 'portfolio' }, requireExplicitNavigation: true },
    { id: 'act-portrait-photo', tool: 'scroll_to', intentIds: ['portrait_photo'], args: { section: 'portfolio' }, requireExplicitNavigation: true },
    { id: 'act-ai-agents', tool: 'scroll_to', intentIds: ['ai_agents'], args: { section: 'hybridni-agent' }, requireExplicitNavigation: true },
    { id: 'act-process', tool: 'scroll_to', intentIds: ['process'], args: { section: 'spoluprace' }, requireExplicitNavigation: true },
    { id: 'act-pricing', tool: 'scroll_to', intentIds: ['pricing'], args: { section: 'kontakt' }, requireExplicitNavigation: true },
    { id: 'act-contact', tool: 'scroll_to', intentIds: ['contact'], args: { section: 'kontakt' }, requireExplicitNavigation: true },
    { id: 'act-filter-ai', tool: 'filter_gallery', intentIds: ['filter_ai'], args: { category: 'ai' } },
    { id: 'act-filter-foto', tool: 'filter_gallery', intentIds: ['filter_foto'], args: { category: 'foto' } },
    { id: 'act-filter-all', tool: 'filter_gallery', intentIds: ['filter_all'], args: { category: 'all' } },
    { id: 'act-theme', tool: 'toggle_theme', intentIds: ['theme_toggle'], args: { mode: 'toggle' } },
    { id: 'act-showreel', tool: 'play_showreel', intentIds: ['showreel'], args: {} },
  ],
  unknownResponse: 'K tomuto dotazu nemám v ověřeném přehledu přímou odpověď. Můžeš se podívat do portfolia, na ceník nebo mi napsat na lukas.drsticka@gmail.com.',
  staleResponse: 'Tento údaj už je po datu ověření. Aktuální informace najdeš přímo v příslušné sekci webu.',
  provider: { enabled: false },
  learningSink: new NoopLearningSink(),
};

export function createLukasEngine() {
  return new FrameMindEngine(lukasConfig, snapshot);
}

export function createLukasVoiceCapability() {
  return new VoiceCapability();
}
