// OpenAI TTS endpoint for the hybrid agent.
// Returns base64 PCM16 so the existing browser AudioContext playback can use it directly.

const MAX_TTS_CHARS = 650;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const TTS_VOICE = process.env.OPENAI_TTS_VOICE || "alloy";
const TTS_SAMPLE_RATE = 24000;

const ipHits = new Map();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

function jsonResponse(status, body, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(extraHeaders || {}),
    },
  });
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

function cleanTextForSpeech(value) {
  return String(value || "")
    .replace(/\[\[ACTION:[^\]]+\]\]/gi, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TTS_CHARS);
}

function voiceInstructions(lang) {
  const normalized = String(lang || "cs-CZ").toLowerCase();
  if (normalized.startsWith("en")) {
    return "Speak naturally, clearly and briefly. Friendly confident tone, not over-dramatic.";
  }
  return "Mluv přirozeně česky, jasně a krátce. Přátelský sebevědomý tón, žádné přehrávání.";
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders });
  }

  if (req.method === "GET") {
    return jsonResponse(200, { ok: true, provider: "openai", model: TTS_MODEL, voice: TTS_VOICE, sampleRate: TTS_SAMPLE_RATE });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const clientIp =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.headers.get("client-ip") ||
    "unknown";

  if (isRateLimited(clientIp)) {
    return jsonResponse(429, { error: "Příliš mnoho TTS požadavků. Zkus to za chvíli." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, { error: "OPENAI_API_KEY není nastavený v Netlify Environment variables." });
  }

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const text = cleanTextForSpeech(body.text);
  const lang = typeof body.lang === "string" ? body.lang : "cs-CZ";
  if (!text) {
    return jsonResponse(400, { error: "Chybí text pro hlas." });
  }

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        voice: TTS_VOICE,
        input: text,
        instructions: voiceInstructions(lang),
        response_format: "pcm",
        speed: 1.02,
      }),
    });
  } catch (err) {
    console.error("OpenAI TTS fetch error:", err);
    return jsonResponse(502, { error: "TTS služba teď neodpovídá." });
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error("OpenAI TTS error:", response.status, errText);
    return jsonResponse(502, { error: "TTS se nepodařilo vygenerovat." });
  }

  const arrayBuffer = await response.arrayBuffer();
  const audio = Buffer.from(arrayBuffer).toString("base64");

  return jsonResponse(200, {
    audio,
    sampleRate: TTS_SAMPLE_RATE,
    lang,
    model: TTS_MODEL,
    voice: TTS_VOICE,
  });
};
