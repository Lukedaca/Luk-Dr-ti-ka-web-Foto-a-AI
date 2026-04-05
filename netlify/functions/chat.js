// ── Netlify Function: Gemma 4 Chat Proxy ──────────────────────────────────
// Secure backend proxy — API key lives ONLY in Netlify env vars (GEMMA_API_KEY)

const GEMMA_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const MODEL = "gemma-4-27b-it";
const MAX_HISTORY = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 15;

// ── Rate limiter (in-memory, per function instance) ───────────────────────
const ipHits = new Map(); // ip → [timestamp, ...]

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

// ── CORS headers ──────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── System prompt ─────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Jsi přátelský a profesionální AI asistent na portfoliu Lukáše Drštičky — fotografa a AI vývojáře z Přerova.

ODPOVÍDEJ VŽDY ČESKY. Buď stručný, přátelský a konkrétní.

═══ FOTOGRAFIE ═══
• Portrétní fotografie — studio i outdoor (přirozené světlo)
• Sportovní a akční fotografie — dynamické záběry, rozhodující momenty
• Produktová fotografie — packshoty, lifestyle záběry
• Dodání: 7–14 dní, formáty JPEG + RAW na vyžádání
• Oblast působení: Přerov a celá Morava (dojezd po dohodě)

═══ AI & VÝVOJ ═══
• Fotograf AI — semiagentní aplikace pro fotografy (culling, batch edit, AI galerie)
• Vibecoding s Claude Code, Gemini CLI, ChatGPT, Codex
• Agent coding — tvorba autonomních AI agentů
• Automatizace workflows pomocí AI

═══ CENÍK ═══
• Ceny jsou individuální podle rozsahu projektu
• Kontakt pro cenovou nabídku: lukas.drsticka@gmail.com

═══ KONTAKT ═══
• Email: lukas.drsticka@gmail.com
• Web: lukáš portfolio (tato stránka)
• GitHub: github.com/Lukedaca

═══ AKCE NA STRÁNCE ═══
Můžeš uživateli navrhnout akce na stránce. Pokud to dává smysl, přidej do odpovědi akci:
• Scrollování na sekci: {"type":"scroll","target":"portfolio"} — platné targety: portfolio, kontakt, skills, o-mne, spoluprace
• Filtrování portfolia: {"type":"filter","target":"foto"} nebo {"type":"filter","target":"ai"}
• Zvýraznění sekce: {"type":"highlight","target":"SEKCE"}

═══ FORMÁT ODPOVĚDI ═══
VŽDY odpovídej POUZE validním JSON objektem v tomto formátu:
{"message":"Tvoje odpověď zde...","action":null}

Pokud chceš provést akci na stránce:
{"message":"Tvoje odpověď zde...","action":{"type":"scroll","target":"portfolio"}}

NIKDY neodpovídej ničím jiným než tímto JSON formátem. Žádný markdown, žádný prostý text.`;

// ── Strip <thought> tags from Gemma output ────────────────────────────────
function stripThoughtTags(text) {
  return text.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();
}

// ── Parse response — expect JSON, fall back to wrapping plain text ────────
function parseAssistantResponse(raw) {
  const cleaned = stripThoughtTags(raw);

  // Try direct JSON parse
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.message === "string") {
      return {
        message: parsed.message,
        action: parsed.action || null,
      };
    }
  } catch {
    // not JSON
  }

  // Try extracting JSON from within text (```json blocks, etc.)
  const jsonMatch = cleaned.match(/\{[\s\S]*"message"\s*:[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed.message === "string") {
        return {
          message: parsed.message,
          action: parsed.action || null,
        };
      }
    } catch {
      // couldn't parse extracted JSON
    }
  }

  // Fallback — wrap plain text
  return {
    message: cleaned,
    action: null,
  };
}

// ── Handler ───────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  // Only POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // Rate limiting
  const clientIp =
    event.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    event.headers["client-ip"] ||
    "unknown";

  if (isRateLimited(clientIp)) {
    return {
      statusCode: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Příliš mnoho požadavků. Zkus to za chvíli.",
      }),
    };
  }

  // API key check
  const apiKey = process.env.GEMMA_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "API key not configured" }),
    };
  }

  // Parse body
  let messages;
  try {
    const body = JSON.parse(event.body);
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("messages must be a non-empty array");
    }
  } catch (err) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid request: " + err.message }),
    };
  }

  // Trim history to last MAX_HISTORY messages
  const trimmed = messages.slice(-MAX_HISTORY);

  // Build payload with system prompt
  const apiMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...trimmed,
  ];

  try {
    const response = await fetch(`${GEMMA_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemma API error:", response.status, errText);
      return {
        statusCode: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "AI service unavailable",
          message:
            "Omlouvám se, momentálně nemohu odpovědět. Zkus to prosím za chvíli.",
          action: null,
          usage: null,
        }),
      };
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";
    const { message, action } = parseAssistantResponse(rawContent);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        action,
        usage: data.usage || null,
      }),
    };
  } catch (err) {
    console.error("Function error:", err);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Internal error",
        message:
          "Omlouvám se, něco se pokazilo. Zkus to prosím za chvíli.",
        action: null,
        usage: null,
      }),
    };
  }
};
