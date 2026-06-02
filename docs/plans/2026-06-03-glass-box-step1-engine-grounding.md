# Glass-box Krok 1 — Engine/Adapter šev + grounding (Implementation Plan)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Zavést logickou hranici engine/adapter a grounding z dat webu — beze změny viditelného chování (čistá příprava na pilíře).

**Architecture:** Vše prochází `chatbotExecuteToolCall`. Přidáme nad něj `chatbotRunAction` (zatím průchozí), site specifika vytáhneme do konstanty `CHATBOT_SITE_MANIFEST` a resolveru `chatbotResolveTarget`. Backend dostane `buildContext` skládající fakta z reálných dat webu. Žádné fyzické rozdělení souborů, žádné nové build skripty.

**Tech Stack:** Vanilla JS (IIFE) `src/js/chatbot.js`, Netlify Functions `netlify/functions/*`, esbuild (`npm run build:js`). Ověření: `node -c` + ruční browser smoke.

**Pravidla:** DRY, YAGNI, malé commity. Po každé změně `chatbot.js` bumpnout cache-bust `?v=` (boot→core→chatbot) — ale až v posledním kroku před smoke testem, ne u každého dílčího commitu. Větev: `feat/glass-box-engine`.

---

## ČÁST A — Frontend šev (behavior-preserving)

### Task 1: Site manifest (adaptér jako in-file konstanta)

**Files:**
- Modify: `src/js/chatbot.js` (přidat konstantu poblíž ostatních `CHATBOT_*` konstant na začátku IIFE)

**Step 1:** Projít stávající handlery (`CHATBOT_TOOL_HANDLERS`, ~ř. 1502–1645) a `chatbotScrollToSection`/`chatbotApplyPortfolioFilter`/`chatbotHighlightSelector`/`chatbotOpenPortfolioProject` a vypsat všechna natvrdo zadaná site specifika (mapy sekcí, highlight enum `pricing|portfolio-grid|contact-form|skills-grid|showreel`, `[data-service]`, `#contactStatus`, `sport-12`, `#portfolio-stats`, `#availability`).

**Step 2:** Přidat konstantu:

```js
var CHATBOT_SITE_MANIFEST = {
  sections: ['portfolio', 'skills', 'o-mne', 'spoluprace', 'kontakt', 'hybridni-agent'],
  highlightTargets: {
    pricing: '#pricing, [data-section="pricing"]',
    'portfolio-grid': '#portfolio-grid, [data-portfolio-grid]',
    'contact-form': '#kontakt form, [data-contact-form]',
    'skills-grid': '#skills-grid, [data-skills-grid]',
    showreel: '#showreel, video[data-showreel]'
  },
  serviceCardSelector: function (service) { return '[data-service="' + service + '"]'; },
  contactStatusId: 'contactStatus',
  portfolioStatsId: 'portfolio-stats',
  availabilityId: 'availability',
  latestProjectId: 'sport-12'
};
```

> Skutečné selektory dohledat v `index.html` — nehádat. Hodnoty výše jsou výchozí, ověřit proti DOM.

**Step 3:** Ověřit syntax: `node -c src/js/chatbot.js` → Expected: bez chyby.

**Step 4:** Commit: `git add src/js/chatbot.js && git commit -m "refactor(agent): site manifest konstanta (adaptér šev)"`

---

### Task 2: `chatbotResolveTarget(tool, args)` — čistý resolver

**Files:**
- Modify: `src/js/chatbot.js` (nová funkce před `CHATBOT_TOOL_HANDLERS`)

**Step 1:** Přidat funkci, která z `tool`+`args` vrátí cílový DOM `Element|null` pomocí manifestu (žádné side-efekty):

```js
function chatbotResolveTarget(tool, args) {
  args = args || {};
  var M = CHATBOT_SITE_MANIFEST;
  switch (tool) {
    case 'scroll_to': return chatbotSectionEl(args.section);
    case 'highlight_element': return document.querySelector(M.highlightTargets[args.target] || '');
    case 'filter_gallery': return chatbotSectionEl('portfolio');
    case 'show_pricing':
    case 'compare_services': return document.querySelector(M.highlightTargets.pricing);
    case 'prefill_contact_form':
    case 'send_inquiry': return document.querySelector(M.highlightTargets['contact-form']);
    case 'show_portfolio_stats': return document.getElementById(M.portfolioStatsId);
    case 'check_availability': return document.getElementById(M.availabilityId);
    default: return null;
  }
}
```

> `chatbotSectionEl` = malý helper vracející element sekce (vytáhnout ze stávající logiky `chatbotScrollToSection`, ať se neduplikuje). DRY.

**Step 2:** `node -c src/js/chatbot.js` → bez chyby. Resolver zatím nikdo nevolá → chování beze změny.

**Step 3:** Commit: `git commit -am "feat(agent): chatbotResolveTarget resolver z manifestu"`

---

### Task 3: `chatbotRunAction` wrapper + přepojení tour a chatu

**Files:**
- Modify: `src/js/chatbot.js` (`chatbotExecuteActions` ~ř.1654, `chatbotTourRun` ~ř.1820)

**Step 1:** Přidat průchozí wrapper (zatím jen resolve bez vizuálu — připraveno pro pilíř 1):

```js
function chatbotRunAction(tool, args) {
  // FÁZE resolve (výsledek zatím nevyužit — pilíř 1 sem doplní ghost kurzor)
  try { chatbotResolveTarget(tool, args); } catch (e) {}
  // FÁZE execute (beze změny)
  chatbotExecuteToolCall({ tool: tool, args: args || {} });
}
```

**Step 2:** V `chatbotExecuteActions` a v `chatbotTourRun` nahradit přímé `chatbotExecuteToolCall({tool, args})` voláním `chatbotRunAction(tool, args)`. (Samotnou definici `chatbotExecuteToolCall` nechat být.)

**Step 3:** `node -c src/js/chatbot.js` → bez chyby.

**Step 4:** Bumpnout cache-bust `?v=` v `index.html` pro chatbot (a řetězec boot→core→chatbot dle potřeby), `npm run build:js`.

**Step 5 (ověření — browser smoke, dělá Lukáš):**
- `npm run dev`, hard refresh.
- Chat: napsat „ukaž portfolio" → scroll+filtr funguje jako dřív.
- Tour: ▶ Živá ukázka → proběhne celá jako dřív (mluví + ovládá).
- Žádná regrese v konzoli.

**Step 6:** Commit: `git commit -am "feat(agent): chatbotRunAction wrapper, tour+chat přepojeny"`

---

## ČÁST B — Grounding (backend)

> Před implementací PŘEČÍST: aktuální chat funkci v `netlify/functions/` a najít, odkud teď bere fakta (knowledge base). Teprve pak psát `buildContext`. Nehádat zdroj.

### Task 4: `buildContext(manifest)` z reálných dat webu

**Files:**
- Create/Modify: `netlify/functions/_lib/context.mjs` (nebo do existujícího _lib, dle struktury)
- Modify: chat funkce (vložení CONTEXT bloku do promptu)

**Step 1:** Zjistit zdroje pravdy (`portfolio.json`, ceník, služby) a jejich cesty.

**Step 2:** `buildContext()` složí krátký textový CONTEXT blok z těchto dat (jméno, služby, kategorie portfolia, orientační ceny, dostupnost) — jen fakta, žádná próza navíc.

**Step 3:** Vložit CONTEXT do system/user promptu chat funkce před voláním modelu.

**Step 4 (ověření):** lokální/`curl` dotaz „jaké nabízíš služby?" → odpověď čerpá z dat; dotaz na neexistující fakt → agent řekne, že to upřesní Lukáš (nevymýšlí).

**Step 5:** Commit: `git commit -am "feat(agent): buildContext grounding z dat webu"`

---

### Task 5: Zpřísnit mantinely v system promptu

**Files:**
- Modify: `netlify/functions/_lib/tools.mjs` (`ACTIONS_SYSTEM_PROMPT`) + prompt chat funkce

**Step 1:** Doplnit/zostřit:
- Fakta výhradně z CONTEXT; co tam není, agent neuvádí jako fakt, nabídne konzultaci + akci.
- Na obecné/nefaktické dotazy odpovídá slušně a užitečně.
- Technické/programátorské dotazy nadále slušně odmítá (beze změny stávajícího pravidla).

**Step 2 (ověření):** dotaz mimo data → slušná odpověď bez výmyslu; technický dotaz → odmítnutí + návrat k focení/spolupráci.

**Step 3:** Commit: `git commit -am "feat(agent): zpřísněné grounding mantinely v promptu"`

---

## Hotovo když
- Chat i tour fungují přesně jako před krokem 1 (vizuálně beze změny).
- `engine` logika (`chatbotRunAction`/`chatbotResolveTarget`) nezná žádný site fakt mimo `CHATBOT_SITE_MANIFEST`.
- Backend nikde nehardcoduje fakta o Lukášovi — jdou přes `buildContext`.
- Agent nevymýšlí; technický guardrail beze změny.
- Vše na větvi `feat/glass-box-engine`, merge do main až po Lukášově smoke OK.
