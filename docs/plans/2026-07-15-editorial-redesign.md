# Editorial Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Full overhaul osobního webu na foto-editorial „monografii" — vizuál + copy + struktura, agent nedotčen.

**Architecture:** Vanilla HTML (index.html, 1163 ř.) + Tailwind 3 build (src/css/main.css → dist/css/styles.min.css) + esbuild moduly (src/js → dist/js). Přepis po sekcích, každá sekce = commit. i18n je poziční (i18n.js setTexts podle indexů) — každá změna DOM vyžaduje současný update selector map + COPY arrays.

**Tech Stack:** Tailwind 3.4, esbuild, Lenis 1.3 (v deps), split-type 0.3 (v deps), Fraunces variable (nový self-hosted font), Geist (stávající).

---

## TVRDÝ KONTRAKT — ID která NESMÍ zmizet z index.html

JS moduly se na ně vážou (`getElementById`). Po každé změně sekce ověřit greppem.

| Oblast | ID |
|---|---|
| Sekce | `hero`, `hybridni-agent`, `portfolio`, `o-mne`, `spoluprace`, `kontakt` |
| Hero agent | `hero-input`, `hero-send`, `hero-messages`, `hero-quick-replies`, `hero-speech-toggle`, `hero-chat-helper`, `hero-tour-btn` |
| Agent panel | `agent-mode-badge`, `agent-summary`, `agent-intent`, `agent-steps`, `agent-artifact-title`, `agent-artifact-body`, `agent-cta` |
| Voice | `voice-call-btn`, `voice-overlay`, `voice-orb`, `voice-timer`, `voice-hangup`, `voice-transcript`, `voice-status` |
| Widget | `chatBtn`, `chatWindow`, `chatInput`, `sendBtn`, `closeChat`, `clearChat`, `messages`, `quickReplies`, `unreadBadge`, `chat-mode-badge`, `widget-speech-toggle`, `chatbot-email-fallback` |
| Tour cíle | `showreel`, `portfolio-stats`, `availability`, `portfolioGrid` |
| UI chrome | `themeToggle`, `themeToggleMobile`, `mobileMenuBtn`, `mobileMenu`, `mobileMenuClose`, `scrollProgress`, `cursorSpotlight`, `announcer` |
| Kontakt | `contactForm`, `contactStatus`, `contactName`, `contactEmail`, `contactService`, `contactMessage`, `contactNameError`, `contactEmailError`, `contactServiceError`, `contactMessageError`, `aiSuggestions`, `availability` |
| Footer/misc | `newsletterForm`, `newsletterStatus`, `newsletterEmail`, `lightbox`, `lightboxImg`, `closeLightbox`, `lightboxControls`, `lightboxPrev`, `lightboxNext`, `testimonialsSlider`, `prevTestimonial`, `nextTestimonial` |

Kontrolní příkaz po každé HTML změně (má vypsat 0 chybějících):

```powershell
$ids = 'hero','hybridni-agent','portfolio','o-mne','spoluprace','kontakt','hero-input','hero-send','hero-messages','hero-quick-replies','hero-speech-toggle','hero-chat-helper','hero-tour-btn','agent-mode-badge','agent-summary','agent-intent','agent-steps','agent-artifact-title','agent-artifact-body','agent-cta','voice-call-btn','voice-overlay','voice-orb','voice-timer','voice-hangup','voice-transcript','voice-status','chatBtn','chatWindow','chatInput','sendBtn','closeChat','clearChat','messages','quickReplies','unreadBadge','chat-mode-badge','widget-speech-toggle','chatbot-email-fallback','showreel','portfolio-stats','availability','portfolioGrid','themeToggle','themeToggleMobile','mobileMenuBtn','mobileMenu','mobileMenuClose','scrollProgress','cursorSpotlight','announcer','contactForm','contactStatus','contactName','contactEmail','contactService','contactMessage','newsletterForm','newsletterStatus','newsletterEmail','lightbox','lightboxImg','closeLightbox','lightboxControls','lightboxPrev','lightboxNext'
$html = Get-Content index.html -Raw
$ids | Where-Object { $html -notmatch "id=`"$_`"" }
```

Pozn.: pokud sekci vědomě ruším (testimonials?), smím ID odstranit JEN pokud zároveň ověřím, že JS má null-guard (core.js testimonials má `if (!slider) return` vzor — ověřit).

## Další nedotknutelné

- Netlify Forms atributy na `contactForm` + `newsletterForm` (`data-netlify`/`name`) — nechat 1:1.
- Necommitnuté změny v working tree (AI transparency + privacy.html) — zachovat, commitnou se s hero taskem.
- `netlify/functions/**` — nesahat.
- CSP v netlify.toml — nesahat (fonty self-hosted).
- portfolio.json pipeline + `<picture>` AVIF/WebP markup v portfolio.js.

---

### Task 1: Fraunces font + design tokeny

**Files:**
- Create: `dist/fonts/Fraunces-Variable.woff2` (stáhnout z fonts.gstatic.com — jednorázově, pak self-hosted)
- Modify: `src/css/main.css` (@font-face vedle Geist ř.14; `:root` tokeny)

**Step 1:** Stáhnout Fraunces variable woff2 (Google Fonts API v2, `Invoke-WebRequest` s UA moderního prohlížeče pro woff2 URL). Ověřit velikost < 200 kB.

**Step 2:** Do main.css přidat @font-face (`font-family: 'Fraunces'; font-weight: 100 900; font-display: swap`) + tokeny:

```css
:root {
  --paper: #ece8e1;
  --darkroom: #0d0e10;
  --signal: #4ea2e0;
  --font-display: 'Fraunces', Georgia, serif;
}
```

(pozor: `--font-display` už existuje — přepsat hodnotu, ne duplikovat)

**Step 3:** `npm run build:css` → bez erroru, `dist/css/styles.min.css` obsahuje `Fraunces`.

**Step 4:** Commit `feat(design): Fraunces + editorial tokeny`.

### Task 2: Editorial základ — grain, pasparta, muzejní štítky, utility

**Files:**
- Modify: `src/css/main.css`

**Step 1:** Přidat: statický SVG grain (malá dlaždice ~200px, feTurbulence, opacity ≤ 0.05, `body::after`, `pointer-events:none`), `.exhibit-frame` (pasparta: border + padding + offset outline), `.museum-label` (malý mono/caps štítek — JetBrainsMono už self-hosted), `.chapter-num` (velké serif číslo kapitoly), `.editorial-headline` (clamp až 8rem, Fraunces, tight leading). Light-mode varianty přes stávající theme mechanismus (zjistit: `.light` třída nebo `data-theme` — grep v main.css, přizpůsobit se).

**Step 2:** `npm run build:css` OK.

**Step 3:** Commit `feat(design): editorial základ (grain, pasparta, štítky)`.

### Task 3: Hero — fullbleed fotka + claim

**Files:**
- Modify: `index.html:418-505` (section#hero), header/nav texty
- Vybrat hero fotku z `dist/images/` (sport, širokoúhlá, ostrá — vybrat největší akční záběr; `<picture>` AVIF/WebP/JPG + `fetchpriority="high"`)

**Step 1:** Přepsat hero: fullbleed `<picture>` pozadí s tmavým gradient overlayem zdola, editorial headline claim („Fotím sport a portréty. A stavím AI, která pracuje za mě." — finální znění per design doc), pod ním stávající hero-chat blok BEZE ZMĚNY ID (hero-input, hero-send, hero-messages, hero-quick-replies, hero-speech-toggle, hero-chat-helper, hero-tour-btn, voice-call-btn + transparency řádek). Odstranit particle canvas (grep `hero-particles`/`particles-canvas` v hero markupu). 1 primární CTA („Domluvit focení" → #kontakt), sekundární text link na #portfolio.

**Step 2:** ID kontrakt check (příkaz výše) → 0 chybějících.

**Step 3:** Commit `feat(hero): fullbleed editorial hero`.

### Task 4: Portfolio — editorial grid + muzejní štítky

**Files:**
- Modify: `index.html:566-792` (section#portfolio)
- Modify: `src/js/portfolio.js:176+` (markup karet — přidat museum-label, pasparta třídy)

**Step 1:** Sekce dostane kapitolovou hlavičku („01 — Vybraná práce"), filtry zůstávají (Vše/Fotografie/AI), `portfolioGrid` zůstává, `portfolio-stats` + `showreel` zůstávají (tour cíle!). Grid: asymetrický editorial (CSS grid, střídání velkých/malých buněk).

**Step 2:** portfolio.js karta: obal `.exhibit-frame`, pod fotkou `.museum-label` (název · datum · místo z portfolio.json polí). Lightbox nechat.

**Step 3:** `npm run build` OK + ID check.

**Step 4:** Commit `feat(portfolio): editorial grid + muzejní štítky`.

### Task 5: Sekce Hybridní agent — vysvětlení + důkaz

**Files:**
- Modify: `index.html:506-565` (section#hybridni-agent)

**Step 1:** Kapitola „02 — Hybridní agent". Copy: postavil jsem ho sám, jak funguje (píše, mluví, naviguje web), 3 příklady otázek (kliknutelné — použít stávající quick-reply mechanismus `data-value`), CTA „Zeptej se ho" (otevře widget — stávající chování `hybridni-agent` scroll/chatBtn). Agent panel ID zachovat (agent-*).

**Step 2:** ID check.

**Step 3:** Commit `feat(agent): sekce vysvětluje agenta jako živý důkaz`.

### Task 6: Skills → O mně (příběh) + Služby s deliverables

**Files:**
- Modify: `index.html:793-1022` (skills sekce PRYČ, o-mne přepsat, nová sekce sluzby, spoluprace update)

**Step 1:** Smazat skill bary s procenty. Sekce `o-mne` = příběh (foto → AI, Přerov, Viktorka) + fakta řádkem (roky, počty galerií — reálná čísla z portfolio.json spočítat). POZOR: pokud skills sekce obsahuje tour cíl nebo JS hook, přesunout ID jinam, ne smazat.

**Step 2:** Nová sekce `sluzby` (id nový — JS na něj nevisí): 3 karty — Focení zápasů / Portréty / AI & web na míru, každá s „co dostanete" (počet fotek, dodání, formát — **znění nechat schválit Lukášem, nevymýšlet ceny**). Nav odkaz „Dovednosti" → „Služby".

**Step 3:** Spolupráce: Viktorka + reálná čísla (počet galerií ze `data/portfolio.json`).

**Step 4:** ID check + build.

**Step 5:** Commit `feat(content): o mně příběh, služby s deliverables, skill bary pryč`.

### Task 7: Kontakt + footer restyle

**Files:**
- Modify: `index.html:1023-1260`

**Step 1:** Kontakt: editorial dvousloupec (velký claim vlevo, form vpravo). `contactForm` + pole ID + Netlify Forms atributy 1:1. `availability` zachovat (tour cíl).

**Step 2:** Footer: zeštíhlit, newsletter zachovat (newsletterForm/Status/Email), copyright, tech-stack řádek nechat.

**Step 3:** ID check + build.

**Step 4:** Commit `feat(contact): editorial kontakt + footer`.

### Task 8: i18n — nové COPY + selector mapy

**Files:**
- Modify: `src/js/i18n.js` (COPY cs+en ř.20-51 + aplikační mapování ř.120-232)

**Step 1:** Přečíst celé aplikační mapování (co selektuje, v jakém pořadí). Přepsat COPY arrays podle nového DOM (nové sekce, nové texty CZ+EN — EN překlad kvalitní, ne strojový). Odstranit skills/process klíče pokud sekce zrušeny, přidat services.

**Step 2:** `npm run build:js` OK.

**Step 3:** Manuální check bodu: po buildu otevřít lokálně a přepnout EN — žádný český text nesmí zůstat, žádný `undefined`. (Rychlý sanity: `npx serve .` + oko. Bez Playwrightu — Lukáš finálně testuje sám.)

**Step 4:** Commit `feat(i18n): copy CZ+EN pro editorial redesign`.

### Task 9: Motion — Lenis + split-text + clip-path reveals

**Files:**
- Create: `src/js/editorial.js` (nový modul: Lenis init, split-type headline reveal, IntersectionObserver clip-path reveal fotek, jemný parallax)
- Modify: `scripts/build-js.js:14` (modules: + `editorial`, − `hero-particles`)
- Modify: `index.html` (script tag `editorial.min.js`, smazat tag hero-particles pokud existuje; zkontrolovat i boot.js dynamické loady — grep `hero-particles` v src/js/boot.js)

**Step 1:** editorial.js: import Lenis + SplitType z node_modules (esbuild bundluje). Vše za `prefers-reduced-motion` guard. Žádná animace grain.

**Step 2:** cinematic.js hookuje #hero — přečíst, rozhodnout: nechat/vypnout (pokud dělá parallax duplicitní s editorial.js, vyřadit z buildu i HTML).

**Step 3:** `npm run build` OK, ID check.

**Step 4:** Commit `feat(motion): Lenis + split-text reveals, hero-particles pryč`.

### Task 10: SEO/meta + hygiena + deploy

**Files:**
- Modify: `index.html` head (title, description, OG, twitter, JSON-LD), `llms.txt`, `ai.txt` (sladit copy)
- Modify: cache-bust verze: `styles.min.css?v=41→42`, `boot.min.js?v=47→48`, vnitřní verze v boot.js/core.js (grep `?v=` v src/js — celý řetěz bumpnout)

**Step 1:** Meta přepsat na nový claim (positioning: osobní web fotografa + AI developera, NE FrameMind). JSON-LD Person/services aktualizovat.

**Step 2:** Bump všech `?v=`. `npm run build`. ID check finální.

**Step 3:** Commit `chore: meta + cache bump v42/v48`.

**Step 4:** Push `feat/editorial-redesign`, otevřít PR (gh pr create). Merge po Lukášově vizuální kontrole — NEBO rovnou merge do main (Lukáš preferuje prod-check; deploy preview nemá GEMMA_API_KEY, ale na vizuál stačí). **Zeptat se Lukáše: preview vs rovnou prod.**

**Step 5:** Po deploy: ověřit live URL curl (200, nový title), Lukáš testuje okem. Žádné Playwright smyčky.

---

## Rizika

1. **i18n poziční mapy** — největší riziko. Task 8 dělat pečlivě, číst mapování celé.
2. **Tour choreografie** (chatbotTour v chatbot.js + tour.mjs) čeká sekce v určitém pořadí — po Task 6 (rušení skills) projít tour kroky, případně upravit captions/cíle.
3. **Light mode** — web má themeToggle; editorial paleta musí mít light variantu (papír světlý, inkoust tmavý). Netestovat jen dark.
4. **Agent čte DOM** (hybridní agent = živý kontext) — nové sekce si přečte sám, ale zkontrolovat chat.mjs `PUBLIC_KNOWLEDGE`/fast-path texty, jestli neodkazují na zrušené sekce (skill bary, proces) — pokud ano, minimální update knowledge (ne mechaniky).
