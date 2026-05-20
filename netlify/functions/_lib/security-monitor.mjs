// Persistent security event store + alert routing.
// Backed by Netlify Blobs. Falls back to console-only when blobs not available
// (local dev without netlify dev, or missing @netlify/blobs).

const SEVERITY = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
});

const CRITICAL_TYPES = new Set([
  "prompt_injection_detected",
  "rate_limit_burst",
  "server_error_5xx",
  "form_spam_attack",
]);

const HIGH_TYPES = new Set([
  "honeypot_triggered",
  "bot_ua_blocked",
  "turnstile_failed",
  "origin_not_allowed",
  "origin_blocked",
]);

const RETENTION_DAYS = 30;

let _storePromise = null;
function getStoreSafe() {
  if (_storePromise) return _storePromise;
  _storePromise = (async () => {
    try {
      const mod = await import("@netlify/blobs");
      return mod.getStore("security-events");
    } catch (err) {
      console.warn("[security-monitor] blobs unavailable:", err.message);
      return null;
    }
  })();
  return _storePromise;
}

function inferSeverity(type) {
  if (CRITICAL_TYPES.has(type)) return SEVERITY.CRITICAL;
  if (HIGH_TYPES.has(type)) return SEVERITY.HIGH;
  return SEVERITY.MEDIUM;
}

async function recordEvent(type, payload = {}) {
  const ts = new Date();
  const { severity, ip, ua, ...details } = payload;
  const event = {
    ts: ts.toISOString(),
    type,
    severity: severity || inferSeverity(type),
    ip: ip || "unknown",
    ua: ua || null,
    details,
  };

  console.warn("[security]", JSON.stringify(event));

  const store = await getStoreSafe();
  if (store) {
    const day = ts.toISOString().slice(0, 10);
    const id = `${ts.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
    const key = `events/${day}/${id}.json`;
    try {
      await store.setJSON(key, event);
    } catch (err) {
      console.error("[security-monitor] persist failed:", err.message);
    }
  }

  if (event.severity === SEVERITY.CRITICAL) {
    try {
      const { sendInstantAlert } = await import("./alert-sender.mjs");
      await sendInstantAlert(event);
    } catch (err) {
      console.error("[security-monitor] alert dispatch failed:", err.message);
    }
  }

  return event;
}

async function listEventsSince(sinceMs) {
  const store = await getStoreSafe();
  if (!store) return [];
  const events = [];
  const startDay = new Date(sinceMs).toISOString().slice(0, 10);
  const endDay = new Date().toISOString().slice(0, 10);
  const days = startDay === endDay ? [startDay] : [startDay, endDay];

  for (const day of days) {
    try {
      const list = await store.list({ prefix: `events/${day}/` });
      const blobs = list.blobs || [];
      for (const blob of blobs) {
        const event = await store.get(blob.key, { type: "json" });
        if (event && new Date(event.ts).getTime() >= sinceMs) {
          events.push(event);
        }
      }
    } catch (err) {
      console.error("[security-monitor] list failed for", day, err.message);
    }
  }

  return events.sort((a, b) => a.ts.localeCompare(b.ts));
}

async function cleanupOldEvents() {
  const store = await getStoreSafe();
  if (!store) return 0;
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  let deleted = 0;
  try {
    const list = await store.list({ prefix: "events/" });
    const blobs = list.blobs || [];
    for (const blob of blobs) {
      const parts = blob.key.split("/");
      const day = parts[1];
      if (day && day < cutoff) {
        try {
          await store.delete(blob.key);
          deleted++;
        } catch {}
      }
    }
  } catch (err) {
    console.error("[security-monitor] cleanup failed:", err.message);
  }
  return deleted;
}

export {
  SEVERITY,
  recordEvent,
  listEventsSince,
  cleanupOldEvents,
};
