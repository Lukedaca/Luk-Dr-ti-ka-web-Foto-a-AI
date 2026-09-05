/**
 * Sémantický dedukční engine a generátor přirozeného jazyka (NLG)
 * pro osobní portfolio web Lukáše Drštičky (Foto a AI).
 *
 * 100% čistý kód, běží lokálně bez externích AI služeb a bez placených API (0 Kč).
 * Provádí:
 * 1. Vybudování znalostního grafu z ověřeného snapshotu Lukáše Drštičky.
 * 2. Sémantickou inferenci (sportovní foto, portréty, vývoj AI agentů, ceník, postup, kontakt).
 * 3. Dynamickou NLG syntézu přirozených vět pro Lukáš AI – AI Hybridního Agenta.
 */

export function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function stemCzechWord(word) {
  let s = String(word || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (s.length <= 3) return s;
  s = s.replace(/(?:kem|kov|ice|ici|ich|ovem|eho|emu|ymi|emi|ovi|ami|ach|ych|im|ym|em|am|um|ou|es|as|os|ov|ku|ka|ce|ky|ek|ke|ko|e|i|u|a|o|y)$/, '');
  return s.length >= 3 ? s : String(word || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Vybuduje sémantický znalostní graf z ověřeného snapshotu Lukáše Drštičky
 */
export function buildLukasKnowledgeGraph(snapshot = {}) {
  const records = snapshot?.records || [];
  const map = new Map();
  for (const r of records) {
    if (r && r.id) {
      map.set(r.id, r);
    }
  }

  return {
    about: map.get('about.lukas') || null,
    sportsPhoto: map.get('services.sports_photo') || null,
    portraitPhoto: map.get('services.portrait_photo') || null,
    aiAgents: map.get('services.ai_agents') || null,
    pricing: map.get('pricing.general') || null,
    process: map.get('process.workflow') || null,
    portfolioGalleries: map.get('portfolio.galleries') || null,
    contact: map.get('contact.general') || null,
    records,
  };
}

/**
 * Dynamická syntéza konverzačních odpovědí a sémantické odvozování (NLG)
 */
export function synthesizeLukasDialogue(query, graph, { isFallback = false } = {}) {
  const norm = normalize(query);

  // 1. Nálada, jak se vede a aktuální dění
  const isMoodQuery = /(?:jak se (?:vede|mas|dari|mate)|jak (?:to jde|je|se dnes mas)|co delas|jaka je nalada)/.test(norm);
  if (isMoodQuery) {
    return 'Mám se skvěle a práce je v plném proudu! ⚡ V ateliéru i na stadionech teď fotíme zápasy Viktorie Přerov a zároveň vyvíjíme novou generaci hybridních AI agentů v rámci konceptu FrameMind. Jak se dnes daří tobě a s čím ti mohu pomoci?';
  }

  // 2. Novinky a aktuality
  const isNewsQuery = /(?:co je noveho|co se deje|jake jsou novinky|co noveho|nejnovejsi zpravy|aktuality)/.test(norm);
  if (isNewsQuery) {
    return 'Novinek je celá řada! ⚽ Máme čerstvě nasazenou AI Hybridní Agentku Viktorku pro fotbalový klub 1. FC Viktorie Přerov, v portfoliu přibyly nové fotogalerie ze zápasů i ze Sigmy Olomouc a v laboratoři FrameMind dokončujeme nové AI nástroje pro fotografy. Chceš se podívat na fotky, nebo tě zajímají AI řešení?';
  }

  // 3. Původ, autorství a identita (EU AI Act čl. 50)
  const isIdentityQuery = /(?:kdo jsi|co jsi zac|jak se jmenujes|jsi clovek|jsi robot|jsi umela inteligence|jsi ai|predstav se)/.test(norm);
  if (isIdentityQuery) {
    return 'Ahoj! Jsem Lukáš AI – AI Hybridní Agent. Zastupuji fotografa a vývojáře Lukáše Drštičku. Běžím lokálně ve tvém prohlížeči. Nejenže odpovídám na dotazy, ale umím web přímo ovládat: vyfiltrovat fotky či AI projekty, ukázat ceník, přetočit showreel nebo tě spojit přímo s Lukášem ⚡';
  }

  const isOriginQuery = /(?:kdo te (?:vytvoril|naprogramoval|vyrobil|udelal|vymyslel|postavil)|odkud jsi|kdo za tebou stoji)/.test(norm);
  if (isOriginQuery) {
    return 'Vytvořil mě Lukáš Drštička, fotograf a vývojář hybridních AI systémů z Přerova. Jsem navržen tak, abych návštěvníkům ukázal Lukášovu práci, fotografie i možnosti vývoje webů a AI agentů 🚀';
  }

  // 4. Pochvaly a uznání
  const isComplimentQuery = /(?:jsi (?:sikovny|super|skvely|uzasny|nejleps|borec)|ses (?:borec|jednicka|super|skvely)|dobra prace|skvela prace)/.test(norm);
  if (isComplimentQuery) {
    return 'Díky moc, to mě jako AI Hybridního Agenta opravdu potěšilo! ⚡ Snažím se, aby pro tebe bylo procházení portfolia i hledání informací maximálně plynulé. S čím dalším ti mohu pomoci?';
  }

  // 5. Sportovní fotografie a fotbal
  const isSportsInquiry = /(?:sportovn|fotbal|zapas|viktork|sigma|olomouc|turnaj)/.test(norm);
  if (isSportsInquiry && graph?.sportsPhoto?.content) {
    return `${graph.sportsPhoto.content} V portfoliu najdeš záběry ze zápasů Přerova i prvoligové Sigmy Olomouc. Chceš, abych ti vyfiltroval sportovní fotky? ⚽`;
  }

  // 6. Portréty a ateliér
  const isPortraitInquiry = /(?:portret|atelier|exterier|rodinn|kour|festival)/.test(norm);
  if (isPortraitInquiry && graph?.portraitPhoto?.content) {
    return `${graph.portraitPhoto.content} Focení vždy přizpůsobujeme tvé představě. Chceš přejít k ukázkám portrétů v portfoliu? 📸`;
  }

  // 7. Vývoj AI Hybridních Agentů
  const isAiInquiry = /(?:vyvoj ai|hybridni agent|automatizac|framemind|umela inteligence)/.test(norm);
  if (isAiInquiry && graph?.aiAgents?.content) {
    return `${graph.aiAgents.content} Přesně takhle funguji i já na tomto webu – v reálném čase a bez zbytečných poplatků. Chceš otevřít sekci o hybridních agentech? ⚡`;
  }

  // 8. Ceník a kalkulace
  const isPricingQuery = /(?:kolik stoji|cenik|ceny|kalkulace|kolik date za|cena foceni|cena agenta)/.test(norm);
  if (isPricingQuery && graph?.pricing?.content) {
    return `${graph.pricing.content} Chceš otevřít kontaktní formulář pro nezávaznou kalkulaci? 📋`;
  }

  // 9. Postup spolupráce
  const isProcessQuery = /(?:jak probiha|postup spoluprace|jak pracujes|kroky realizace|harmonogram)/.test(norm);
  if (isProcessQuery && graph?.process?.content) {
    return `${graph.process.content} Celým procesem tě Lukáš provede krok za krokem. Chceš se podívat na podrobnosti do sekce Spolupráce? 🤝`;
  }

  // 10. Kontakt a spojení
  const isContactQuery = /(?:kontakt|telefon|email|kde te najdu|spojeni|drsticka)/.test(norm);
  if (isContactQuery && graph?.contact?.content) {
    return `${graph.contact.content} Můžeš také napsat přímo mně a já vzkaz předám Lukášovi. Chceš otevřít kontaktní sekci? ✉️`;
  }

  // 11. Konverzační fallback (Namísto jakéhokoliv chybového stavu nebo neznámé hlášky)
  if (isFallback) {
    return 'Jsem Lukáš AI – AI Hybridní Agent. K tomuto dotazu nemám v ověřeném přehledu přímou odpověď a nechci si nic vymýšlet ⚡ Rád tě ale provedu portfoliem, vyfiltruji sportovní fotky či AI projekty, ukážu ceník a postup spolupráce, nebo tě spojím s Lukášem na lukas.drsticka@gmail.com. Co by tě zajímalo?';
  }

  return null;
}
