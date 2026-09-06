/**
 * Modul pro správu vícekolového diskurzu (Discourse Context & Entity Tracking)
 * pro Lukáš AI – AI Hybridního Agenta (portfolio Lukáše Drštičky).
 *
 * 100% čistý kód, běží lokálně bez externích závislostí a bez placených API (0 Kč).
 * Zajišťuje:
 * 1. Sledování aktivní entity (sportovní foto, portréty/ateliér, vývoj AI agentů, ceník, postup, kontakt).
 * 2. Řešení anafory a elipsy pro navazující dotazy (např. "A cena?", "A jak dlouho to trvá?", "A co fotbal?").
 * 3. Opravné smyčky (Conversational Repair: "Ne, myslel jsem portréty", "Vlastně agenta").
 * 4. Řešení nejednoznačností a disambiguaci (např. holé "Kolik to stojí?" bez kontextu).
 * 5. Generování dynamických doporučených dotazů (Suggested Follow-up Chips).
 */

export const ENTITY_TYPES = Object.freeze({
  SERVICE_SPORTS: 'service_sports',
  SERVICE_PORTRAITS: 'service_portraits',
  SERVICE_AI_AGENTS: 'service_ai_agents',
  PRICING: 'pricing',
  PROCESS: 'process',
  CONTACT: 'contact',
  ABOUT: 'about',
});

export class LukasDiscourseContext {
  constructor(initialData = {}) {
    this.history = Array.isArray(initialData.history) ? [...initialData.history] : [];
    this.activeEntity = initialData.activeEntity ? { ...initialData.activeEntity } : null;
    this.pendingClarification = initialData.pendingClarification ? { ...initialData.pendingClarification } : null;
    this.turnCount = typeof initialData.turnCount === 'number' ? initialData.turnCount : 0;
    this.lastTopic = initialData.lastTopic || null;
  }

  setEntity(type, name, data = {}) {
    this.activeEntity = {
      type,
      name,
      data: { ...data },
      updatedAtTurn: this.turnCount,
    };
    this.lastTopic = type;
  }

  clearEntity() {
    this.activeEntity = null;
  }

  advanceTurn(userText, agentText, intentType = null) {
    this.turnCount += 1;
    this.history.push({
      turn: this.turnCount,
      user: userText,
      agent: agentText,
      intentType,
      activeEntity: this.activeEntity ? { ...this.activeEntity } : null,
      timestamp: Date.now(),
    });

    if (this.history.length > 20) {
      this.history.shift();
    }
  }

  requestClarification(topic, options = [], promptText = '') {
    this.pendingClarification = {
      topic,
      options: [...options],
      promptText,
      turn: this.turnCount,
    };
  }

  clearClarification() {
    this.pendingClarification = null;
  }

  clear() {
    this.history = [];
    this.activeEntity = null;
    this.pendingClarification = null;
    this.turnCount = 0;
    this.lastTopic = null;
  }

  toJSON() {
    return {
      history: this.history,
      activeEntity: this.activeEntity,
      pendingClarification: this.pendingClarification,
      turnCount: this.turnCount,
      lastTopic: this.lastTopic,
    };
  }
}

export function createLukasDiscourseContext(data = {}) {
  return new LukasDiscourseContext(data);
}

function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Detekce anaforických zájmen a zástupných odkazů
 */
export function containsAnaphoricReference(text) {
  const norm = normalize(text);
  return /(?:\b(?:on|ona|to|ho|mu|jeho|jej|tomu|toho|v nem|u neho|u toho|s nim|s ni|ten|ta|to|ty)\b|\b(?:cena|kolik to stoji|jak dlouho|jaky je (?:u toho )?postup|postup|jak to probiha|umite i|fotis i|vysvetli to|ukaz mi to|predved to|chci to)\b)/.test(norm);
}

/**
 * Detekce eliptického (zkráceného) dotazu
 */
export function isEllipticalQuery(text) {
  const norm = normalize(text);
  return /^(?:a\s+)?(?:cena|kolik|kolik\s+stoji|ceny|kalkulace|jak\s+dlouho|termin|cas|postup|proces|jak\s+to\s+funguje|jak\s+probiha|kontakt|ukazat|fotky|portrety|sport|agenti|agent|ai)[!?.]?$/.test(norm);
}

/**
 * Rozřešení anafory a elipsy na základě aktivní entity v diskurzu
 */
export function resolveAnaphoraAndEllipsis(text, context, graph = {}) {
  if (!context || !context.activeEntity) {
    return { handled: false, resolvedQuery: text, directAnswer: null };
  }

  const norm = normalize(text);
  const active = context.activeEntity;

  // 1. Zkrácený dotaz na cenu ("A cena?", "Kolik to stojí?", "A kolik?")
  const isPriceQuery = /(?:cena|kolik(?:\s+to\s+stoji|\s+stoji)?|kalkulace|rozpocet)/.test(norm);
  if (isPriceQuery && (isEllipticalQuery(text) || norm.length < 35)) {
    if (active.type === ENTITY_TYPES.SERVICE_SPORTS) {
      const answer = 'Cena sportovního focení se odvíjí od typu akce: focení jednotlivého zápasu (včetně rychlého výběru a úprav do 24 hodin pro klub či média), celodenního turnaje nebo dlouhodobé sezónní spolupráce. Napiš mi přes formulář nebo na lukas.drsticka@gmail.com a připravím ti přesnou kalkulaci 📋';
      return { handled: true, resolvedQuery: 'cena sportovního focení', directAnswer: answer, activeEntity: active };
    }
    if (active.type === ENTITY_TYPES.SERVICE_PORTRAITS) {
      const answer = 'Portrétní focení v ateliéru nebo exteriéru začíná u základního balíčku (cca 1–1,5 hodiny focení, vyretušované finální snímky v plném rozlišení). Pro konkrétní termín a nezávaznou cenovou nabídku stačí napsat zprávu přes formulář 📸';
      return { handled: true, resolvedQuery: 'cena portrétního focení', directAnswer: answer, activeEntity: active };
    }
    if (active.type === ENTITY_TYPES.SERVICE_AI_AGENTS) {
      const answer = 'Vývoj AI Hybridního Agenta je zakázková práce: od jednoduchého konverzačního průvodce pro menší firmu po komplexní řešení s hlasovým ovládáním, prováděním akcí na webu a napojením na interní systémy. Rád ti připravím nezávazný návrh na míru ⚡';
      return { handled: true, resolvedQuery: 'cena vývoje AI agenta', directAnswer: answer, activeEntity: active };
    }
  }

  // 2. Zkrácený dotaz na postup / jak to probíhá ("A postup?", "Jak dlouho to trvá?", "Jak to probíhá?")
  const isProcessQuery = /(?:jak\s+(?:to\s+)?probiha|postup|jak\s+dlouho|proces|kroky|harmonogram)/.test(norm);
  if (isProcessQuery && (isEllipticalQuery(text) || norm.length < 40)) {
    if (active.type === ENTITY_TYPES.SERVICE_SPORTS) {
      const answer = 'Při sportovním focení nejdříve sladíme termín zápasu a požadavky na výstupy. Po akci proběhne okamžitý culling (výběr nejlepších záběrů) a rychlá editace, aby byly fotky dostupné pro klubové sítě a tisk co nejdříve ⚡';
      return { handled: true, resolvedQuery: 'postup sportovního focení', directAnswer: answer, activeEntity: active };
    }
    if (active.type === ENTITY_TYPES.SERVICE_PORTRAITS) {
      const answer = 'Portrétní focení probíhá v pohodové atmosféře: nejdříve probereme tvou představu o stylu a lokalitě (ateliér v Přerově nebo exteriér), během focení pomohu s pózami a následně si vybereš snímky k finální retuši 📸';
      return { handled: true, resolvedQuery: 'postup portrétního focení', directAnswer: answer, activeEntity: active };
    }
    if (active.type === ENTITY_TYPES.SERVICE_AI_AGENTS) {
      const answer = 'Vývoj hybridního agenta probíhá ve 4 krocích: 1. Analýza tvého webu a cílů, 2. Příprava znalostní báze a akcí, 3. Implementace a ladění hlasu i konverzace, 4. Nasazení bez výpadku a zaškolení 🚀';
      return { handled: true, resolvedQuery: 'postup vývoje AI agenta', directAnswer: answer, activeEntity: active };
    }
  }

  // 3. Zkrácený dotaz na ukázky / galerii ("Ukaž mi to", "A fotky?", "A portfolio?")
  const isShowQuery = /(?:ukaz|ukazat|fotky|galerie|portfolio|ukazky)/.test(norm);
  if (isShowQuery && (isEllipticalQuery(text) || norm.length < 35)) {
    if (active.type === ENTITY_TYPES.SERVICE_SPORTS) {
      const answer = 'V portfoliu najdeš záběry z fotbalových bitev 1. FC Viktorie Přerov i prvoligové Sigmy Olomouc. Mám ti v portfoliu rovnou vyfiltrovat sportovní fotky? ⚽';
      return { handled: true, resolvedQuery: 'ukázky sportovní fotografie', directAnswer: answer, activeEntity: active };
    }
    if (active.type === ENTITY_TYPES.SERVICE_PORTRAITS) {
      const answer = 'Ukázky portrétů zahrnují ateliérovou tvorbu, festivalový styl i kreativní sérii s kouřovými efekty. Chceš, abych ti v portfoliu vyfiltroval portréty? 📸';
      return { handled: true, resolvedQuery: 'ukázky portrétů', directAnswer: answer, activeEntity: active };
    }
    if (active.type === ENTITY_TYPES.SERVICE_AI_AGENTS) {
      const answer = 'Nejlepší ukázka je přímo tady na webu – já sám jsem AI Hybridní Agent Lukáše Drštičky a umím web ovládat. Další ostrou realizací je klubová agentka Viktorka pro fotbalový web 1. FC Viktorie Přerov ⚡';
      return { handled: true, resolvedQuery: 'ukázky AI agentů', directAnswer: answer, activeEntity: active };
    }
  }

  return { handled: false, resolvedQuery: text, directAnswer: null };
}

/**
 * Opravné smyčky konverzace (Conversational Repair: "Ne, myslel jsem portréty", "Vlastně agenta")
 */
export function handleConversationalRepair(text, context, graph = {}) {
  const norm = normalize(text);

  const isSportsRepair = /^(?:ne(?:e+)?[,.]?\s+)?(?:myslel|myslim|myslela|chtel|chtela|vlastne|spis|radeji|ne)\s+(?:jsem\s+)?(?:sport|fotbal|zapasy|sportovni|viktork)/.test(norm);
  if (isSportsRepair) {
    context.setEntity(ENTITY_TYPES.SERVICE_SPORTS, 'Sportovní fotografie', { category: 'sports' });
    const reply = 'Jasně, přepínám na sportovní fotografii! ⚽ Lukáš fotí fotbalové zápasy Viktorie Přerov, turnaje i ligová utkání. Zajímá tě ceník, volné termíny, nebo si chceš prohlédnout fotky ze zápasů?';
    return { handled: true, text: reply, intent: 'repair_sports', activeEntity: context.activeEntity };
  }

  const isPortraitsRepair = /^(?:ne(?:e+)?[,.]?\s+)?(?:myslel|myslim|myslela|chtel|chtela|vlastne|spis|radeji|ne)\s+(?:jsem\s+)?(?:portret|portrety|atelier|foceni\s+lidi|rodinn)/.test(norm);
  if (isPortraitsRepair) {
    context.setEntity(ENTITY_TYPES.SERVICE_PORTRAITS, 'Portrétní fotografie', { category: 'portraits' });
    const reply = 'Rozumím, přecházíme na portrétní focení! 📸 Focení probíhá v ateliéru v Přerově nebo venku v exteriéru. Chceš se podívat na ceník, postup focení, nebo ukázky z portfolia?';
    return { handled: true, text: reply, intent: 'repair_portraits', activeEntity: context.activeEntity };
  }

  const isAgentsRepair = /^(?:ne(?:e+)?[,.]?\s+)?(?:myslel|myslim|myslela|chtel|chtela|vlastne|spis|radeji|ne)\s+(?:jsem\s+)?(?:agenta|agenty|ai|hybridni|framemind|umela\s+inteligence|chatbota)/.test(norm);
  if (isAgentsRepair) {
    context.setEntity(ENTITY_TYPES.SERVICE_AI_AGENTS, 'Vývoj AI Hybridních Agentů', { category: 'ai_agents' });
    const reply = 'Jasná věc, zaměříme se na AI Hybridní Agenty! ⚡ Vyvíjíme inteligentní rozhraní pro weby, která mluví, navigují a spouštějí akce. Zajímá tě, co všechno agent umí, jak probíhá vývoj, nebo nezávazná cena?';
    return { handled: true, text: reply, intent: 'repair_agents', activeEntity: context.activeEntity };
  }

  const isContactRepair = /^(?:ne(?:e+)?[,.]?\s+)?(?:myslel|myslim|myslela|chtel|chtela|vlastne|spis|radeji|ne)\s+(?:jsem\s+)?(?:kontakt|spojeni|email|telefon|lukase)/.test(norm);
  if (isContactRepair) {
    context.setEntity(ENTITY_TYPES.CONTACT, 'Kontakt a spojení', { category: 'contact' });
    const reply = 'Rozumím, pojďme rovnou ke kontaktu! ✉️ Lukášovi můžeš zavolat na +420 721 624 429, napsat na lukas.drsticka@gmail.com, nebo využít formulář níže na stránce. Mám formulář rovnou otevřít?';
    return { handled: true, text: reply, intent: 'repair_contact', activeEntity: context.activeEntity };
  }

  return { handled: false, text: null };
}

/**
 * Kontrola nejednoznačného dotazu vyžadujícího dovyjasnění
 */
export function checkAmbiguousClarification(text, context) {
  const norm = normalize(text);

  // Obecný dotaz na cenu bez předchozího kontextu
  const isBarePriceQuery = /^(?:kolik\s+to\s+stoji|kolik\s+stoji|jaka\s+je\s+cena|cena|ceny|cenik|kalkulace)[!?.]?$/.test(norm);
  if (isBarePriceQuery && (!context.activeEntity || context.activeEntity.type === ENTITY_TYPES.PRICING)) {
    context.requestClarification('pricing_category', ['sport', 'portret', 'ai_agent'], 'Zajímá tě cena sportovního focení, ateliérových portrétů, nebo vývoj AI agenta?');
    return {
      handled: true,
      text: 'Rád ti cenu upřesním 📋 Lukáš nabízí sportovní fotografii, ateliérové i exteriérové portréty a vývoj AI Hybridních Agentů na míru. Kterou oblast máš na mysli?',
      intent: 'clarification_requested',
    };
  }

  return { handled: false, text: null };
}

/**
 * Zpracování reakce na vyžádané dovyjasnění
 */
export function handleClarificationResponse(text, context, graph = {}) {
  if (!context || !context.pendingClarification) {
    return { handled: false, text: null };
  }

  const norm = normalize(text);
  const clar = context.pendingClarification;

  if (clar.topic === 'pricing_category') {
    if (/(?:sport|fotbal|zapas|turnaj)/.test(norm)) {
      context.clearClarification();
      context.setEntity(ENTITY_TYPES.SERVICE_SPORTS, 'Sportovní fotografie', { category: 'sports' });
      return {
        handled: true,
        text: 'U sportovní fotografie se cena kalkuluje podle délky a typu akce (zápas, celodenní turnaj nebo dlouhodobá klubová spolupráce). V ceně je rychlý výběr a úprava snímků do 24 hodin. Pro přesnou nabídku mi napiš přes formulář ⚽',
        intent: 'clarification_resolved_sports_pricing',
      };
    }
    if (/(?:portret|atelier|exterier|lidi|rodin)/.test(norm)) {
      context.clearClarification();
      context.setEntity(ENTITY_TYPES.SERVICE_PORTRAITS, 'Portrétní fotografie', { category: 'portraits' });
      return {
        handled: true,
        text: 'U portrétního focení (ateliér v Přerově i venku) cena zahrnuje focení i finální vyretušované snímky v plné kvalitě. Napiš mi svou představu a připravím ti nezávaznou nabídku 📸',
        intent: 'clarification_resolved_portraits_pricing',
      };
    }
    if (/(?:ai|agent|hybridni|framemind|inteligence|web)/.test(norm)) {
      context.clearClarification();
      context.setEntity(ENTITY_TYPES.SERVICE_AI_AGENTS, 'Vývoj AI Hybridních Agentů', { category: 'ai_agents' });
      return {
        handled: true,
        text: 'U vývoje AI Hybridního Agenta závisí cena na funkcích: zda potřebuješ základního průvodce, nebo pokročilého agenta s hlasem a přímým ovládáním webu. Rád proberu tvůj projekt nezávazně ⚡',
        intent: 'clarification_resolved_agent_pricing',
      };
    }
  }

  return { handled: false, text: null };
}

/**
 * Generování dynamických doporučených dotazů (Suggested Follow-up Chips)
 */
export function generateSuggestedFollowUps(userQuery, replyText, context, graph = {}) {
  const norm = normalize(userQuery);
  const active = context?.activeEntity;

  if (context?.pendingClarification?.topic === 'pricing_category') {
    return [
      'Sportovní focení',
      'Portrétní focení',
      'AI Hybridní Agent',
    ];
  }

  if (active?.type === ENTITY_TYPES.SERVICE_SPORTS || /(?:sport|fotbal|zapas|viktork|sigma)/.test(norm)) {
    return [
      'Kolik stojí sportovní focení?',
      'Jak probíhá spolupráce?',
      'Ukaž sportovní fotky',
    ];
  }

  if (active?.type === ENTITY_TYPES.SERVICE_PORTRAITS || /(?:portret|atelier|exterier|rodinn)/.test(norm)) {
    return [
      'Kolik stojí portrétní focení?',
      'Kde focení probíhá?',
      'Ukaž portréty',
    ];
  }

  if (active?.type === ENTITY_TYPES.SERVICE_AI_AGENTS || /(?:ai|agent|hybridni|framemind)/.test(norm)) {
    return [
      'Co všechno hybridní agent umí?',
      'Kolik stojí vývoj agenta?',
      'Jak probíhá realizace?',
    ];
  }

  if (/(?:cena|kolik|cenik|kalkulace)/.test(norm)) {
    return [
      'Jak probíhá spolupráce?',
      'Ukaž portfolio',
      'Kontaktovat Lukáše',
    ];
  }

  return [
    'Sportovní fotografie',
    'Portréty a ateliér',
    'Vývoj AI agentů',
  ];
}
