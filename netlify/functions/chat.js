// ── Netlify Function: Gemma 4 Chat Proxy ──────────────────────────────────
// Secure backend proxy — API key lives ONLY in Netlify env vars (GEMMA_API_KEY)
// Uses Google Generative Language API (generateContent) — NOT OpenAI format

const MODEL = "gemma-4-31b-it";
const MAX_HISTORY = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 15;

// ── Rate limiter (in-memory, per function instance) ───────────────────────
const ipHits = new Map();

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
• Web: lukasdrsticka-ai-and-foto.com
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
      return { message: parsed.message, action: parsed.action || null };
    }
  } catch { /* not JSON */ }

  // Try extracting JSON from within text
  const jsonMatch = cleaned.match(/\{[\s\S]*"message"\s*:[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed.message === "string") {
        return { message: parsed.message, action: parsed.action || null };
      }
    } catch { /* couldn't parse */ }
  }

  // Fallback — wrap plain text
  return { message: cleaned, action: null };
}

// ── Convert OpenAI-style messages to Gemini contents format ───────────────
function convertToGeminiContents(messages) {
  return messages.map(function (m) {
    return {
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    };
  });
}

// ── Handler ───────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

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

  const apiKey = process.env.GEMMA_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "API key not configured" }),
    };
  }

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

  const trimmed = messages.slice(-MAX_HISTORY);
  const contents = convertToGeminiContents(trimmed);

  // Gemini generateContent payload
  const payload = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  };

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemma API error:", response.status, errText);
      return {
        statusCode: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "AI service unavailable",
          message: "Omlouvám se, momentálně nemohu odpovědět. Zkus to prosím za chvíli.",
          action: null,
        }),
      };
    }

    const data = await response.json();
    // Filter out thought parts (Gemma returns {thought:true} parts)
    const parts = data.candidates?.[0]?.content?.parts || [];
    const textParts = parts.filter((p) => !p.thought);
    const rawContent = textParts.map((p) => p.text).join("") || "";
    const { message, action } = parseAssistantResponse(rawContent);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        action,
        usage: data.usageMetadata || null,
      }),
    };
  } catch (err) {
    console.error("Function error:", err);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Internal error",
        message: "Omlouvám se, něco se pokazilo. Zkus to prosím za chvíli.",
        action: null,
      }),
    };
  }
};
