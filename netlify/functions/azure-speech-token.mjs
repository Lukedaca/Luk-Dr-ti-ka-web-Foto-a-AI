// ── Netlify Function: Microsoft Azure AI Speech Ephemeral STS Token Issuer ──
// Issues short-lived authorization tokens (valid for 10 minutes) so that
// the Azure Speech API key never reaches the browser client.
// Used by the client-side Azure Speech SDK for real-time speech-to-text.

import { isAllowedOrigin } from "./_lib/security.mjs";
import { checkLimit } from "./_lib/limits.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(extraHeaders || {}),
    },
    body: JSON.stringify(body),
  };
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const candidateOrigin =
    event.headers["origin"] || event.headers["referer"] || "";
  if (!isAllowedOrigin(candidateOrigin)) {
    return jsonResponse(403, { error: "forbidden" });
  }

  const clientIp =
    event.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    event.headers["client-ip"] ||
    "unknown";

  const rl = await checkLimit("voice", clientIp);
  if (!rl.ok) {
    return jsonResponse(429, {
      error: "Příliš mnoho hlasových relací. Zkus to za chvíli.",
    });
  }

  const apiKey = String(
    process.env.AZURE_SPEECH_KEY ||
    process.env.SPEECH_KEY ||
    ""
  ).trim();

  const region = String(
    process.env.AZURE_SPEECH_REGION ||
    process.env.SPEECH_REGION ||
    "northeurope"
  ).trim().toLowerCase();

  if (!apiKey) {
    return jsonResponse(503, {
      error: "Azure Speech není nakonfigurován. Nastav AZURE_SPEECH_KEY.",
    });
  }

  const stsUrl = `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;

  try {
    const response = await fetch(stsUrl, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": "0",
      },
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("Azure Speech STS token error:", response.status, errText);
      return jsonResponse(502, {
        error: "Nepodařilo se získat Azure Speech token. Zkus to prosím za chvíli.",
      });
    }

    const token = (await response.text()).trim();
    if (!token) {
      return jsonResponse(502, { error: "Prázdný token z Azure STS." });
    }

    return jsonResponse(200, {
      token,
      region,
      provider: "azure-speech",
      voiceName: "cs-CZ-VlastaNeural",
      expiresInSeconds: 600,
    });
  } catch (err) {
    console.error("Azure Speech token function error:", err);
    return jsonResponse(500, {
      error: "Chyba při komunikaci s Azure Speech službou.",
    });
  }
};
