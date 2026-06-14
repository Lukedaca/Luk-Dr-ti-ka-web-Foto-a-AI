// Experimentální streaming TTS endpoint (Netlify Functions v2).
// Gemini :streamGenerateContent (SSE) → dekóduje base64 audio chunky → streamuje
// klientovi jako binární PCM16 24kHz. Frontend plánuje chunky gapless do AudioContextu.
// Fallback: když selže / vrátí málo audia, frontend spadne na one-shot /tts.
//
// Pozn.: model gemini-3.1-flash-tts-preview má na SSE známé chyby (usekává >60s,
// občas vrací text místo audia). Text je tu ale ≤360 znaků (~pod 30s), takže 60s strop
// nehrozí; "málo audia" řeší fallback na klientu.

import { isAllowedOrigin } from "./_lib/security.mjs";
import { checkLimit } from "./_lib/limits.mjs";

const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview";
const GEMINI_TTS_VOICE = process.env.GEMINI_TTS_VOICE || "Sulafat";
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
    process.env.GEMINI_API_KEY ||
    process.env.GEMMA_API_KEY ||
    process.env.Gemini ||
    process.env.GEMINI ||
    ""
  ).trim();
}

function cleanTextForSpeech(value) {
  return String(value || "")
    .replace(/\[\[ACTION:[^\]]+\]\]/gi, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

function buildGeminiPrompt(text, lang) {
  const isEnglish = String(lang || "").toLowerCase().startsWith("en");
  return [
    isEnglish
      ? "Read exactly the text below as Lukas AI. Make the voice distinctive: warm studio partner, calm confidence, natural warmth, natural micro-pauses, no generic assistant tone, no sales pitch."
      : "Přečti přesně text níže jako Lukas AI. Hlas má být osobitý: vřelá studiová parťačka, klidná jistota, přirozená vřelost, přirozené krátké pauzy, žádný generický asistent ani reklamní tón.",
    text,
  ].join("\n");
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
  if (!apiKey) {
    return json(503, { error: "Gemini hlas není nastavený." });
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

  let upstream;
  try {
    upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_TTS_MODEL)}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildGeminiPrompt(text, lang) }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_TTS_VOICE } },
            },
          },
        }),
      }
    );
  } catch (err) {
    return json(502, { error: "TTS upstream fetch failed" });
  }

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    console.error("Gemini TTS stream error:", upstream.status, errText.slice(0, 300));
    return json(502, { error: "TTS stream failed", upstreamStatus: upstream.status });
  }

  // SSE → binární PCM stream pro klienta
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  (async () => {
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          let obj;
          try { obj = JSON.parse(payload); } catch (e) { continue; }
          const parts = (obj && obj.candidates && obj.candidates[0] && obj.candidates[0].content && obj.candidates[0].content.parts) || [];
          for (const p of parts) {
            const b64 = p && p.inlineData && p.inlineData.data;
            if (b64) {
              await writer.write(new Uint8Array(Buffer.from(b64, "base64")));
            }
          }
        }
      }
    } catch (err) {
      console.error("TTS stream pump error:", err && err.message);
    } finally {
      try { await writer.close(); } catch (e) {}
    }
  })();

  return new Response(readable, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "audio/pcm; rate=24000",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
};
