// Živá ukázka — agent-driven guided tour generator.
// gemini-3.5-flash navrhne validovanou choreografii kroků (say + vizuální akce),
// kterou frontend přehraje s hlasem. Bilingual (cs/en). Adaptuje naraci na obor návštěvníka.
// Bezpečné: jen vizuální nástroje, žádné odesílání formulářů.

import { SECTIONS, GALLERY_CATEGORIES, SERVICES } from "./_lib/tools.mjs";

const TOUR_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-3.5-flash";
const HIGHLIGHT_TARGETS = ["pricing", "portfolio-grid", "contact-form", "skills-grid", "showreel"];
const THEME_MODES = ["light", "dark", "toggle"];
const MIN_STEPS = 3;
const MAX_STEPS = 6;
const MAX_SAY_LEN = 180;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

const ipHits = new Map();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getApiKey() {
  return String(
    process.env.GEMINI_API_KEY ||
    process.env.GEMMA_API_KEY ||
    process.env.Gemini ||
    process.env.GEMINI ||
    ""
  ).trim();
}

function getClientIp(req) {
  const xff = req.headers.get("x-forwarded-for");
  return (xff && xff.split(",")[0].trim()) || req.headers.get("client-ip") || "unknown";
}

function isRateLimited(ip) {
  const now = Date.now();
  let hits = ipHits.get(ip) || [];
  hits = hits.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (hits.length >= RATE_LIMIT_MAX) {
    ipHits.set(ip, hits);
    return true;
  }
  hits.push(now);
  ipHits.set(ip, hits);
  return false;
}

// Demo data pro předvyplnění formuláře — nikdy se neodesílá, jen vizuální ukázka.
const DEMO_PREFILL = {
  cs: {
    name: "Ukázková firma",
    email: "ukazka@vase-firma.cz",
    service: "ai-agent-na-miru",
    message: "Chceme na web hybridního agenta jako tenhle — ať mluví i ovládá stránku.",
  },
  en: {
    name: "Demo Company",
    email: "demo@your-company.com",
    service: "ai-agent-na-miru",
    message: "We want a hybrid agent like this on our site — one that talks and drives the page.",
  },
};

// Validátory argumentů jednotlivých nástrojů. Vrací očištěné args, nebo null = zahodit krok.
const STEP_VALIDATORS = {
  scroll_to: (a) => (SECTIONS.includes(a && a.section) ? { section: a.section } : null),
  highlight_element: (a) => (HIGHLIGHT_TARGETS.includes(a && a.target) ? { target: a.target } : null),
  toggle_theme: (a) => ({ mode: THEME_MODES.includes(a && a.mode) ? a.mode : "toggle" }),
  play_showreel: () => ({}),
  filter_gallery: (a) => (GALLERY_CATEGORIES.includes(a && a.category) ? { category: a.category } : null),
  show_portfolio_stats: () => ({}),
  show_pricing: (a) => (a && SERVICES.includes(a.service) ? { service: a.service } : {}),
  compare_services: (a) =>
    a && SERVICES.includes(a.service_a) && SERVICES.includes(a.service_b)
      ? { service_a: a.service_a, service_b: a.service_b }
      : null,
  check_availability: () => ({}),
  // prefill_contact_form se řeší zvlášť (injektujeme demo data, ignorujeme co řekl model).
};

const ALLOWED_TOOLS = Object.keys(STEP_VALIDATORS).concat(["prefill_contact_form"]);

function validateSteps(raw, lang) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const s of raw) {
    if (!s || typeof s.say !== "string") continue;
    const say = s.say.trim().replace(/\s+/g, " ").slice(0, MAX_SAY_LEN);
    if (!say) continue;
    const tool = typeof s.tool === "string" ? s.tool : "";
    if (!ALLOWED_TOOLS.includes(tool)) continue;

    let args;
    if (tool === "prefill_contact_form") {
      args = DEMO_PREFILL[lang] || DEMO_PREFILL.cs;
    } else {
      args = STEP_VALIDATORS[tool](s.args || {});
      if (args === null) continue;
    }

    out.push({ say, tool, args });
    if (out.length >= MAX_STEPS) break;
  }
  return out.length >= MIN_STEPS ? out : null;
}

function buildSystemPrompt(lang) {
  const toolMenu = [
    `scroll_to{section: ${SECTIONS.join("|")}}`,
    `highlight_element{target: ${HIGHLIGHT_TARGETS.join("|")}}`,
    `filter_gallery{category: ${GALLERY_CATEGORIES.join("|")}}`,
    `show_portfolio_stats{}`,
    `show_pricing{service?}`,
    `compare_services{service_a, service_b}`,
    `play_showreel{}`,
    `toggle_theme{mode: light|dark|toggle}`,
    `check_availability{}`,
    `prefill_contact_form{}  (args se ignorují, doplní se demo data)`,
  ].join("\n");

  if (lang === "en") {
    return `You script a short guided LIVE DEMO of a personal website for photographer & AI builder Lukáš Drštička. The on-page agent will SPEAK each line (female voice) and then PERFORM the matching visual action. Audience: a COMPANY evaluating whether they want a hybrid agent like this.

Return STRICT JSON only: {"steps":[{"say": string, "tool": string, "args": object}, ...]}.
- 5 to 6 steps. Each "say" is ONE short spoken English sentence, max ~140 chars, warm and confident, no markdown, no emoji.
- Use ONLY these tools and arg enums:
${toolMenu}
- Flow: greet + go to skills/hybrid agent and highlight it → show portfolio (filter_gallery) → show credibility (show_portfolio_stats or show_pricing) → end at kontakt with prefill_contact_form.
- If a business context is given, tailor every line to that industry ("for your e-shop…").
- Sell the idea that the agent both talks AND operates the site. Never promise prices or discounts.`;
  }

  return `Píšeš scénář krátké ŽIVÉ UKÁZKY osobního webu fotografa a AI buildera Lukáše Drštičky. Agent na stránce každou větu NAHLAS ŘEKNE (ženský hlas) a pak PROVEDE odpovídající vizuální akci. Publikum: FIRMA, která zvažuje, jestli chce hybridního agenta jako tohle.

Vrať VÝHRADNĚ striktní JSON: {"steps":[{"say": string, "tool": string, "args": object}, ...]}.
- 5 až 6 kroků. Každé "say" je JEDNA krátká mluvená česká věta, max ~140 znaků, vřelá a sebevědomá, žádný markdown, žádné emoji.
- Používej POUZE tyto nástroje a hodnoty argumentů:
${toolMenu}
- Tok: pozdrav + přesun na dovednosti/hybridního agenta a zvýraznění → ukázka portfolia (filter_gallery) → důvěryhodnost (show_portfolio_stats nebo show_pricing) → zakončení na sekci kontakt s prefill_contact_form.
- Když je zadaný obor firmy, nalaď každou větu na ten obor ("pro váš e-shop…").
- Prodávej myšlenku, že agent zároveň mluví I ovládá web. Nikdy neslibuj ceny ani slevy.`;
}

async function generateTour({ apiKey, lang, context }) {
  const userText = context
    ? `lang=${lang}; obor/kontext firmy: ${context}`
    : `lang=${lang}; obecná firma bez upřesnění oboru`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(TOUR_MODEL)}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemPrompt(lang) }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 900,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error("Tour gen error:", response.status, errText.slice(0, 300));
    return null;
  }

  const data = await response.json().catch(() => null);
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("") || "";
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    console.error("Tour JSON parse fail:", text.slice(0, 200));
    return null;
  }
  return validateSteps(parsed?.steps, lang);
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders });
  }

  if (req.method === "GET") {
    return jsonResponse(200, {
      ok: true,
      warm: true,
      model: TOUR_MODEL,
      configured: !!getApiKey(),
      tools: ALLOWED_TOOLS,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return jsonResponse(429, { steps: null, error: "Příliš mnoho požadavků. Zkus to za chvíli." });
  }

  let body;
  try {
    body = await req.json();
  } catch (err) {
    body = {};
  }

  const lang = body && typeof body.lang === "string" && body.lang.toLowerCase().startsWith("en") ? "en" : "cs";
  const context =
    body && typeof body.context === "string" ? body.context.trim().slice(0, 160) : "";

  const apiKey = getApiKey();
  if (!apiKey) {
    // Necháme frontend použít scripted fallback.
    return jsonResponse(200, { steps: null, source: "fallback", lang });
  }

  try {
    const steps = await generateTour({ apiKey, lang, context });
    if (!steps) {
      return jsonResponse(200, { steps: null, source: "fallback", lang });
    }
    return jsonResponse(200, { steps, source: "ai", lang });
  } catch (err) {
    console.error("Tour function error:", err);
    return jsonResponse(200, { steps: null, source: "fallback", lang });
  }
};
