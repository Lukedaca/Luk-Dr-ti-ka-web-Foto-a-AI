const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const GEMINI_TTS_VOICE = process.env.GEMINI_TTS_VOICE || "Charon";
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || "sage";
const OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech";
const MAX_TEXT_LENGTH = 360;
const TTS_SAMPLE_RATE = 24000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const TTS_CACHE_MAX = 80;

const ipHits = new Map();
const audioCache = new Map();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(extraHeaders || {}),
    },
    body: JSON.stringify(body),
  };
}

function isRateLimited(ip) {
  const now = Date.now();
  let hits = ipHits.get(ip) || [];
  hits = hits.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
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
    .slice(0, MAX_TEXT_LENGTH);
}

function makeCacheKey(provider, text, lang) {
  return [
    provider,
    provider === "openai" ? OPENAI_TTS_MODEL : GEMINI_TTS_MODEL,
    provider === "openai" ? OPENAI_TTS_VOICE : GEMINI_TTS_VOICE,
    String(lang || "cs-CZ").toLowerCase(),
    text,
  ].join("::");
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

function buildOpenAiInstructions(lang) {
  const isEnglish = String(lang || "").toLowerCase().startsWith("en");
  return isEnglish
    ? "Voice for Lukas AI: sound like a focused creative studio partner, not a generic assistant. Warm, calm, modern, slightly lower register, with a subtle human smile. Use natural micro-pauses after commas, keep energy controlled, avoid radio-announcer, call-center or salesy intonation. Speak exactly the input text."
    : "Hlas pro Lukas AI: zni jako soustředěný kreativní parťák ze studia, ne jako generický asistent. Přirozeně česky, klidně, teple, trochu nižší poloha hlasu, civilní energie a jemný úsměv v hlase. Dělej krátké lidské pauzy po čárkách, nezněj jako reklama, moderátor ani call centrum. Přečti přesně zadaný text.";
}

function buildGeminiPrompt(text, lang) {
  const isEnglish = String(lang || "").toLowerCase().startsWith("en");
  return [
    isEnglish
      ? "Read exactly the text below as Lukas AI. Make the voice distinctive: warm studio partner, calm confidence, slightly lower register, natural micro-pauses, no generic assistant tone, no sales pitch."
      : "Přečti přesně text níže jako Lukas AI. Hlas má být osobitý: teplý studiový parťák, klidná jistota, trochu nižší poloha, přirozené krátké pauzy, žádný generický asistent ani reklamní tón.",
    text,
  ].join("\n");
}

async function generateOpenAiSpeechPayload(apiKey, text, lang) {
  const response = await fetch(OPENAI_SPEECH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_TTS_MODEL,
      voice: OPENAI_TTS_VOICE,
      input: text,
      instructions: buildOpenAiInstructions(lang),
      response_format: "pcm",
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error("OpenAI TTS error:", response.status, errText.slice(0, 500));
    throw new Error(`OpenAI TTS failed: ${response.status}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  if (!audioBuffer.length) {
    throw new Error("OpenAI TTS returned empty audio");
  }

  return {
    audio: audioBuffer.toString("base64"),
    mimeType: "audio/pcm;rate=24000",
    sampleRate: TTS_SAMPLE_RATE,
    lang,
    provider: "openai",
    model: OPENAI_TTS_MODEL,
    voice: OPENAI_TTS_VOICE,
  };
}

async function generateGeminiSpeechPayload(apiKey, text, lang) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_TTS_MODEL)}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildGeminiPrompt(text, lang) }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: GEMINI_TTS_VOICE },
            },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error("Gemini TTS error:", response.status, errText.slice(0, 500));
    throw new Error(`Gemini TTS failed: ${response.status}`);
  }

  const data = await response.json().catch(() => null);
  const inlineData = data?.candidates?.[0]?.content?.parts?.find((part) => part?.inlineData?.data)?.inlineData;
  if (!inlineData?.data) {
    console.error("Gemini TTS empty audio:", JSON.stringify(data).slice(0, 500));
    throw new Error("Gemini TTS returned empty audio");
  }

  return {
    audio: inlineData.data,
    mimeType: inlineData.mimeType || "audio/pcm;rate=24000",
    sampleRate: TTS_SAMPLE_RATE,
    lang,
    provider: "gemini",
    model: GEMINI_TTS_MODEL,
    voice: GEMINI_TTS_VOICE,
  };
}

async function generateSpeechPayload({ openAiApiKey, geminiApiKey, text, lang }) {
  const providers = [];
  if (openAiApiKey) providers.push("openai");
  if (geminiApiKey) providers.push("gemini");

  let lastError = null;
  for (const provider of providers) {
    const cacheKey = makeCacheKey(provider, text, lang);
    const cached = getCachedAudio(cacheKey);
    if (cached) return { ...cached, cached: true };

    try {
      const speech = provider === "openai"
        ? await generateOpenAiSpeechPayload(openAiApiKey, text, lang)
        : await generateGeminiSpeechPayload(geminiApiKey, text, lang);
      setCachedAudio(cacheKey, speech);
      return speech;
    } catch (err) {
      lastError = err;
      console.warn(`${provider} TTS failed, trying next provider if available:`, err?.message || err);
    }
  }

  throw lastError || new Error("No TTS provider configured");
}

async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod === "GET" || event.httpMethod === "HEAD") {
    return jsonResponse(200, {
      ok: true,
      warm: true,
      providers: {
        openai: !!process.env.OPENAI_API_KEY,
        gemini: !!process.env.GEMMA_API_KEY,
      },
      model: process.env.OPENAI_API_KEY ? OPENAI_TTS_MODEL : GEMINI_TTS_MODEL,
      sampleRate: TTS_SAMPLE_RATE,
      cacheSize: audioCache.size,
    });
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const clientIp =
    event.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    event.headers["client-ip"] ||
    "unknown";

  if (isRateLimited(clientIp)) {
    return jsonResponse(429, { error: "Příliš mnoho TTS požadavků. Zkus to za chvíli." });
  }

  const openAiApiKey = process.env.OPENAI_API_KEY;
  const geminiApiKey = process.env.GEMMA_API_KEY;
  if (!openAiApiKey && !geminiApiKey) {
    return jsonResponse(503, { error: "TTS API key není nastavený." });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (err) {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const text = cleanTextForSpeech(body.text);
  const lang = typeof body.lang === "string" && body.lang.trim() ? body.lang.trim() : "cs-CZ";
  if (!text) {
    return jsonResponse(400, { error: "Chybí text pro hlas." });
  }

  try {
    const speech = await generateSpeechPayload({ openAiApiKey, geminiApiKey, text, lang });
    return jsonResponse(200, speech);
  } catch (err) {
    console.error("TTS function error:", err);
    return jsonResponse(502, { error: "TTS se nepodařilo vygenerovat." });
  }
}

exports.handler = handler;
exports.generateSpeechPayload = generateSpeechPayload;
exports.cleanTextForSpeech = cleanTextForSpeech;
