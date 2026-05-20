// Netlify event-triggered function: fires after every form submission.
// Inspects payload for spam patterns and feeds the security monitor.
// Genuine submissions still go through the standard Netlify notification flow.

import { recordEvent, SEVERITY } from "./_lib/security-monitor.mjs";

const SPAM_KEYWORDS = [
  /\b(viagra|cialis|tadalafil)\b/i,
  /\b(casino|gambling|jackpot|bet365)\b/i,
  /\b(crypto[ -]?(invest|trading|signal))\b/i,
  /\bSEO\s+(services|backlinks|ranking)\b/i,
  /\b(loan|credit)\s+(approved|guaranteed)\b/i,
  /\b(buy|cheap)\s+followers\b/i,
];

const LINK_RE = /\bhttps?:\/\/[^\s<>"']+/gi;
const CYRILLIC_RE = /[Ѐ-ӿ]/;
const CHINESE_RE = /[一-鿿]/;
const ARABIC_RE = /[؀-ۿ]/;

function analyzeContent(text) {
  if (typeof text !== "string" || !text.trim()) {
    return { score: 0, signals: [] };
  }
  const signals = [];
  let score = 0;

  const links = text.match(LINK_RE) || [];
  if (links.length >= 5) {
    signals.push(`many_links:${links.length}`);
    score += 3;
  } else if (links.length >= 3) {
    signals.push(`some_links:${links.length}`);
    score += 1;
  }

  for (const re of SPAM_KEYWORDS) {
    if (re.test(text)) {
      signals.push(`keyword:${re.source.slice(0, 30)}`);
      score += 2;
    }
  }

  const upperLetters = text.replace(/[^A-Z]/g, "").length;
  const totalLetters = text.replace(/[^A-Za-z]/g, "").length;
  if (totalLetters >= 30 && upperLetters / totalLetters > 0.6) {
    signals.push("excessive_caps");
    score += 1;
  }

  if (CYRILLIC_RE.test(text)) signals.push("cyrillic");
  if (CHINESE_RE.test(text)) signals.push("chinese");
  if (ARABIC_RE.test(text)) signals.push("arabic");

  return { score, signals };
}

export default async (req) => {
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("invalid_json", { status: 400 });
  }

  const payload = body?.payload || {};
  const data = payload.data || {};
  const formName = payload.form_name || "unknown";
  const ip = payload.user_agent
    ? payload.country || "unknown"
    : "unknown";
  const submittedIp = payload.ip || ip;

  const textFields = [
    data.message,
    data.zprava,
    data.subject,
    data.predmet,
    data.name,
    data.jmeno,
    data.email,
  ].filter((v) => typeof v === "string");
  const combined = textFields.join("\n");

  const analysis = analyzeContent(combined);

  if (analysis.score >= 4) {
    await recordEvent("form_spam_attack", {
      severity: SEVERITY.CRITICAL,
      ip: submittedIp,
      ua: payload.user_agent || null,
      form: formName,
      score: analysis.score,
      signals: analysis.signals,
      preview: combined.slice(0, 200),
    });
  } else if (analysis.score >= 2) {
    await recordEvent("form_suspicious", {
      severity: SEVERITY.HIGH,
      ip: submittedIp,
      ua: payload.user_agent || null,
      form: formName,
      score: analysis.score,
      signals: analysis.signals,
    });
  } else {
    await recordEvent("form_submission_ok", {
      severity: SEVERITY.LOW,
      ip: submittedIp,
      form: formName,
    });
  }

  return new Response("ok", { status: 200 });
};
