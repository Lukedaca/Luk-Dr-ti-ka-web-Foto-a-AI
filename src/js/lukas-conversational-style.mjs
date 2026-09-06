/**
 * Modul pro formátování a konverzační styl (Voice & Tone Cadence)
 * pro Lukáš AI – AI Hybridního Agenta (portfolio Lukáše Drštičky).
 *
 * 100% čistý kód, běží lokálně bez externích závislostí a bez placených API (0 Kč).
 * Zajišťuje:
 * 1. 4fázovou stavbu odpovědí (opener -> core -> detail -> hook).
 * 2. Pestrost větných formulací s dynamickými variacemi.
 * 3. Osobní, autentický a technologický tón Lukáše Drštičky (fotograf a vývojář).
 */

export function selectVariant(variants = [], seed = '') {
  if (!Array.isArray(variants) || variants.length === 0) return '';
  if (variants.length === 1) return variants[0];

  let hash = 0;
  const str = String(seed || '');
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return variants[hash % variants.length];
}

/**
 * 4fázová kadence odpovědi:
 * - opener: glosa / reakce na dotaz
 * - core: jádro informace
 * - detail: konkrétní fakta, reference nebo technický detail
 * - hook: přirozená konverzační výzva k další akci
 */
export function composeCadence({ opener = '', core = '', detail = '', hook = '' } = {}) {
  const parts = [];
  if (opener) parts.push(opener.trim());
  if (core) parts.push(core.trim());
  if (detail) parts.push(detail.trim());
  if (hook) parts.push(hook.trim());
  return parts.join(' ');
}

export function formatLukasSportsReply(query, graph = {}, options = {}) {
  const seed = query || 'sports';
  const opener = selectVariant([
    'Sportovní fotografie je moje velká vášeň! ⚽',
    'U sportovních fotek jde o zlomek vteřiny a čisté emoce. ⚡',
    'Fotbal a sportovní akce fotím dlouhodobě přímo na hřišti i ze střídačky. 📸',
  ], seed + '_open');

  const core = (graph?.sportsPhoto?.content)
    ? graph.sportsPhoto.content
    : 'Lukáš Drštička fotí zápasy a turnaje v Přerově, Olomouci a okolí jako oficiální klubový fotograf 1. FC Viktorie Přerov.';

  const detail = selectVariant([
    'V portfoliu najdeš samostatné fotogalerie ze zápasů Viktorie Přerov i ligové Sigmy Olomouc.',
    'Po zápase probíhá okamžitý výběr a rychlé úpravy, aby měl klub fotky na sociální sítě do 24 hodin.',
    'Záběry zachycují nejen samotnou akci na hřišti, ale i emoce hráčů, střídačku a atmosféru fanoušků.',
  ], seed + '_det');

  const hook = selectVariant([
    'Chceš, abych ti v portfoliu rovnou vyfiltroval sportovní fotky?',
    'Zajímá tě nezávazná kalkulace na focení zápasu či turnaje?',
    'Mám ti ukázat konkrétní galerii z fotbalových zápasů?',
  ], seed + '_hook');

  return composeCadence({ opener, core, detail, hook });
}

export function formatLukasPortraitReply(query, graph = {}, options = {}) {
  const seed = query || 'portraits';
  const opener = selectVariant([
    'Portrétní focení vždy stavíme na přirozenosti a pohodové atmosféře. 📸',
    'Ať už v ateliéru nebo venku, portrét musí vystihnout tvou osobnost. ✨',
    'Fotím individuální i rodinné portréty a také kreativní experimenty. 🎨',
  ], seed + '_open');

  const core = (graph?.portraitPhoto?.content)
    ? graph.portraitPhoto.content
    : 'Portrétní fotografie v ateliéru i exteriéru: individuální, rodinné i kreativní portréty s důrazem na osobitou atmosféru.';

  const detail = selectVariant([
    'Focení probíhá v ateliéru v Přerově nebo ve vybraných venkovních lokacích podle tvého stylu.',
    'Součástí jsou i oblíbené kreativní série s festivalovou estetikou a kouřovými efekty.',
    'Pomohu ti s výběrem outfitu, pózováním i celkovým pojetím, takže se nemusíš ničeho bát.',
  ], seed + '_det');

  const hook = selectVariant([
    'Chceš si prohlédnout ukázky portrétů v portfoliu?',
    'Zajímá tě ceník portrétního focení a volné termíny?',
    'Mám otevřít formulář pro nezávaznou domluvu focení?',
  ], seed + '_hook');

  return composeCadence({ opener, core, detail, hook });
}

export function formatLukasAgentReply(query, graph = {}, options = {}) {
  const seed = query || 'agents';
  const opener = selectVariant([
    'Vývoj AI Hybridních Agentů je budoucnost interakce na webu! ⚡',
    'Hybridní agent není jen obyčejný chatbot, ale skutečný navigační partner. 🚀',
    'Přesně takhle funguji i já – spojuji konverzaci s přímými akcemi na webu. 💡',
  ], seed + '_open');

  const core = (graph?.aiAgents?.content)
    ? graph.aiAgents.content
    : 'Lukáš vyvíjí inteligentní hybridní agenty pro weby, kteří návštěvníka nejen informují, ale dokážou web přímo ovládat a mluvit přirozeným hlasem.';

  const detail = selectVariant([
    'Agent běží přímo v prohlížeči, filtruje obsah, provádí návštěvníka stránkou a běží za 0 Kč bez zbytečných externích poplatků.',
    'Reálným příkladem z praxe je klubová agentka Viktorka nasazená pro 1. FC Viktorie Přerov na fcprerov.cz.',
    'Systém podporuje text i hlas, diskurzní paměť a automatické navrhování relevantních kroků.',
  ], seed + '_det');

  const hook = selectVariant([
    'Zajímá tě, jak by mohl hybridní agent fungovat na tvém vlastním webu?',
    'Chceš si vyzkoušet, co všechno zvládnu na této stránce předvést?',
    'Mám ti ukázat ceník a postup realizace AI agenta?',
  ], seed + '_hook');

  return composeCadence({ opener, core, detail, hook });
}

export function formatLukasPricingReply(query, graph = {}, options = {}) {
  const seed = query || 'pricing';
  const opener = selectVariant([
    'Ceny vždy stavíme férově a transparentně podle reálného rozsahu práce. 📋',
    'Ke každému focení i projektu přistupuji individuálně. 💡',
    'Žádné skryté poplatky – cenu znáš předem před začátkem práce. ✨',
  ], seed + '_open');

  const core = (graph?.pricing?.content)
    ? graph.pricing.content
    : 'Ceník služeb Lukáše Drštičky: Focení i vývoj AI agentů se kalkulují na míru podle rozsahu, lokality a náročnosti projektu.';

  const detail = selectVariant([
    'U sportu záleží na počtu zápasů či délce turnaje; u portrétů na počtu vyretušovaných snímků; u AI agentů na požadovaných integracích.',
    'Nezávaznou kalkulaci připravím obvykle do 24 hodin od zadání.',
  ], seed + '_det');

  const hook = selectVariant([
    'Chceš otevřít kontaktní formulář a popsat svůj projekt?',
    'Která oblast tě zajímá konkrétně: sportovní foto, portréty, nebo AI agent?',
  ], seed + '_hook');

  return composeCadence({ opener, core, detail, hook });
}

export function formatLukasProcessReply(query, graph = {}, options = {}) {
  const seed = query || 'process';
  const opener = selectVariant([
    'Spolupráce probíhá hladce a bez zbytečné byrokracie. 🤝',
    'Celým procesem tě provedu krok za krokem od prvního nápadu po finální výstup. ⚡',
  ], seed + '_open');

  const core = (graph?.process?.content)
    ? graph.process.content
    : 'Postup spolupráce má 4 jednoduché kroky: 1. Konzultace (probereme představy a cíle), 2. Plánování (harmonogram), 3. Realizace (fotografie nebo AI kód), 4. Dokončení (finální úpravy a předání).';

  const detail = 'Vždy přesně víš, v jaké fázi se tvůj projekt nachází a co bude následovat.';

  const hook = selectVariant([
    'Máš konkrétní projekt, který bys chtěl nezávazně probrat?',
    'Chceš otevřít sekci Spolupráce na webu?',
  ], seed + '_hook');

  return composeCadence({ opener, core, detail, hook });
}

export function formatLukasContactReply(query, graph = {}, options = {}) {
  const opener = 'Spojit se se mnou je snadné! ✉️';
  const core = (graph?.contact?.content)
    ? graph.contact.content
    : 'Kontakt na Lukáše Drštičku: e-mail lukas.drsticka@gmail.com, telefon +420 721 624 429, sídlo Přerov (Olomoucký kraj).';
  const detail = 'Můžeš mi také zanechat zprávu přímo tady ve widgetu a já ji Lukášovi okamžitě předám.';
  const hook = 'Mám ti rovnou otevřít kontaktní formulář?';

  return composeCadence({ opener, core, detail, hook });
}
