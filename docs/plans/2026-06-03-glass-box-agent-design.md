# Glass-box agentic web — návrh (pilot FrameMind)

**Datum:** 2026-06-03
**Kontext:** Hybridní agent na osobním webu se stává pilotním/referenčním projektem startupu FrameMind. Cíl není „web bez klikání" jako samoúčel, ale **prodejný, přenositelný produkt**: embeddable agent, který jde nasadit na jakýkoliv web jako šablona.

## Strategická teze (proč glass-box)

Agentický web je v 2026 přeplněný (OpenAI Atlas Agent Mode, Perplexity Comet, Chrome auto-browse, Google A2UI, CopilotKit). First-mover výhoda v *konceptu* neexistuje. Tři reálné mezery na trhu:

1. **Černá skříňka → nedůvěra.** Velcí dělají akce neviditelně. 2026 = „rok důvěry k AI agentům", hlavní problém je trust gap.
2. **„Chatbot-first" zabíjí adopci.** Nahradit klikací GUI chatem selhává; vítězí augmentace (GUI zůstane, agent ho řídí).
3. **Hlas neumí přirozené přerušení (barge-in).**

**Diferenciace = opak černé skříňky:** agent ovládá **skutečné, viditelné UI před uživatelem**, říká co dělá, jde kdykoliv **přerušit hlasem nebo myší**. Prodejní story pro enterprise: *jediný agent, kterému vidíš pod ruce a můžeš ho zastavit* (= continuous verify, co enterprise v 2026 řeší).

## Rozsah (po zúžení se zadavatelem)

**3 pilíře** (účtenka před akcí vypuštěna — zápis = jen předvyplnění kontaktního formuláře):

1. Ghost kurzor + spotlight („koukej, jak to dělám")
2. Převzetí řízení (uživatel kdykoliv chytne myš/klávesu, agent ustoupí)
3. Barge-in hlas (skočíš do řeči, agent se zastaví a poslouchá)

Plus dva průřezové požadavky:
- **Grounding** — agent čerpá fakta jen z obsahu webu, nic vymyšleného; slušně odpoví na obecné dotazy, ale **technické/programátorské dotazy nadále odmítá** (guardrail beze změny).
- **Šablona** — snadno přenositelné na další weby.

## Architektura

### Princip: jeden obal, žádný guláš

Vše dnes prochází jediným místem — `chatbotExecuteToolCall({tool, args})` (`src/js/chatbot.js`, ~ř. 1647). Chat i tour tečou skrz něj. Glass-box stavíme jako **obal**, ne přepis.

```
dnes:  model → chatbotExecuteToolCall(tool,args) → CHATBOT_TOOL_HANDLERS[tool]()
nově:  model → chatbotRunAction(tool,args) → [pipeline] → chatbotExecuteToolCall(...)
```

`chatbotRunAction` = async wrapper, 5 fází na akci:

1. **resolve** — `chatbotResolveTarget(tool,args)` → cílový DOM prvek (selektory jsou v adapteru, ne v enginu)
2. **gate** — (zjednodušeno) zápis = jen `prefill_contact_form`, žádná blokující účtenka
3. **point** — ghost kurzor + spotlight na cíl (pilíř 1)
4. **execute** — původní `chatbotExecuteToolCall` beze změny
5. **settle** — pauza; po dobu fází 3–5 běží **interrupt watcher** (pilíře 2 a 3)

`tour` i běžný chat přepneme z přímého `chatbotExecuteToolCall` na `chatbotRunAction` → všechny pilíře platí všude.

### Engine vs. Adapter (= šablona)

Tvrdá hranice, která se nikdy nepřekročí:

**FrameMind Engine** (`engine/`, site-agnostic, nemění se mezi weby)
- pipeline `chatbotRunAction` (resolve → point → execute → settle + interrupt watcher)
- ghost kurzor, spotlight, HUD, hlas, barge-in, převzetí řízení
- generický dispatcher — **nezná ani jeden selektor konkrétního webu**

**Site Adapter** (per web — tohle je ta „šablona")
- `site.manifest.json` — sekce, selektory, služby, kategorie galerie, pole formuláře
- mapování `tool → jak na tomhle webu najít cíl`
- `knowledgeSources` — odkaz na datové zdroje webu (grounding)

Drop na nový web = jeden manifest (nebo vygenerovaný z webu) + `<script>` engine. V enginu se nezmění řádek.
Osobní web = **první adaptér** = referenční implementace.

**Anti-guláš test:** ve složce `engine/` nesmí být ani jeden výskyt `#kontakt`, `sport-12`, `data-service`. Když tam je, vracíme zpět.

### Grounding (kontext z webu, nic vymyšleného)

1. **Zdroj pravdy = data webu**, ne ručně psaná próza. Adapter deklaruje `knowledgeSources` = reálné datové soubory (`portfolio.json` jako zdroj pravdy galerií, ceník, služby).
2. **CONTEXT blok per-dotaz** — nová `buildContext(manifest)` na backendu složí krátký CONTEXT z deklarovaných zdrojů, vloží do promptu. Model: *fakta výhradně z CONTEXT; co tam není, neexistuje.*
3. **Mantinely v promptu** (zpřísnění stávajících):
   - Fakt (cena, termín, reference) → jen z CONTEXT, jinak „přesně řekne Lukáš po konzultaci" + akce.
   - Návrh/obecná praxe → povolené, **vždy označené jako návrh**.
   - Technické/programátorské dotazy → slušně odmítnout (beze změny).

**Anti-guláš test:** backend nikde nehardcoduje fakta — všechna jdou přes `buildContext`.

## Pilíře — implementace

**Pilíř 1 — Ghost kurzor + spotlight** (fáze `point`)
Plovoucí kurzor (1 absolutně poziční prvek) animuje na `boundingRect` cíle, ztlumí okolí, rozsvítí prstenec, pak `execute`. Recykluje stávající highlight CSS. Aditivní, nulové riziko.

**Pilíř 3 — Převzetí řízení** (interrupt watcher)
Během agentova tahu hlídáme *reálnou* aktivitu (mousedown/keydown/wheel). Agentovy akce mají příznak, aby se nehlídaly samy. Reálný vstup → pauza + „Pokračovat / Hotovo". Watcher pak sdílí pilíř 2.

**Pilíř 2 — Barge-in hlas** (staví na watcheru z pilíře 3)
Web Speech API poslouchá, dokud agent mluví/jedná. Detekce řeči → stop přehrávání + abort + poslech + transkript jako nový tah.
**Poctivě:** Gemini TTS nestreamuje → pravý sub-500ms barge-in nedáme. Reálné = „promluvíš, agent se zastaví". Bez mikrofonu fallback = viditelné Stop (z tour).

## Pořadí nasazení (každý krok = samostatný merge)

1. **Základ** — engine/adapter split + grounding. Neviditelné, ale nezbytné.
2. **Pilíř 1** — ghost kurzor (nejviditelnější wow, nejmenší riziko).
3. **Pilíř 3** — převzetí řízení (postaví watcher).
4. **Pilíř 2** — barge-in (recykluje watcher).

## Dotčené soubory (výchozí mapa)

- `src/js/chatbot.js` — `chatbotExecuteToolCall`, `CHATBOT_TOOL_HANDLERS`, tour sekvencer → obalit `chatbotRunAction`
- `netlify/functions/_lib/tools.mjs` — tool manifest + system prompt (grounding)
- `netlify/functions/tour.mjs`, `chat` funkce — číst manifest/CONTEXT
- nově: `engine/` (jádro), `site.manifest.json` (adaptér), `buildContext` na backendu
- pozor: cache-bust řetězec (boot → core → chatbot `?v=`) bumpnout po každé změně chatbot.js
