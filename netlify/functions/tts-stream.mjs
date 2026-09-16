// ── Streaming TTS endpoint (Netlify Functions v2) ───────────────────────────
// Microsoft Azure AI Speech REST API → streams raw binary PCM16 24kHz directly
// to the client as chunks arrive. Frontend plans chunks gapless into AudioContext.

import { isAllowedOrigin } from "./_lib/security.mjs";
import { checkLimit } from "./_lib/limits.mjs";

const MAX_TEXT_LENGTH = 360;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getApiKey() {
  return String(
    process.env.AZURE_SPEECH_KEY ||
    process.env.SPEECH_KEY ||
    ""
  ).trim();
}

function getRegion() {
  return String(
    process.env.AZURE_SPEECH_REGION ||
    process.env.SPEECH_REGION ||
    "northeurope"
  ).trim().toLowerCase();
}

function getVoice(locale) {
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

function cleanTextForSpeech(value) {
  return String(value || "")
    .replace(/\[\[ACTION:[^\]]+\]\]/gi, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  if (!isAllowedOrigin(origin)) {
    return json(403, { error: "forbidden" });
  }

  const clientIp =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.headers.get("client-ip") ||
    "unknown";
  const rl = await checkLimit("tts", clientIp);
  if (!rl.ok) {
    return json(429, { error: "Příliš mnoho TTS požadavků. Zkus to za chvíli." });
  }

  const apiKey = getApiKey();
  const region = getRegion();
  if (!apiKey) {
    return json(503, { error: "Azure Speech hlas není nastavený." });
  }

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return json(400, { error: "Invalid JSON body" });
  }

  const text = cleanTextForSpeech(body && body.text);
  const lang = typeof (body && body.lang) === "string" && body.lang.trim() ? body.lang.trim() : "cs-CZ";
  if (!text) {
    return json(400, { error: "Chybí text pro hlas." });
  }

  const voice = getVoice(lang);
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${escapeXml(lang)}"><voice name="${escapeXml(voice)}">${escapeXml(text)}</voice></speak>`;

  let upstream;
  try {
    upstream = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": apiKey,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "raw-24khz-16bit-mono-pcm",
          "User-Agent": "lukas-portfolio",
        },
        body: ssml,
      }
    );
  } catch (err) {
    return json(502, { error: "Azure Speech TTS upstream fetch failed" });
  }

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    console.error("Azure Speech TTS stream error:", upstream.status, errText.slice(0, 300));
    return json(502, { error: "TTS stream failed", upstreamStatus: upstream.status });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "audio/pcm; rate=24000",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
};
