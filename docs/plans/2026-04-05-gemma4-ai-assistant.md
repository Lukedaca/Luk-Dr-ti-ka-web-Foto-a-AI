# Gemma 4 AI Assistant - Implementacni plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Nahradit offline chatbota realnym AI asistentem (Gemma 4) s hero integraci, stránkovými akcemi a email notifikacemi.

**Architecture:** Netlify Function jako secure backend proxy pro Google Gemini API (Gemma 4 model). Frontend posilá zpravy na `/.netlify/functions/chat`, funkce pridá API klic z env a preda Gemma modelu se system promptem obsahujicim plny knowledge base. Odpoved obsahuje `message` + volitelne `action` (scroll/filter/highlight). Konverzace se po neaktivite odesila pres Formspree na email.

**Tech Stack:** Vanilla JS, Netlify Functions (Node.js), Google Generative Language API (Gemma 4), Formspree, esbuild

---

## Prehled komponent

```
index.html
├── Hero AI Chatbox (nova sekce - nahrazuje stary hero text)
├── Floating Widget (upraveny stavajici - sdileny kontext s hero)
└── Stránkové akce (scroll, filter, highlight)

netlify/functions/chat.js      ← backend proxy (API klic v env)
src/js/chatbot.js              ← kompletni prepis (Gemma misto offline)
netlify.toml                   ← CSP update, functions config
package.json                   ← @netlify/functions dependency
.gitignore                     ← overit ze .env neni v gitu
```

---

### Task 1: Netlify Function - secure backend proxy

**Files:**
- Create: `netlify/functions/chat.js`
- Modify: `package.json` (pridat dependency)
- Modify: `.gitignore` (overit .env)

**Step 1: Pridat dependency**

```bash
cd "C:\Users\Intel\Luk-Dr-ti-ka-web-Foto-a-AI"
npm install @netlify/functions
```

**Step 2: Vytvorit .gitignore update**

Overit ze `.gitignore` obsahuje `.env` - pokud ne, pridat.

**Step 3: Vytvorit Netlify Function**

Vytvorit `netlify/functions/chat.js`:

```javascript
const GEMMA_API_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const GEMMA_MODEL = 'gemma-4-27b-it';
const MAX_TOKENS = 600;
const TEMPERATURE = 0.4;

const SYSTEM_PROMPT = `Jsi AI asistent na osobnim webu fotografa a AI vyvojare Lukase Drsticky z Prerova.

TVOJE OSOBNOST:
- Komunikujes cesky, pratelsky a profesionalne
- Jsi strucny ale vstricny — odpovidas ve 2-4 vetach
- Nepoužíváš emoji pokud se nehodí
- Nerikas ze jsi AI pokud se nekdo nezepta

SLUZBY KTERE NABIZIS INFO:
1. FOTOGRAFIE:
   - Portretni fotografie (ateliér i venku, duraz na vyraz a svetlo)
   - Sportovni a akcni fotografie (timing, dynamika, zapasy)
   - Produktova fotografie
   - Dodani: 7-14 dnu, format JPEG standard, RAW na vyzadani
   - Session: portret 1-2 hodiny, sport dle akce
   - Lokalita: Prerov, fotim po cele Morave

2. AI & AUTOMATIZACE:
   - Fotograf AI: autorska semiagent aplikace pro rychlou postprodukci a konzistentni styl
   - Vibecoding a prototypovani s Claude, Gemini, ChatGPT a Codex
   - Agentni kodovani pro rychle iterace
   - Automatizace workflow a procesu
   - Chatboty a AI asistenti na miru

3. CENY: Individualni podle rozsahu, terminu a lokality. Pro cenovou nabidku napsat na lukas.drsticka@gmail.com

KONTAKT:
- Email: lukas.drsticka@gmail.com
- Web: lukasdrsticka-ai-and-foto.com
- Lokace: Prerov

STRANKOVE AKCE (DULEZITE):
Kdyz odpovidas, muzes navrhnout akci pro stranku. Pridej do JSON odpovedi pole "action":
- {"type":"scroll","target":"portfolio"} — scrollni na portfolio sekci
- {"type":"scroll","target":"kontakt"} — scrollni na kontakt
- {"type":"scroll","target":"skills"} — scrollni na dovednosti
- {"type":"scroll","target":"o-mne"} — scrollni na o mne
- {"type":"scroll","target":"spoluprace"} — scrollni na spoluprace
- {"type":"filter","target":"foto"} — filtruj portfolio na fotky
- {"type":"filter","target":"ai"} — filtruj portfolio na AI projekty
- {"type":"highlight","target":"kontakt"} — zvyrazni kontaktni sekci

Pouzivej akce jen kdyz to dava smysl (uzivatel se pta na portfolio, chce kontakt, atd.).

ODPOVED VZDY jako JSON: {"message":"tvoje odpoved","action":null}
Pokud chces akci: {"message":"tvoje odpoved","action":{"type":"scroll","target":"portfolio"}}`;

// Simple in-memory rate limiter (per function instance)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minuta
const RATE_LIMIT_MAX = 15; // max 15 zprav za minutu per IP

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

exports.handler = async (event) => {
  // CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST' } };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Rate limit
  const clientIp = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return { statusCode: 429, body: JSON.stringify({ error: 'Příliš mnoho zpráv. Zkus to za chvíli.' }) };
  }

  const apiKey = process.env.GEMMA_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API není nakonfigurováno.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Neplatný požadavek.' }) };
  }

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Chybí zprávy.' }) };
  }

  // Limit conversation history to last 20 messages to control token usage
  const trimmedMessages = messages.slice(-20);

  const payload = {
    model: GEMMA_MODEL,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...trimmedMessages,
    ],
  };

  try {
    const response = await fetch(GEMMA_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemma API error:', response.status, errText);
      return { statusCode: 502, body: JSON.stringify({ error: 'AI momentálně nedostupná.' }) };
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';

    // Strip Gemma <thought> tags
    const cleaned = rawContent.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim();

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Try to extract JSON from mixed content
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch { parsed = null; }
      }
      if (!parsed) {
        parsed = { message: cleaned, action: null };
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: parsed.message || cleaned,
        action: parsed.action || null,
        usage: data.usage || null,
      }),
    };
  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Interní chyba serveru.' }) };
  }
};
```

**Step 4: Commit**

```bash
git add netlify/functions/chat.js package.json package-lock.json .gitignore
git commit -m "feat: Netlify Function pro Gemma 4 AI backend proxy"
```

---

### Task 2: Prepsat chatbot.js — Gemma 4 motor

**Files:**
- Rewrite: `src/js/chatbot.js`

**Step 1: Kompletni prepis chatbot.js**

Novy `src/js/chatbot.js` — nahrazuje celou tridu `EnhancedChatbot` a chat UI.
Klicove zmeny:
- `processMessage()` vola Netlify Function misto offline pattern matchingu
- Sdileny stav `window.aiChat` pro hero i widget
- Akce (scroll/filter/highlight) se provadeji po odpovedi
- Konverzace se odesila pres Formspree po 3 min neaktivity
- Typing indicator behem cekani na API

Hlavni struktura:

```javascript
// ── State ─────────────────────────────────────────────────
const CHAT_API = '/.netlify/functions/chat';
const FORMSPREE_URL = 'https://formspree.io/f/movlrlzj';
const INACTIVITY_MS = 180000; // 3 minuty

const state = {
  messages: [],        // {role:'user'|'assistant', content:string}
  isOpen: false,
  isHeroVisible: true,
  inactivityTimer: null,
  notificationSent: false,
};

// ── API ───────────────────────────────────────────────────
async function sendToGemma(userMessage) {
  state.messages.push({ role: 'user', content: userMessage });
  resetInactivityTimer();

  const res = await fetch(CHAT_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: state.messages }),
  });

  if (!res.ok) throw new Error('API error');
  const data = await res.json();

  state.messages.push({ role: 'assistant', content: data.message });
  return data; // { message, action, usage }
}

// ── Page Actions ──────────────────────────────────────────
function executeAction(action) {
  if (!action) return;
  if (action.type === 'scroll') {
    const el = document.getElementById(action.target);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (action.type === 'filter') {
    // Trigger portfolio filter buttons
    const btn = document.querySelector(`[data-filter="${action.target}"]`);
    if (btn) btn.click();
  }
  if (action.type === 'highlight') {
    const el = document.getElementById(action.target);
    if (el) {
      el.classList.add('ai-highlight');
      setTimeout(() => el.classList.remove('ai-highlight'), 3000);
    }
  }
}

// ── Formspree notification ────────────────────────────────
function resetInactivityTimer() {
  clearTimeout(state.inactivityTimer);
  state.inactivityTimer = setTimeout(sendNotification, INACTIVITY_MS);
}

async function sendNotification() {
  if (state.notificationSent || state.messages.length < 2) return;
  state.notificationSent = true;

  const transcript = state.messages
    .map(m => `${m.role === 'user' ? 'Navstevnik' : 'Asistent'}: ${m.content}`)
    .join('\n\n');

  await fetch(FORMSPREE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      _subject: `AI Chat prepis (${state.messages.filter(m=>m.role==='user').length} zprav)`,
      message: transcript,
      _replyto: 'web-ai-chat@lukasdrsticka.com',
    }),
  }).catch(() => {});
}

// ── Render helpers ────────────────────────────────────────
// renderBubble(container, role, text)
// showTyping(container) / hideTyping(container)
// renderQuickReplies(container)

// ── Hero Chat ─────────────────────────────────────────────
// Inicializace hero chatboxu v #hero-chat
// IntersectionObserver sleduje hero viditelnost -> state.isHeroVisible
// Quick reply karty pod inputem

// ── Widget Chat ───────────────────────────────────────────
// Stavajici floating widget (#chatBtn, #chatWindow)
// Sdili state.messages s hero
// Synchronizuje zobrazeni pri otevreni

// ── Unified send handler ─────────────────────────────────
// Obe UI (hero i widget) volaji stejnou sendToGemma()
// Po odpovedi renderuji do sveho containeru
// + executeAction() na stranku
```

**Step 2: Build a overit syntaxi**

```bash
node -c src/js/chatbot.js
npm run build:js
```

**Step 3: Commit**

```bash
git add src/js/chatbot.js
git commit -m "feat: Gemma 4 AI chatbot — nahrazuje offline pattern matching"
```

---

### Task 3: Hero sekce — AI Chatbox

**Files:**
- Modify: `index.html` (hero section, radky 288-331)

**Step 1: Nahradit hero obsah**

Stavajici hero (typing text, staticky popis, CTA buttony) nahradit za:
- Nadpis "Zeptej se me na cokoliv"
- Velky chat input s glass efektem
- Quick reply karty (Portréty, Sport, Fotograf AI, Ceny)
- Oblast pro odpovedi (chat bubliny)
- Zachovat hero orby (ambient efekt)

Struktura:

```html
<!-- Hero Section — AI Chatbox -->
<section id="hero" class="min-h-screen flex items-center justify-center px-6 relative mesh-gradient">
  <div class="hero-ambient">
    <span class="hero-orb one" aria-hidden="true"></span>
    <span class="hero-orb two" aria-hidden="true"></span>
    <span class="hero-orb three" aria-hidden="true"></span>
  </div>
  <div class="w-full max-w-3xl mx-auto relative z-10">
    <div class="text-center mb-8">
      <h1 class="text-4xl sm:text-5xl md:text-6xl font-bold gradient-text display-text mb-3"
          style="font-family:'Space Grotesk',sans-serif">
        Lukas Drsticka
      </h1>
      <p class="text-lg text-gray-400">Fotograf & AI Developer — zeptej se me na cokoliv</p>
    </div>

    <!-- Hero Chat Container -->
    <div id="hero-chat" class="glass rounded-2xl p-6 shadow-2xl">
      <div id="hero-messages" class="max-h-[340px] overflow-y-auto mb-4 space-y-3"></div>
      <div class="flex gap-2">
        <input id="hero-input" type="text"
               class="flex-1 glass rounded-xl p-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
               placeholder="Napis zpravu..." autocomplete="off">
        <button id="hero-send"
                class="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 rounded-xl hover:opacity-90 transition font-semibold">
          Odeslat
        </button>
      </div>
      <div id="hero-quick-replies" class="flex flex-wrap gap-2 mt-4">
        <button class="hero-qr glass px-4 py-2 rounded-full text-sm hover:bg-white/10 transition"
                data-value="Delás portrétni foceni?">Portréty</button>
        <button class="hero-qr glass px-4 py-2 rounded-full text-sm hover:bg-white/10 transition"
                data-value="Fotis sportovni akce?">Sport</button>
        <button class="hero-qr glass px-4 py-2 rounded-full text-sm hover:bg-white/10 transition"
                data-value="Jak funguje Fotograf AI?">Fotograf AI</button>
        <button class="hero-qr glass px-4 py-2 rounded-full text-sm hover:bg-white/10 transition"
                data-value="Kolik to stoji?">Ceny</button>
      </div>
    </div>
  </div>

  <div class="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
    <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
    </svg>
  </div>
</section>
```

**Step 2: Commit**

```bash
git add index.html
git commit -m "feat: hero sekce s AI chatboxem"
```

---

### Task 4: Aktualizovat netlify.toml

**Files:**
- Modify: `netlify.toml`

**Step 1: Pridat functions config a CSP update**

- Pridat `[functions]` sekci pro Netlify Functions
- Updatnout CSP: pridat `connect-src 'self' https://formspree.io /.netlify/functions/*`
- Pridat redirect pro API: `/api/chat` → `/.netlify/functions/chat`

**Step 2: Commit**

```bash
git add netlify.toml
git commit -m "chore: netlify config — functions + CSP pro AI chat"
```

---

### Task 5: Aktualizovat core.js — eager load chatbota

**Files:**
- Modify: `src/js/core.js` (radky 391-405)

**Step 1: Zmenit lazy load na eager load**

Chatbot se musi nacist hned (ne az po kliknuti na widget), protoze hero chatbox je videt okamzite. Zmenit:
- Odstranit `chatBtn.addEventListener('click', ...)` lazy loading
- Misto toho nacist chatbot modul primo pres `<script defer>` v index.html
- Nebo ho nacist v core.js na DOMContentLoaded

**Step 2: Build**

```bash
npm run build:js
```

**Step 3: Commit**

```bash
git add src/js/core.js
git commit -m "feat: eager load chatbotu pro hero AI"
```

---

### Task 6: CSS — ai-highlight efekt a hero chat styly

**Files:**
- Modify: `index.html` (inline critical CSS, radky 57-228) nebo `src/css/main.css`

**Step 1: Pridat styly**

```css
/* AI highlight pulse efekt */
.ai-highlight {
  animation: aiHighlightPulse 0.6s ease-out 3;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.4);
  border-radius: 12px;
}

@keyframes aiHighlightPulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0); }
  50% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.3); }
}

/* Hero chat bubliny */
#hero-messages .chat-bubble-user {
  margin-left: auto;
  max-width: 80%;
  background: linear-gradient(135deg, rgba(59,130,246,0.3), rgba(139,92,246,0.3));
  border: 1px solid rgba(59,130,246,0.3);
  border-radius: 16px 16px 4px 16px;
  padding: 12px 16px;
  color: white;
}

#hero-messages .chat-bubble-assistant {
  max-width: 80%;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 16px 16px 16px 4px;
  padding: 12px 16px;
  color: var(--text-primary);
}

/* Typing indicator */
.ai-typing {
  display: inline-flex;
  gap: 4px;
  padding: 12px 16px;
}
.ai-typing span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255,255,255,0.5);
  animation: aiTypingDot 1s infinite ease-in-out;
}
.ai-typing span:nth-child(2) { animation-delay: 0.15s; }
.ai-typing span:nth-child(3) { animation-delay: 0.3s; }

@keyframes aiTypingDot {
  0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}
```

**Step 2: Commit**

```bash
git add index.html src/css/main.css
git commit -m "feat: CSS pro AI chat bubliny, highlight a typing"
```

---

### Task 7: Build, test lokalne, deploy

**Step 1: Full build**

```bash
cd "C:\Users\Intel\Luk-Dr-ti-ka-web-Foto-a-AI"
npm run build
```

**Step 2: Test lokalne s Netlify CLI**

```bash
npx netlify dev
```

Otestovat:
- Hero chatbox se zobrazuje, input funguje
- Odeslani zpravy vola `/.netlify/functions/chat`
- Odpoved se zobrazuje v hero i widgetu (sdileny kontext)
- Strankove akce funguji (scroll, filter, highlight)
- Po 3 min neaktivity prijde email pres Formspree
- Rate limiting funguje

**Step 3: Nastavit env promennou v Netlify**

V Netlify dashboard: Site Settings > Environment Variables:
- `GEMMA_API_KEY` = Google API klic pro Gemma 4

**Step 4: Deploy**

```bash
git push origin main
```

Netlify automaticky buildne a deployne.

**Step 5: Commit (pokud jsou jeste zmeny)**

```bash
git add -A
git commit -m "chore: final build pro Gemma 4 AI assistant deploy"
```

---

## Bezpecnostni checklist

- [ ] API klic POUZE v Netlify env (GEMMA_API_KEY), nikde v kodu
- [ ] `.env` v `.gitignore`
- [ ] Netlify Function validuje input (JSON, messages array)
- [ ] Rate limiting per IP (15 zprav/min)
- [ ] Konverzacni historie oriznutá na 20 zprav (token control)
- [ ] CSP header povoluje jen vlastni domenu + formspree
- [ ] Zadne credentials v git historii
