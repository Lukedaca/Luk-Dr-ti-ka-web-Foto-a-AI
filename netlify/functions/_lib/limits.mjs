// Rate limiter with Upstash Redis backend, falls back to in-memory for dev.
// Sliding window via sorted sets.

const memoryStore = new Map();

const LIMITS = {
  chat: { window: 60 * 60 * 1000, max: 60 },
  expensive: { window: 60 * 60 * 1000, max: 5 },
  smart: { window: 24 * 60 * 60 * 1000, max: 3 },
  concurrent: { window: 30 * 1000, max: 2 },
  session: { window: 60 * 60 * 1000, max: 30 },
  voice: { window: 60 * 60 * 1000, max: 3 },
  tts: { window: 60 * 1000, max: 60 },
  tour: { window: 60 * 1000, max: 20 },
};

const EXPENSIVE_TOOLS = new Set([
  "send_inquiry",
  "request_callback",
  "subscribe_newsletter",
  "book_consultation",
  "send_brief_to_email",
]);

const SMART_TOOLS = new Set([
  "recommend_service",
  "generate_quote_estimate",
  "create_project_brief",
]);

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function upstashCommand(command) {
  const config = getUpstashConfig();
  if (!config) return null;
  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });
    if (!response.ok) {
      console.error("Upstash error:", response.status, await response.text());
      return null;
    }
    const data = await response.json();
    return data.result;
  } catch (err) {
    console.error("Upstash fetch error:", err);
    return null;
  }
}

async function checkRateLimitUpstash(key, windowMs, max) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;

  const results = await Promise.all([
    upstashCommand(["ZREMRANGEBYSCORE", key, 0, cutoff]),
    upstashCommand(["ZADD", key, now, member]),
    upstashCommand(["ZCARD", key]),
    upstashCommand(["PEXPIRE", key, windowMs]),
  ]);

  const count = Number(results[2]);
  if (Number.isNaN(count)) return { ok: true, fallback: true };
  return {
    ok: count <= max,
    count,
    max,
    remaining: Math.max(0, max - count),
    resetMs: windowMs,
  };
}

function checkRateLimitMemory(key, windowMs, max) {
  const now = Date.now();
  let hits = memoryStore.get(key) || [];
  hits = hits.filter((t) => now - t < windowMs);
  hits.push(now);
  memoryStore.set(key, hits);

  if (memoryStore.size > 5000) {
    const cutoff = now - 60 * 60 * 1000;
    for (const [k, v] of memoryStore.entries()) {
      const recent = v.filter((t) => t > cutoff);
      if (recent.length === 0) memoryStore.delete(k);
      else memoryStore.set(k, recent);
    }
  }

  return {
    ok: hits.length <= max,
    count: hits.length,
    max,
    remaining: Math.max(0, max - hits.length),
    resetMs: windowMs,
  };
}

async function checkLimit(scope, identifier) {
  const config = LIMITS[scope];
  if (!config) throw new Error(`Unknown limit scope: ${scope}`);

  const key = `rl:${scope}:${identifier}`;
  const upstash = getUpstashConfig();

  if (upstash) {
    const result = await checkRateLimitUpstash(key, config.window, config.max);
    if (result && !result.fallback) return result;
  }
  return checkRateLimitMemory(key, config.window, config.max);
}

function classifyTool(toolName) {
  if (EXPENSIVE_TOOLS.has(toolName)) return "expensive";
  if (SMART_TOOLS.has(toolName)) return "smart";
  return "chat";
}

async function checkChatLimit(ip) {
  return checkLimit("chat", ip);
}

async function checkToolLimit(ip, toolName) {
  const klass = classifyTool(toolName);
  if (klass === "chat") return { ok: true, klass };
  const result = await checkLimit(klass, ip);
  return { ...result, klass };
}

async function checkSessionLimit(sessionId) {
  if (!sessionId) return { ok: true };
  return checkLimit("session", sessionId);
}

function buildLimitResponse(reason, info) {
  return {
    limit_reached: true,
    reason,
    info,
    fallback: {
      message:
        "Zdá se, že jsme si pěkně popovídali — agent má momentálně nastavený limit, abych ho nezahltili. Pokud potřebuješ pokračovat v konkrétní poptávce, napiš mi přímo na lukas.drsticka@gmail.com nebo otevři poptávkový formulář s naší dosavadní konverzací. Odpovídám obvykle do 24 hodin.",
      email: "lukas.drsticka@gmail.com",
      action: "open_prefill_form",
    },
  };
}

export {
  LIMITS,
  classifyTool,
  checkLimit,
  checkChatLimit,
  checkToolLimit,
  checkSessionLimit,
  buildLimitResponse,
  EXPENSIVE_TOOLS,
  SMART_TOOLS,
};
