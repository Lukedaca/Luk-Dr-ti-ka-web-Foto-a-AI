// Opt-in visitor memory.
// Stores a compact, redacted summary only after explicit browser consent.

const VISITOR_TTL_DAYS = 180;
const VISITOR_KEY_PREFIX = "visitor:";
const VISITOR_ID_RE = /^[a-zA-Z0-9_-]{8,96}$/;

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
    if (!response.ok) return null;
    const data = await response.json();
    return data.result;
  } catch (err) {
    return null;
  }
}

function normalizeVisitorId(visitorId) {
  const value = String(visitorId || "").trim().slice(0, 96);
  return VISITOR_ID_RE.test(value) ? value : "";
}

function visitorKey(visitorId) {
  const id = normalizeVisitorId(visitorId);
  return id ? `${VISITOR_KEY_PREFIX}${id}` : "";
}

function redactContactData(text) {
  return String(text || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(?:\+?\d[\s().-]*){7,}/g, "[telefon]")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(text, max = 240) {
  const redacted = redactContactData(text);
  if (redacted.length <= max) return redacted;
  return `${redacted.slice(0, max - 1).trim()}…`;
}

async function getVisitorMemory(visitorId) {
  const key = visitorKey(visitorId);
  if (!key) return null;
  const raw = await upstashCommand(["GET", key]);
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

async function saveVisitorMemory(visitorId, memory) {
  const key = visitorKey(visitorId);
  if (!key) return null;
  const payload = JSON.stringify(memory);
  await upstashCommand(["SET", key, payload, "EX", VISITOR_TTL_DAYS * 86400]);
  return memory;
}

async function deleteVisitorMemory(visitorId) {
  const key = visitorKey(visitorId);
  if (!key) return false;
  await upstashCommand(["DEL", key]);
  return true;
}

function buildMemorySummary({ messages, assistantText, mode }) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const lastUser = [...safeMessages].reverse().find((m) => m && m.role === "user");
  const lastAssistant = assistantText || [...safeMessages].reverse().find((m) => m && m.role === "assistant")?.content || "";
  const userPart = compactText(lastUser?.content || "", 260);
  const assistantPart = compactText(lastAssistant || "", 220);
  const modePart = mode ? `Rezim: ${mode}. ` : "";

  if (!userPart && !assistantPart) return "";
  if (!assistantPart) return `${modePart}Navstevnik resil: ${userPart}`;
  return `${modePart}Navstevnik resil: ${userPart} Posledni odpoved agenta: ${assistantPart}`;
}

function buildMemoryContext(memory) {
  if (!memory || !memory.summary) return "";
  return [
    "OPT-IN PAMET NAVSTEVNIKA:",
    "- Navstevnik souhlasil s ulozenim kratkeho souhrnu pro kontinuitu.",
    "- Pouzij ji jen pro lepsi navazani, nikdy ji nezminuj jako sledovani.",
    `- Souhrn: ${compactText(memory.summary, 700)}`,
    memory.preferences?.last_mode ? `- Posledni rezim: ${memory.preferences.last_mode}` : "",
  ].filter(Boolean).join("\n");
}

async function updateVisitorMemory({ visitorId, messages, assistantText, mode }) {
  const id = normalizeVisitorId(visitorId);
  if (!id) return null;

  const now = new Date().toISOString();
  const existing = await getVisitorMemory(id);
  const summary = buildMemorySummary({ messages, assistantText, mode });
  const next = {
    first_seen: existing?.first_seen || now,
    last_seen: now,
    consent_at: existing?.consent_at || now,
    message_count: Number(existing?.message_count || 0) + 1,
    summary: summary || existing?.summary || "",
    preferences: {
      ...(existing?.preferences || {}),
      last_mode: mode || existing?.preferences?.last_mode || "talk",
    },
  };

  return saveVisitorMemory(id, next);
}

export {
  VISITOR_TTL_DAYS,
  normalizeVisitorId,
  getVisitorMemory,
  saveVisitorMemory,
  deleteVisitorMemory,
  updateVisitorMemory,
  buildMemorySummary,
  buildMemoryContext,
};
