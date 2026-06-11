// ── Netlify Function: Ephemeral Token Generator for Gemini Live API ────────
// Generates short-lived tokens so the API key never reaches the client.
// Rate limited to 3 voice sessions per IP per hour.

const GEMINI_LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview";
const GEMINI_LIVE_VOICE = process.env.GEMINI_LIVE_VOICE || "Charon";

// ── CORS headers ──────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Handler ───────────────────────────────────────────────────────────────
exports.handler = async (event) => {
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

  const candidateOrigin =
    event.headers["origin"] || event.headers["referer"] || "";
  const { isAllowedOrigin } = await import("./_lib/security.mjs");
  if (!isAllowedOrigin(candidateOrigin)) {
    return {
      statusCode: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "forbidden" }),
    };
  }

  const clientIp =
    event.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    event.headers["client-ip"] ||
    "unknown";

  const { checkLimit } = await import("./_lib/limits.mjs");
  const rl = await checkLimit("voice", clientIp);
  if (!rl.ok) {
    return {
      statusCode: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Příliš mnoho hlasových relací. Zkus to za hodinu.",
      }),
    };
  }

  const apiKey = String(process.env.GEMINI_API_KEY || process.env.GEMMA_API_KEY || "").trim();
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "API key not configured" }),
    };
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_LIVE_MODEL)}:generateEphemeralToken?key=${apiKey}`;

  const payload = {
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        languageCode: "cs-CZ",
      },
    },
  };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini ephemeral token error:", response.status, errText);
      return {
        statusCode: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Nepodařilo se získat hlasový token. Zkus to prosím za chvíli.",
        }),
      };
    }

    const data = await response.json();

    if (!data.token) {
      console.error("Unexpected token response:", JSON.stringify(data));
      return {
        statusCode: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Nepodařilo se získat hlasový token.",
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        token: data.token,
        voiceName: GEMINI_LIVE_VOICE,
        expiresAt: data.expiresAt || data.expirationTime || Date.now() + 120_000,
      }),
    };
  } catch (err) {
    console.error("Voice token function error:", err);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Omlouvám se, něco se pokazilo. Zkus to prosím za chvíli.",
      }),
    };
  }
};
