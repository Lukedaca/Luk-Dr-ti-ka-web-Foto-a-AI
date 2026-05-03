# Hybridní AI agent — design

**Datum:** 2026-04-25
**Status:** Schváleno k implementaci
**Cíl:** Rozšířit existující Gemma 4 chatbot na hybridní agenta (Gemma 4 + GPT 5.4 mini), přidat tool calling pro 21 akcí, zabezpečit proti botům a útokům, a doplnit učící systém.

## Kontext

Existující stav (k 2026-04-25):
- `netlify/functions/chat.mjs` — Gemma 4 streaming chatbot (NDJSON), 3 módy talk/think/build, fast-path keyword odpovědi, action tagy `[[ACTION:scroll:portfolio]]`, rate limit 20/min/IP
- `netlify/functions/voice-token.js` + `tts.js` + `src/js/voice.js` — voice asistent
- `src/js/chatbot.js` — sofistikovaný frontend s widgetem, módy, locale (CZ/EN)
- API klíč `GEMMA_API_KEY` v Netlify env vars
- Frontend deploy: Netlify auto z main

## Cíl rozšíření

1. **Hybridní routing** — Gemma 4 zůstává primární (zdarma), GPT 5.4 mini se přidává pro tool calling a smart akce
2. **21 akcí** přes function calling místo dosavadních 3 (scroll, voice on/off)
3. **Bezpečnostní vrstva B** — Turnstile, origin check, honeypot, anomaly logging, per-action quota
4. **Limity zpráv s email fallbackem** — když user dosáhne limitu, agent ho nasměruje na lukas.drsticka@gmail.com
5. **Learning A+B+C** — opt-in per-user memory, anonymní analytics, self-improving prompt s schvalováním

## Architektura

```
Browser ──▶ Netlify Function /api/chat
               │
               ├── 1. Origin check
               ├── 2. Honeypot empty?
               ├── 3. Turnstile token valid?
               ├── 4. IP rate limit (Upstash Redis)
               ├── 5. Per-action quota
               ├── 6. Input validation
               │
               ├── 7. ROUTER:
               │    a) keyword pre-filter (existující fast-path)
               │    b) Gemma 4 (default) — vrací text + handoff signál
               │    c) GPT 5.4 mini — tool calling
               │
               ├── 8. Validate tool calls (whitelist + ajv)
               ├── 9. Execute (server-side: Formspree, Upstash; klient: scroll, filter)
               └── 10. Anomaly log
```

## Routing logika (hybrid 1+3)

**Vrstva 1: Keyword pre-filter** (synchronní, instant, zdarma)
- Existující `buildFastPathResponse()` zůstává
- Rozšíříme o akční intenty: `^(ukaz|zobraz|filtruj|otevri|spust|objednej|rezervuj|pošli|napiš)\b` → flag `actionLikely=true`
- Pokud `actionLikely` → rovnou GPT 5.4 mini
- Pokud match na conversational keyword → fast-path string odpověď
- Jinak → Gemma 4

**Vrstva 2: Gemma s self-handoff signálem**
- System prompt rozšířen: "Pokud user chce konkrétní akci na webu (filtr galerie, vyplnění formuláře, doporučení balíčku), odpověz JEN tagem `[[HANDOFF:gpt:důvod]]` a nic víc."
- Backend detekuje `[[HANDOFF:gpt:...]]` → spustí GPT 5.4 mini se stejnou konverzací

**Vrstva 3: GPT 5.4 mini s tool calling**
- Model: `gpt-5.4-mini` (OpenAI Chat Completions API + tools)
- 21 funkcí v `_lib/tools.js` (JSON schema)
- System prompt s pravidly: "Nikdy neslibuj slevy. Nikdy nevymýšlej ceny. Max 3 akce per response. Vrať český text + tools array."
- Validace tool calls server-side (whitelist + ajv schema)

## Katalog 21 akcí

**Navigace + UX (5):**
- `scroll_to(section)` — `portfolio | skills | o-mne | spoluprace | kontakt | ai-asistent`
- `highlight_element(selector)` — pulse animace
- `toggle_theme()` — light/dark
- `open_lightbox(image_id)` — zvětšení fotky
- `play_showreel()` — spustí showreel video

**Portfolio (4):**
- `filter_gallery(category, tags?)` — `svatby | sport | lifestyle | ai | produkt`
- `show_project_detail(project_id)` — detail
- `compare_before_after(image_id)` — slider před/po
- `show_portfolio_stats()` — počty projektů, klienti, roky

**Akvizice (5):**
- `prefill_contact_form(name?, email?, message?, service?)` — vyplní pole, neodesílá
- `send_inquiry(payload)` — Formspree odeslání (server-side)
- `request_callback(phone, time_window)` — Formspree callback
- `subscribe_newsletter(email)` — Formspree
- `book_consultation(date, time, topic)` — Formspree booking

**Smart wow factor (4):**
- `recommend_service(needs_text)` — GPT vrátí service_id + reason
- `generate_quote_estimate(brief_text)` — orientační rozsah z knowledge base (ne fixní cena!)
- `create_project_brief(answers_object)` — multi-turn brief
- `send_brief_to_email(brief)` — Formspree, posílá Lukášovi

**Info (3):**
- `show_pricing(service)` — scroll + highlight ceníku
- `compare_services(service_a, service_b)` — vedle sebe
- `check_availability(date_range)` — orientační z config

## Bezpečnost (balíček B)

**Vrstva fail-fast:**
1. Origin check — `Referer`/`Origin` musí být `lukasdrsticka-ai-and-foto.com` nebo `localhost:*` (dev)
2. Honeypot field — skrytý input `_company_website`, vyplněný = bot, reject 200 OK (silent drop)
3. Turnstile token verify — Cloudflare Turnstile (zdarma, invisible), POST na `/turnstile/v0/siteverify`
4. Rate limit (Upstash Redis sliding window):
   - Chat: 60/h/IP
   - Drahé akce: 5/h/IP
   - Smart akce: 3/d/IP
   - Souběžné: 2/IP
5. Input validation — max 700 znaků (existující), strip kontrolních znaků, detect prompt injection patterns
6. Anomaly log — User-Agent v blacklistu, missing Accept-Language, vysoká frekvence

**API klíče:**
- Netlify env vars: `GEMMA_API_KEY`, `OPENAI_API_KEY`, `TURNSTILE_SECRET`, `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`, `FORMSPREE_TOKEN` (pokud používáme server-side Formspree)
- Nikdy v klientském kódu, nikdy v error response

**CSP update v `netlify.toml`:**
- Přidat `https://challenges.cloudflare.com` do `script-src` a `frame-src`
- Přidat `https://api.openai.com` do `connect-src`

## Limity zpráv + email fallback

Per session (localStorage):
- 30 zpráv/session

Per IP (Upstash sliding window):
- 60 zpráv/h
- 5 drahých akcí/h
- 3 smart akce/den

Při překročení libovolného limitu:
```
Zdá se, že jsme si pěkně popovídali — agent má momentálně nastavený limit, abych ho nezahltili. Pokud potřebuješ pokračovat v konkrétní poptávce, napiš mi přímo:

📧 lukas.drsticka@gmail.com

Nebo vyplň [poptávkový formulář] (auto-prefill).
Odpovídám obvykle do 24 hodin.
```

Frontend nabídne tlačítko `→ Otevřít formulář s konverzací` — auto-prefill přes Formspree se shrnutím dosavadní konverzace (klient vygeneruje shrnutí přes lokální Gemma call PŘED dosažením limitu, nebo z message history).

## Learning systém A+B+C

### A) Per-user memory (opt-in)

Při prvním kontaktu agent řekne:
> "Mimochodem, můžu si naši konverzaci pamatovat na příště? Snadno smažeš jedním klikem."

Pokud souhlas:
- `crypto.randomUUID()` v `localStorage.lukas_visitor_id`
- Server: Upstash Redis klíč `visitor:{uuid}`
- Schéma: `{ first_seen, last_seen, message_count, summary, preferences, consent_at }`
- Summary: po každé konverzaci Gemma vygeneruje 2-3 věty
- TTL: 180 dní bez aktivity
- "Smazat můj profil" tlačítko v chatu

### B) Globální anonymized analytics

Každá konverzace se loguje **bez personal data**:
- `{ session_id, timestamp, intents[], tools_called[], handoff_count, resolved, length, model_used }`
- IP hash (SHA-256 + salt), žádné kontakty, žádný plain text
- Storage: Upstash Redis list `analytics:conversations` (TTL 90 dní)

**Cron (Netlify Scheduled Functions, weekly):**
- Top 20 intentů, top 10 nezvládnutých dotazů, conversion rate
- Email Lukášovi: HTML report + návrhy "doplň do knowledge base: X, Y, Z"

### C) Self-improving prompt (návrh ke schválení)

- Po `resolved=true` konverzaci se uloží pattern
- Týdně GPT 5.4 mini analyzuje patterny + B-data → vygeneruje diff system promptu
- Email Lukášovi: "Navrhuju upravit knowledge base. Změny: + ... | Schválit / Zamítnout"
- Schválení = commit do `netlify/functions/_lib/system-prompt.md`
- **NIKDY auto-apply** — všechno přes manuální schválení s JWT linkem

**Bezpečnostní guard:**
- Návrhy obsahující slova `sleva, akce, výhodněji, levněji, zdarma navíc` → automatické zamítnutí
- Návrhy měnící identitu/osobu → automatické zamítnutí
- Filtr proti prompt injection v patternu

## Klíčová pravidla

- **Agent NIKDY neslibuje slevy, akce, výhody mimo oficiální ceník**
- **Agent NIKDY nevymýšlí ceny** — pokud nezná, řekne "zeptej se Lukáše přímo"
- **Max 3 akce per response**
- **Nikdy auto-apply prompt změny** — vždy manuální schválení
- **Email fallback místo 429 errorů**

## Implementační fáze

**Fáze 1 — Bezpečnost a infra**
- `_lib/security.js` — origin check, honeypot, Turnstile verify, anomaly detection
- `_lib/limits.js` — Upstash Redis sliding-window rate limiter
- Frontend `turnstile.js` — invisible widget loader
- CSP update v `netlify.toml`
- Env vars setup v Netlify dashboard

**Fáze 2 — Router refactor**
- Rozšíření keyword pre-filteru o akční intenty v `chat.mjs`
- System prompt update — Gemma handoff signál `[[HANDOFF:gpt:reason]]`
- Backend detekce handoff a routing na GPT
- `_lib/openai-client.js` — wrapper kolem OpenAI Chat Completions

**Fáze 3 — Tool calling**
- `_lib/tools.js` — 21 funkcí jako JSON schema
- `_lib/tool-validator.js` — ajv validace tool args
- `_lib/system-prompt-actions.md` — instrukce pro GPT (no slevy, no fake ceny, max 3 actions)
- Frontend `chatbot.js` — registr tool executorů, sequential execution s 200ms delay

**Fáze 4 — Limity + email fallback**
- Hard limit logic v `chat.mjs`
- Email fallback message + button "Otevřít formulář s konverzací"
- Frontend disable input po dosažení limitu
- Auto-prefill přes Formspree

**Fáze 5 — Learning A+B+C**
- A: opt-in toggle UI, `_lib/visitor-memory.js` (Upstash CRUD), summary generator
- B: `_lib/analytics-logger.js` (anonymized), `netlify/functions/scheduled-weekly-report.js`
- C: `netlify/functions/scheduled-prompt-improver.js`, admin endpoint `approve-prompt-diff`, JWT token

**Fáze 6 — Test + deploy**
- Manuální scénáře (10 případů)
- `npm run build` + smoke test produkce

## Závislosti k přidání

```json
{
  "dependencies": {
    "@netlify/functions": "^5.1.5",
    "openai": "^4.x",
    "ajv": "^8.x",
    "@upstash/redis": "^1.x",
    "jose": "^5.x"
  }
}
```

## Env vars k setupnutí v Netlify

- `GEMMA_API_KEY` (existuje)
- `OPENAI_API_KEY` (nové)
- `TURNSTILE_SECRET` (nové)
- `TURNSTILE_SITE_KEY` (nové, public)
- `UPSTASH_REDIS_URL` (nové)
- `UPSTASH_REDIS_TOKEN` (nové)
- `FORMSPREE_TOKEN` (nové, pokud server-side)
- `ADMIN_JWT_SECRET` (nové, pro prompt approval link)
- `ANALYTICS_SALT` (nové, pro IP hash)
