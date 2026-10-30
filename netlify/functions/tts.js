// ── Netlify Function: Google Gemini 3.8 TTS Endpoint ───────────────────────
// Synthesizes speech using Google Gemini 3.8 TTS (voice: Sulafat).
// Primary model: gemini-3.8-flash-lite-tts (fallback: gemini-3.8-flash-tts).
// Enforces server-side PII & prompt-leak validation before speech normalization.

const MAX_TEXT_LENGTH = 360;
const TTS_SAMPLE_RATE = 24000;
const TTS_CACHE_MAX = 80;
const DEFAULT_GEMINI_TTS_MODEL = "gemini-3.8-flash-lite-tts";
const FALLBACK_GEMINI_TTS_MODEL = "gemini-3.8-flash-tts";
const GEMINI_VOICE_NAME = "Sulafat";
const ALLOWED_PUBLIC_EMAILS = ["lukas.drsticka@gmail.com"];

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

function cleanTextForSpeech(value) {
  return String(value || "")
    .replace(/\[\[ACTION:[^\]]+\]\]/gi, " ")
    .replace(/<function=[a-zA-Z0-9_-]+>[\s\S]*?<\/function>/g, " ")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "")
    .replace(/(?:[:;=8xX]-?[)(/\\DPpOo]|\^_\^)/g, "")
    .replace(/[*_`~#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

function getGeminiApiKey() {
  return String(process.env.GEMINI_API_KEY || "").trim();
}

function getGeminiTtsModels() {
  const primary = String(process.env.GEMINI_TTS_MODEL || DEFAULT_GEMINI_TTS_MODEL).trim();
  const fallback = String(process.env.GEMINI_TTS_FALLBACK_MODEL || FALLBACK_GEMINI_TTS_MODEL).trim();
  return fallback && fallback !== primary ? [primary, fallback] : [primary];
}

function makeCacheKey(text, lang, voice) {
  return [
    "gemini",
    voice || GEMINI_VOICE_NAME,
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

async function generateGeminiSpeechPayload(apiKey, text, lang) {
  const { normalizeForSpeech } = await import("../../src/lib/speech-text.mjs");
  const { buildTtsPrompt, extractPcmFromBytes, audioLooksOverlong } = await import("../../src/lib/tts-guard.mjs");
  const locale = String(lang || "cs-CZ").trim();
  const normalizedText = normalizeForSpeech(text, locale);
  const promptText = buildTtsPrompt(normalizedText, locale);
  const models = getGeminiTtsModels();
  let lastError = null;

  for (const model of models) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: GEMINI_VOICE_NAME },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      const err = new Error(`Gemini TTS (${model}) failed: ${response.status}`);
      err.upstreamStatus = response.status;
      err.upstreamBody = errText.slice(0, 300);
      lastError = err;
      continue;
    }

    const data = await response.json().catch(() => ({}));
    const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    const rawB64 = inlineData?.data || "";
    if (!rawB64) {
      lastError = new Error(`Gemini TTS (${model}) returned empty audio`);
      continue;
    }

    const rawBytes = new Uint8Array(Buffer.from(rawB64, "base64"));
    const { pcmBytes, sampleRate } = extractPcmFromBytes(rawBytes, TTS_SAMPLE_RATE);
    if (audioLooksOverlong(normalizedText, pcmBytes.byteLength, sampleRate)) {
      lastError = new Error(`Gemini TTS (${model}) audio exceeded safety length guard`);
      continue;
    }

    const pcmB64 = Buffer.from(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.byteLength).toString("base64");
    return {
      audio: pcmB64,
      format: "pcm16",
      mimeType: "audio/pcm; rate=" + sampleRate,
      sampleRate,
      lang: locale,
      provider: "gemini",
      model,
      voice: GEMINI_VOICE_NAME,
    };
  }

  throw lastError || new Error("Gemini TTS failed across all configured models");
}

async function generateSpeechPayload({ apiKey, text, lang }) {
  const geminiKey = apiKey || getGeminiApiKey();
  if (!geminiKey) {
    throw new Error("GEMINI_API_KEY is not configured for Gemini TTS");
  }
  const cacheKey = makeCacheKey(text, lang, GEMINI_VOICE_NAME);
  const cached = getCachedAudio(cacheKey);
  if (cached) return { ...cached, cached: true };

  const speech = await generateGeminiSpeechPayload(geminiKey, text, lang);
  setCachedAudio(cacheKey, speech);
  return speech;
}

async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod === "GET" || event.httpMethod === "HEAD") {
    const apiKey = getGeminiApiKey();
    return jsonResponse(200, {
      ok: true,
      warm: true,
      provider: "gemini",
      configured: !!apiKey,
      voice: GEMINI_VOICE_NAME,
      model: DEFAULT_GEMINI_TTS_MODEL,
      format: "pcm16",
      sampleRate: TTS_SAMPLE_RATE,
      cacheSize: audioCache.size,
    });
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const candidateOrigin =
    event.headers["origin"] || event.headers["referer"] || "";
  const { isAllowedOrigin } = await import("./_lib/security.mjs");
  if (!isAllowedOrigin(candidateOrigin)) {
    return jsonResponse(403, { error: "forbidden" });
  }

  const clientIp =
    event.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    event.headers["client-ip"] ||
    "unknown";

  const { checkLimit } = await import("./_lib/limits.mjs");
  const rl = await checkLimit("tts", clientIp);
  if (!rl.ok) {
    return jsonResponse(429, { error: "Příliš mnoho TTS požadavků. Zkus to za chvíli." });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (err) {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const { validateTtsRequestSecurity } = await import("../../src/lib/chat-privacy.mjs");
  const sec = validateTtsRequestSecurity(body, { allowedPublicEmails: ALLOWED_PUBLIC_EMAILS });
  if (!sec.allowed) {
    return jsonResponse(sec.status, {
      error: sec.reason === "empty-text"
        ? "Chybí text pro hlas."
        : "Text obsahuje údaje, které nelze odeslat do externího TTS.",
      reason: sec.reason,
    });
  }

  const text = cleanTextForSpeech(body.text);
  const lang = typeof body.lang === "string" && body.lang.trim() ? body.lang.trim() : "cs-CZ";
  if (!text) {
    return jsonResponse(400, { error: "Chybí text pro hlas." });
  }

  const { canUseGeminiTts } = await import("../../src/lib/tenant-policy.mjs");
  if (!canUseGeminiTts(undefined, body.text, "visitor", true)) {
    return jsonResponse(403, { error: "Hlasový výstup není povolen politikou zpracování dat." });
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return jsonResponse(503, {
      error: "Gemini TTS hlas není nastavený. Nastav GEMINI_API_KEY v Netlify Environment variables.",
    });
  }

  try {
    const speech = await generateSpeechPayload({ apiKey, text, lang });
    return jsonResponse(200, speech);
  } catch (err) {
    console.error("TTS function error:", err);
    return jsonResponse(502, {
      error: "TTS se nepodařilo vygenerovat.",
      upstreamStatus: err?.upstreamStatus || null,
    });
  }
}

exports.handler = handler;
exports.generateSpeechPayload = generateSpeechPayload;
exports.generateGeminiSpeechPayload = generateGeminiSpeechPayload;
exports.cleanTextForSpeech = cleanTextForSpeech;
