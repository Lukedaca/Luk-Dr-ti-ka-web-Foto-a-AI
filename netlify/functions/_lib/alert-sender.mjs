// Email alerting via Gmail SMTP (nodemailer). Sends from the same Gmail
// account that receives — so Gmail never marks these as spam.
// Throttle critical alerts via Netlify Blobs to avoid floods.

import nodemailer from "nodemailer";

const DEFAULT_TO = "lukas.drsticka@gmail.com";
const THROTTLE_MS = 5 * 60 * 1000;

let _transporter = null;
function getTransporter() {
  if (_transporter) return _transporter;
  const user = process.env.GMAIL_USER || DEFAULT_TO;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!pass) return null;
  _transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return _transporter;
}

let _throttleStorePromise = null;
function getThrottleStore() {
  if (_throttleStorePromise) return _throttleStorePromise;
  _throttleStorePromise = (async () => {
    try {
      const mod = await import("@netlify/blobs");
      return mod.getStore("alert-throttle");
    } catch {
      return null;
    }
  })();
  return _throttleStorePromise;
}

async function isThrottled(key) {
  const store = await getThrottleStore();
  if (!store) return false;
  try {
    const last = await store.get(key, { type: "json" });
    if (!last || typeof last.ts !== "number") return false;
    return (Date.now() - last.ts) < THROTTLE_MS;
  } catch {
    return false;
  }
}

async function markSent(key) {
  const store = await getThrottleStore();
  if (!store) return;
  try {
    await store.setJSON(key, { ts: Date.now() });
  } catch {}
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendEmail(subject, html) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[alert-sender] GMAIL_APP_PASSWORD missing — email skipped");
    return { sent: false, reason: "no_app_password" };
  }
  const from = process.env.GMAIL_USER || DEFAULT_TO;
  const to = (process.env.ALERT_EMAIL || DEFAULT_TO)
    .split(",").map((s) => s.trim()).filter(Boolean);

  try {
    const info = await transporter.sendMail({
      from: `"Lukas Web Alert" <${from}>`,
      to,
      subject,
      html,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error("[alert-sender] Gmail SMTP exception:", err.message);
    return { sent: false, error: err.message };
  }
}

async function sendInstantAlert(event) {
  const throttleKey = event.type;
  if (await isThrottled(throttleKey)) {
    console.warn("[alert-sender] throttled:", event.type);
    return { sent: false, throttled: true };
  }
  const subject = `[lukasdrsticka.com] Bezpečnostní alert: ${event.type}`;
  const detailsJson = escapeHtml(JSON.stringify(event.details, null, 2));
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px">
      <h2 style="color:#dc2626;margin:0 0 16px">Bezpečnostní alert</h2>
      <table cellpadding="6" style="border-collapse:collapse">
        <tr><td><strong>Typ:</strong></td><td>${escapeHtml(event.type)}</td></tr>
        <tr><td><strong>Severity:</strong></td><td>${escapeHtml(event.severity)}</td></tr>
        <tr><td><strong>Čas:</strong></td><td>${escapeHtml(event.ts)}</td></tr>
        <tr><td><strong>IP:</strong></td><td>${escapeHtml(event.ip)}</td></tr>
        ${event.ua ? `<tr><td><strong>UA:</strong></td><td>${escapeHtml(event.ua)}</td></tr>` : ""}
      </table>
      <h3 style="margin-top:24px">Detaily</h3>
      <pre style="background:#f3f4f6;padding:12px;border-radius:6px;overflow:auto;font-size:12px">${detailsJson}</pre>
      <p style="color:#6b7280;font-size:12px;margin-top:24px">
        Throttle: další alert tohoto typu nejdřív za 5 min.
        Plný kontext bude v denním souhrnu (8:00 SEČ).
      </p>
    </div>
  `;
  const result = await sendEmail(subject, html);
  if (result.sent) await markSent(throttleKey);
  return result;
}

async function sendDailySummary(events) {
  const count = events.length;
  if (count === 0) {
    return sendEmail(
      `[lukasdrsticka.com] Denní souhrn — bez incidentů`,
      `<div style="font-family:system-ui,sans-serif">
        <h2>Vše v pořádku</h2>
        <p>Za posledních 24 hodin nebyly zaznamenány žádné bezpečnostní eventy.</p>
      </div>`
    );
  }

  const bySeverity = {};
  const byType = {};
  const byIp = {};
  for (const e of events) {
    bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
    byType[e.type] = (byType[e.type] || 0) + 1;
    byIp[e.ip] = (byIp[e.ip] || 0) + 1;
  }

  const sortDesc = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);

  const sevRows = sortDesc(bySeverity)
    .map(([k, n]) => `<tr><td>${escapeHtml(k)}</td><td style="text-align:right">${n}</td></tr>`).join("");
  const typeRows = sortDesc(byType)
    .map(([k, n]) => `<tr><td>${escapeHtml(k)}</td><td style="text-align:right">${n}</td></tr>`).join("");
  const ipRows = sortDesc(byIp).slice(0, 10)
    .map(([k, n]) => `<tr><td><code>${escapeHtml(k)}</code></td><td style="text-align:right">${n}</td></tr>`).join("");

  const important = events
    .filter((e) => e.severity === "critical" || e.severity === "high")
    .slice(-10);
  const importantRows = important.map((e) => `
    <tr>
      <td>${escapeHtml(e.ts)}</td>
      <td>${escapeHtml(e.type)}</td>
      <td>${escapeHtml(e.severity)}</td>
      <td><code>${escapeHtml(e.ip)}</code></td>
    </tr>
  `).join("");

  const subject = `[lukasdrsticka.com] Denní souhrn — ${count} eventů`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:720px">
      <h2 style="margin:0 0 8px">Denní bezpečnostní souhrn</h2>
      <p style="color:#6b7280;margin:0 0 24px">Posledních 24 hodin · celkem ${count} eventů</p>

      <h3>Podle severity</h3>
      <table cellpadding="6" style="border-collapse:collapse;border:1px solid #e5e7eb;min-width:240px">
        <thead style="background:#f9fafb"><tr><th align="left">Severity</th><th align="right">Počet</th></tr></thead>
        <tbody>${sevRows}</tbody>
      </table>

      <h3 style="margin-top:24px">Podle typu</h3>
      <table cellpadding="6" style="border-collapse:collapse;border:1px solid #e5e7eb;min-width:320px">
        <thead style="background:#f9fafb"><tr><th align="left">Typ</th><th align="right">Počet</th></tr></thead>
        <tbody>${typeRows}</tbody>
      </table>

      <h3 style="margin-top:24px">Top 10 IP adres</h3>
      <table cellpadding="6" style="border-collapse:collapse;border:1px solid #e5e7eb;min-width:320px">
        <thead style="background:#f9fafb"><tr><th align="left">IP</th><th align="right">Počet</th></tr></thead>
        <tbody>${ipRows}</tbody>
      </table>

      ${important.length > 0 ? `
        <h3 style="margin-top:24px">Posledních ${important.length} kritických/high eventů</h3>
        <table cellpadding="6" style="border-collapse:collapse;border:1px solid #e5e7eb;font-size:13px">
          <thead style="background:#f9fafb">
            <tr><th align="left">Čas</th><th align="left">Typ</th><th align="left">Severity</th><th align="left">IP</th></tr>
          </thead>
          <tbody>${importantRows}</tbody>
        </table>
      ` : ""}
    </div>
  `;
  return sendEmail(subject, html);
}

export { sendInstantAlert, sendDailySummary, sendEmail };
