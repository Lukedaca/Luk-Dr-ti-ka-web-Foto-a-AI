// Gemini TTS endpoint for the hybrid agent.
// Returns base64 PCM16 (L16, 24kHz) — the existing browser AudioContext playback
// already expects this format, so it is a drop-in swap from OpenAI TTS.

const MAX_TTS_CHARS = 360;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 45;
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const TTS_VOICE = process.env.GEMINI_TTS_VOICE || "Puck";
const TTS_SAMPLE_RATE = 24000;
const TTS_CACHE_MAX = 80;

const ipHits = new Map();
const audioCache = new Map();

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

function makeCacheKey(text, lang) {
  return [TTS_MODEL, TTS_VOICE, String(lang || "cs-CZ").toLowerCase(), text].join("::");
}

function getCachedAudio(key) {
  if (!audioCache.has(key)) return null;
  const value = audioCache.get(key);
  audioCache.delete(key);
  audioCache.set(key, value);
  return value;
}

function setCachedAudio(key, value) {
  audioCache.set(key, value);
  while (audioCache.size > TTS_CACHE_MAX) {
    const firstKey = audioCache.keys().next().value;
    audioCache.delete(firstKey);
  }
}

function styleHint(lang) {
  const normalized = String(lang || "cs-CZ").toLowerCase();
  if (normalized.startsWith("en")) {
    return "Read in a warm, natural, conversational tone: ";
  }
  return "Přečti přirozeným, lidským a přátelským tónem, jako bys mluvil s kamarádem: ";
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders });
  }

  if (req.method === "GET") {
    return jsonResponse(200, {
      ok: true,
      warm: true,
      provider: "gemini",
      model: TTS_MODEL,
      voice: TTS_VOICE,
      sampleRate: TTS_SAMPLE_RATE,
      cacheSize: audioCache.size,
    });
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

  const apiKey = process.env.GEMMA_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, { error: "GEMMA_API_KEY není nastavený v Netlify Environment variables." });
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

  const cacheKey = makeCacheKey(text, lang);
  const cached = getCachedAudio(cacheKey);
  if (cached) {
    return jsonResponse(200, { ...cached, cached: true }, { "Server-Timing": "tts;dur=0;desc=cache" });
  }

  const styledText = `${styleHint(lang)}${text}`;
  const startedAt = Date.now();
  let response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(TTS_MODEL)}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: styledText }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: TTS_VOICE },
              },
            },
          },
        }),
      }
    );
  } catch (err) {
    console.error("Gemini TTS fetch error:", err);
    return jsonResponse(502, { error: "TTS služba teď neodpovídá." });
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error("Gemini TTS error:", response.status, errText.slice(0, 500));
    return jsonResponse(502, { error: "TTS se nepodařilo vygenerovat." });
  }

  const data = await response.json().catch(() => null);
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p?.inlineData?.data);
  const audio = part?.inlineData?.data;
  if (!audio) {
    console.error("Gemini TTS empty audio:", JSON.stringify(data).slice(0, 500));
    return jsonResponse(502, { error: "TTS vrátil prázdný audio výstup." });
  }

  const payload = {
    audio,
    sampleRate: TTS_SAMPLE_RATE,
    lang,
    model: TTS_MODEL,
    voice: TTS_VOICE,
  };

  setCachedAudio(cacheKey, payload);

  return jsonResponse(200, payload, {
    "Server-Timing": `tts;dur=${Date.now() - startedAt};desc=gemini`,
  });
};
