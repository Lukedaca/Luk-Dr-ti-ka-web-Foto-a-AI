const MODEL = "gemini-2.5-flash-preview-tts";
const MAX_TEXT_LENGTH = 1800;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 25;

const ipHits = new Map();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

function buildPrompt(text, lang) {
  const isEnglish = String(lang || "").toLowerCase().startsWith("en");
  const accentLine = isEnglish
    ? "Accent: neutral international English, natural and modern, never radio-announcer style."
    : "Accent: clear contemporary Czech, natural and civil, never synthetic or overacted.";

  return [
    "# AUDIO PROFILE: Lukas AI",
    "A warm, modern digital voice for Lukas AI. It should sound human, calm, confident and premium.",
    "### DIRECTOR'S NOTES",
    "Style: friendly, natural, intelligent, non-robotic, non-salesy, no exaggerated hype.",
    accentLine,
    "Pacing: conversational, smooth and slightly brisk, with short natural pauses.",
    "Delivery: speak exactly the transcript below, keep articulation clean and intimate.",
    "### TRANSCRIPT",
    text,
  ].join("\n");
}

async function generateSpeechPayload(apiKey, text, lang) {
  const safeText = typeof text === "string" ? text.trim() : "";
  const safeLang = typeof lang === "string" && lang.trim() ? lang.trim() : "cs-CZ";

  if (!safeText) {
    throw new Error("Text is required");
  }

  if (safeText.length > MAX_TEXT_LENGTH) {
    throw new Error("Text is too long");
  }

  const voiceName = String(safeLang).toLowerCase().startsWith("en") ? "Achird" : "Sulafat";
  const payload = {
    contents: [{
      parts: [{
        text: buildPrompt(safeText, safeLang),
      }],
    }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName,
          },
        },
      },
    },
  };

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini TTS error:", response.status, errText);
    throw new Error("TTS service unavailable");
  }

  const data = await response.json();
  const inlineData = data.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData;
  if (!inlineData?.data) {
    console.error("Unexpected TTS response:", JSON.stringify(data));
    throw new Error("No audio returned from TTS service");
  }

  return {
    audio: inlineData.data,
    mimeType: inlineData.mimeType || "audio/pcm;rate=24000",
    sampleRate: 24000,
    voiceName,
    lang: safeLang,
  };
}

async function handler(event) {
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
      body: JSON.stringify({ error: "Too many TTS requests. Try again in a minute." }),
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

  let text = "";
  let lang = "cs-CZ";

  try {
    const body = JSON.parse(event.body || "{}");
    text = typeof body.text === "string" ? body.text.trim() : "";
    lang = typeof body.lang === "string" && body.lang.trim() ? body.lang.trim() : "cs-CZ";
  } catch (err) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  try {
    const speech = await generateSpeechPayload(apiKey, text, lang);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(speech),
    };
  } catch (err) {
    console.error("TTS function error:", err);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Internal TTS error" }),
    };
  }
}

exports.handler = handler;
exports.generateSpeechPayload = generateSpeechPayload;
