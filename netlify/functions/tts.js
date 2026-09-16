// ── Netlify Function: Microsoft Azure AI Speech TTS Endpoint ───────────────
// Synthesizes speech using Azure Cognitive Services Speech REST API.
// Default voice: cs-CZ-VlastaNeural (cs-CZ), en-US-JennyNeural (en-US).
// Output format: audio-24khz-48kbitrate-mono-mp3.
// In-memory LRU cache prevents duplicate API calls for identical phrases.

const MAX_TEXT_LENGTH = 360;
const TTS_SAMPLE_RATE = 24000;
const TTS_CACHE_MAX = 80;

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
    .replace(/\[\[ACTION:[^\]]+\]\]/gi, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

function getAzureSpeechApiKey() {
  return String(
    process.env.AZURE_SPEECH_KEY ||
    process.env.SPEECH_KEY ||
    ""
  ).trim();
}

function getAzureSpeechRegion() {
  return String(
    process.env.AZURE_SPEECH_REGION ||
    process.env.SPEECH_REGION ||
    "northeurope"
  ).trim().toLowerCase();
}

function getVoiceForLocale(locale) {
  const norm = String(locale || "cs-CZ").trim();
  if (norm.toLowerCase().startsWith("en")) {
    return process.env.AZURE_SPEECH_VOICE_EN || "en-US-JennyNeural";
  }
  return process.env.AZURE_SPEECH_VOICE_CS || "cs-CZ-VlastaNeural";
}

function escapeXml(value) {
  return String(value || "").replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return char;
    }
  });
}

function makeCacheKey(provider, text, lang, voice) {
  return [
    provider,
    voice,
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

async function generateAzureSpeechPayload(apiKey, region, text, lang) {
  const voice = getVoiceForLocale(lang);
  const locale = String(lang || "cs-CZ").trim();
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${escapeXml(locale)}"><voice name="${escapeXml(voice)}">${escapeXml(text)}</voice></speak>`;

  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "lukas-portfolio",
    },
    body: ssml,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error("Azure Speech TTS error:", response.status, errText.slice(0, 500));
    const err = new Error(`Azure Speech TTS failed: ${response.status}`);
    err.upstreamStatus = response.status;
    err.upstreamBody = errText.slice(0, 300);
    throw err;
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64Audio = Buffer.from(arrayBuffer).toString("base64");

  if (!base64Audio) {
    throw new Error("Azure Speech TTS returned empty audio");
  }

  return {
    audio: base64Audio,
    format: "mp3",
    mimeType: "audio/mpeg",
    sampleRate: TTS_SAMPLE_RATE,
    lang: locale,
    provider: "azure-speech",
    voice,
    region,
  };
}

async function generateSpeechPayload({ apiKey, region, text, lang }) {
  const resolvedKey = apiKey || getAzureSpeechApiKey();
  const resolvedRegion = region || getAzureSpeechRegion();
  const voice = getVoiceForLocale(lang);
  const cacheKey = makeCacheKey("azure-speech", text, lang, voice);
  const cached = getCachedAudio(cacheKey);
  if (cached) return { ...cached, cached: true };

  const speech = await generateAzureSpeechPayload(resolvedKey, resolvedRegion, text, lang);
  setCachedAudio(cacheKey, speech);
  return speech;
}

async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod === "GET" || event.httpMethod === "HEAD") {
    const apiKey = getAzureSpeechApiKey();
    const region = getAzureSpeechRegion();
    return jsonResponse(200, {
      ok: true,
      warm: true,
      provider: "azure-speech",
      configured: !!apiKey,
      region,
      voice: getVoiceForLocale("cs-CZ"),
      format: "audio-24khz-48kbitrate-mono-mp3",
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

  const apiKey = getAzureSpeechApiKey();
  const region = getAzureSpeechRegion();
  if (!apiKey) {
    return jsonResponse(503, {
      error: "Azure Speech hlas není nastavený. Nastav AZURE_SPEECH_KEY v Netlify Environment variables.",
    });
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
    const speech = await generateSpeechPayload({ apiKey, region, text, lang });
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
exports.cleanTextForSpeech = cleanTextForSpeech;
