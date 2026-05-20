// Security primitives for Netlify Functions.
// All checks degrade gracefully when env vars are missing (dev mode).

const ALLOWED_ORIGINS = [
  "https://lukasdrsticka-ai-and-foto.com",
  "https://www.lukasdrsticka-ai-and-foto.com",
  "https://lukas-drsticka.netlify.app",
];

const ALLOWED_DEV_PATTERNS = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^https:\/\/.+\.netlify\.app$/,
];

const BOT_USER_AGENTS = [
  /curl\//i,
  /wget\//i,
  /python-requests/i,
  /python-urllib/i,
  /go-http-client/i,
  /scrapy/i,
  /headless/i,
  /phantomjs/i,
  /^$/,
];

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /disregard\s+(all\s+)?(previous|prior|above)/i,
  /<\/?\s*system\s*>/i,
  /\[\[system\]\]/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /forget\s+(everything|all|your\s+instructions)/i,
  /reveal\s+(your|the)\s+(system\s+)?prompt/i,
  /act\s+as\s+(if\s+)?you\s+(are|were)\s+/i,
];

function checkOrigin(req) {
  const origin = req.headers.get("origin") || "";
  const referer = req.headers.get("referer") || "";
  const candidate = origin || referer;
  if (!candidate) return { ok: false, reason: "missing_origin" };

  if (ALLOWED_ORIGINS.some((allowed) => candidate.startsWith(allowed))) {
    return { ok: true };
  }
  if (ALLOWED_DEV_PATTERNS.some((re) => re.test(candidate))) {
    return { ok: true, dev: true };
  }
  return { ok: false, reason: "origin_not_allowed", origin: candidate };
}

function checkHoneypot(body) {
  const honey = body && (body._company_website || body.honeypot || body._website);
  if (typeof honey === "string" && honey.trim().length > 0) {
    return { ok: false, reason: "honeypot_filled" };
  }
  return { ok: true };
}

function checkUserAgent(req) {
  const ua = req.headers.get("user-agent") || "";
  if (!ua) return { ok: false, reason: "missing_user_agent" };
  if (BOT_USER_AGENTS.some((re) => re.test(ua))) {
    return { ok: false, reason: "bot_user_agent", ua };
  }
  const acceptLang = req.headers.get("accept-language") || "";
  if (!acceptLang) return { ok: false, reason: "missing_accept_language", soft: true };
  return { ok: true };
}

async function verifyTurnstile(token, remoteIp) {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) {
    return { ok: true, skipped: true, reason: "turnstile_not_configured" };
  }
  if (!token || typeof token !== "string") {
    return { ok: false, reason: "missing_turnstile_token" };
  }
  try {
    const formData = new URLSearchParams();
    formData.append("secret", secret);
    formData.append("response", token);
    if (remoteIp) formData.append("remoteip", remoteIp);

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      }
    );
    const data = await response.json();
    if (data.success === true) return { ok: true };
    return {
      ok: false,
      reason: "turnstile_failed",
      errors: data["error-codes"] || [],
    };
  } catch (err) {
    console.error("Turnstile verify error:", err);
    return { ok: false, reason: "turnstile_network_error" };
  }
}

function detectPromptInjection(text) {
  if (typeof text !== "string") return { detected: false };
  const matches = [];
  for (const re of PROMPT_INJECTION_PATTERNS) {
    if (re.test(text)) matches.push(re.source);
  }
  return { detected: matches.length > 0, patterns: matches };
}

function sanitizeInput(text, maxLen = 700) {
  if (typeof text !== "string") return "";
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .slice(0, maxLen)
    .trim();
}

function getClientIp(req) {
  const xff = req.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0].trim();
  return first || req.headers.get("client-ip") || req.headers.get("x-nf-client-connection-ip") || "unknown";
}

async function logAnomaly(event) {
  const entry = {
    ts: new Date().toISOString(),
    ...event,
  };
  console.warn("[anomaly]", JSON.stringify(entry));
  try {
    const { recordEvent } = await import("./security-monitor.mjs");
    const { kind, ip, ua, ...rest } = entry;
    await recordEvent(kind || "anomaly", { ip, ua, ...rest });
  } catch (err) {
    console.error("[security] recordEvent dispatch failed:", err.message);
  }
}

async function runSecurityChecks(req, body, options = {}) {
  const ip = getClientIp(req);
  const checks = {};

  const originResult = checkOrigin(req);
  checks.origin = originResult;
  if (!originResult.ok) {
    await logAnomaly({ kind: "origin_blocked", ip, ...originResult });
    return { ok: false, status: 403, reason: originResult.reason, ip };
  }

  const honeyResult = checkHoneypot(body);
  checks.honeypot = honeyResult;
  if (!honeyResult.ok) {
    await logAnomaly({ kind: "honeypot_triggered", ip });
    return { ok: false, status: 200, silent: true, reason: "honeypot", ip };
  }

  const uaResult = checkUserAgent(req);
  checks.ua = uaResult;
  if (!uaResult.ok && !uaResult.soft) {
    await logAnomaly({ kind: "bot_ua_blocked", ip, reason: uaResult.reason, ua: uaResult.ua });
    return { ok: false, status: 403, reason: uaResult.reason, ip };
  }

  if (options.requireTurnstile !== false) {
    const turnstileResult = await verifyTurnstile(body && body.turnstile_token, ip);
    checks.turnstile = turnstileResult;
    if (!turnstileResult.ok) {
      await logAnomaly({ kind: "turnstile_failed", ip, ...turnstileResult });
      return { ok: false, status: 403, reason: turnstileResult.reason, ip };
    }
  }

  if (options.checkInjection !== false && body && body.messages) {
    const lastMsg = body.messages[body.messages.length - 1];
    if (lastMsg && typeof lastMsg.content === "string") {
      const injResult = detectPromptInjection(lastMsg.content);
      if (injResult.detected) {
        await logAnomaly({ kind: "prompt_injection_detected", ip, patterns: injResult.patterns });
        checks.injection = injResult;
      }
    }
  }

  return { ok: true, ip, checks };
}

export {
  checkOrigin,
  checkHoneypot,
  checkUserAgent,
  verifyTurnstile,
  detectPromptInjection,
  sanitizeInput,
  getClientIp,
  logAnomaly,
  runSecurityChecks,
  ALLOWED_ORIGINS,
};
