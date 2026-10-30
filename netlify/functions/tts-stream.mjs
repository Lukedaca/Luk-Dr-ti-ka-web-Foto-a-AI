// ── Streaming TTS endpoint (Netlify Functions v2) ───────────────────────────
// Google Gemini 3.8 TTS (voice: Sulafat) → streams raw binary PCM16 24kHz directly
// to the client as chunks arrive. Frontend plans chunks gapless into AudioContext.
// Primary model: gemini-3.8-flash-lite-tts (fallback: gemini-3.8-flash-tts).

import { isAllowedOrigin } from "./_lib/security.mjs";
import { checkLimit } from "./_lib/limits.mjs";
import { validateTtsRequestSecurity } from "../../src/lib/chat-privacy.mjs";
import { cleanTextForSpeech as cleanSpeechText, normalizeForSpeech } from "../../src/lib/speech-text.mjs";
import { buildTtsPrompt, extractPcmFromBytes } from "../../src/lib/tts-guard.mjs";
import { canUseGeminiTts } from "../../src/lib/tenant-policy.mjs";

const MAX_TEXT_LENGTH = 360;
const DEFAULT_GEMINI_TTS_MODEL = "gemini-3.8-flash-lite-tts";
const FALLBACK_GEMINI_TTS_MODEL = "gemini-3.8-flash-tts";
const GEMINI_VOICE_NAME = "Sulafat";
const ALLOWED_PUBLIC_EMAILS = ["lukas.drsticka@gmail.com"];

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

function getGeminiApiKey() {
  return String(process.env.GEMINI_API_KEY || "").trim();
}

function getGeminiTtsModels() {
  const primary = String(process.env.GEMINI_TTS_MODEL || DEFAULT_GEMINI_TTS_MODEL).trim();
  const fallback = String(process.env.GEMINI_TTS_FALLBACK_MODEL || FALLBACK_GEMINI_TTS_MODEL).trim();
  return fallback && fallback !== primary ? [primary, fallback] : [primary];
}

function cleanTextForSpeech(value) {
  return cleanSpeechText(value).slice(0, MAX_TEXT_LENGTH);
}

async function streamGeminiPcm(geminiKey, normalizedText, lang) {
  const promptText = buildTtsPrompt(normalizedText, lang);
  const models = getGeminiTtsModels();

  for (const model of models) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiKey,
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
    }).catch(() => null);

    if (!upstream || !upstream.ok || !upstream.body) {
      continue;
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = "";

    const pcmStream = new ReadableStream({
      async pull(controller) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split(/\r?\n/);
          sseBuffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const rawJson = line.slice(5).trim();
            if (!rawJson || rawJson === "[DONE]") continue;
            try {
              const parsed = JSON.parse(rawJson);
              const b64 = parsed?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
              if (b64) {
                const rawBytes = new Uint8Array(Buffer.from(b64, "base64"));
                const { pcmBytes } = extractPcmFromBytes(rawBytes, 24000);
                if (pcmBytes.byteLength > 0) {
                  controller.enqueue(pcmBytes);
                }
              }
            } catch {
              // ignore malformed SSE fragment
            }
          }
        }
      },
      cancel() {
        try { reader.cancel(); } catch {}
      },
    });

    return new Response(pcmStream, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/pcm; rate=24000",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  }

  return json(502, { error: "Gemini TTS stream failed" });
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

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return json(400, { error: "Invalid JSON body" });
  }

  const sec = validateTtsRequestSecurity(body, { allowedPublicEmails: ALLOWED_PUBLIC_EMAILS });
  if (!sec.allowed) {
    return json(sec.status, {
      error: sec.reason === "empty-text"
        ? "Chybí text pro hlas."
        : "Text obsahuje údaje, které nelze odeslat do externího TTS.",
      reason: sec.reason,
    });
  }

  const text = cleanTextForSpeech(body && body.text);
  const lang = typeof (body && body.lang) === "string" && body.lang.trim() ? body.lang.trim() : "cs-CZ";
  if (!text) {
    return json(400, { error: "Chybí text pro hlas." });
  }

  if (!canUseGeminiTts(undefined, body.text, "visitor", true)) {
    return json(403, { error: "Hlasový výstup není povolen politikou zpracování dat." });
  }

  const geminiKey = getGeminiApiKey();
  if (!geminiKey) {
    return json(503, { error: "Gemini TTS hlas není nastavený. Nastav GEMINI_API_KEY." });
  }

  const normalizedText = normalizeForSpeech(text, lang);
  return streamGeminiPcm(geminiKey, normalizedText, lang);
};
