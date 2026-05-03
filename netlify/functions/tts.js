const MODEL = "gemini-2.5-flash-preview-tts";
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || "coral";
const OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech";
const MAX_TEXT_LENGTH = 1800;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

const ipHits = new Map();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

function buildOpenAiInstructions(lang) {
  const isEnglish = String(lang || "").toLowerCase().startsWith("en");
  return isEnglish
    ? "Voice for Lukas AI: natural, warm, clear, modern, calm and confident. Neutral international English accent. Keep a conversational pace and speak exactly the input text."
    : "Hlas pro Lukas AI: prirozeny, prijemny, jasny, moderni, klidny a sebejisty. Mluv cesky, civilne, bez prehnane reklamnich intonaci. Drz konverzacni tempo a precti presne zadany text.";
}

async function generateOpenAiSpeechPayload(apiKey, text, lang) {
  const safeText = typeof text === "string" ? text.trim() : "";
  const safeLang = typeof lang === "string" && lang.trim() ? lang.trim() : "cs-CZ";

  if (!safeText) {
    throw new Error("Text is required");
  }

  if (safeText.length > MAX_TEXT_LENGTH) {
    throw new Error("Text is too long");
  }

  const response = await fetch(OPENAI_SPEECH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_TTS_MODEL,
      voice: OPENAI_TTS_VOICE,
      input: safeText,
      instructions: buildOpenAiInstructions(safeLang),
      response_format: "pcm",
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error("OpenAI TTS error:", response.status, errText);
    throw new Error("OpenAI TTS service unavailable");
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  if (!audioBuffer.length) {
    throw new Error("No audio returned from OpenAI TTS service");
  }

  return {
    audio: audioBuffer.toString("base64"),
    mimeType: "audio/pcm;rate=24000",
    sampleRate: 24000,
    voiceName: OPENAI_TTS_VOICE,
    lang: safeLang,
    provider: "openai",
    model: OPENAI_TTS_MODEL,
  };
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

  if (event.httpMethod === "GET" || event.httpMethod === "HEAD") {
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

  const openAiApiKey = process.env.OPENAI_API_KEY;
  const gemmaApiKey = process.env.GEMMA_API_KEY;
  if (!openAiApiKey && !gemmaApiKey) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "TTS API key not configured" }),
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
    let speech;
    if (openAiApiKey) {
      try {
        speech = await generateOpenAiSpeechPayload(openAiApiKey, text, lang);
      } catch (openAiErr) {
        if (!gemmaApiKey) throw openAiErr;
        console.warn("OpenAI TTS failed, falling back to Gemini TTS:", openAiErr);
      }
    }

    if (!speech) {
      speech = await generateSpeechPayload(gemmaApiKey, text, lang);
    }

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
