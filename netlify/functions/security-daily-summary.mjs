// Netlify Scheduled Function: 08:00 Europe/Prague every day.
// Aggregates last-24h security events into one email + prunes blobs > 30 days.

import { listEventsSince, cleanupOldEvents } from "./_lib/security-monitor.mjs";
import { sendDailySummary } from "./_lib/alert-sender.mjs";

export default async () => {
  const sinceMs = Date.now() - 24 * 60 * 60 * 1000;
  let events = [];
  try {
    events = await listEventsSince(sinceMs);
  } catch (err) {
    console.error("[daily-summary] listEventsSince failed:", err.message);
  }

  let mailResult = null;
  try {
    mailResult = await sendDailySummary(events);
  } catch (err) {
    console.error("[daily-summary] sendDailySummary failed:", err.message);
  }

  let pruned = 0;
  try {
    pruned = await cleanupOldEvents();
  } catch (err) {
    console.error("[daily-summary] cleanupOldEvents failed:", err.message);
  }

  return new Response(JSON.stringify({
    ok: true,
    events_count: events.length,
    mail: mailResult,
    pruned_blobs: pruned,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
};

export const config = {
  schedule: "0 7 * * *",
};
