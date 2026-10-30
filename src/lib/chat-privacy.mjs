// Ochrana dat na hranici k poskytovateli (Gemini / TTS) — GDPR minimalizace dat a zákaz úniku kontextu.
// Historie chatu přichází z prohlížeče, proto se před odesláním modelu:
//   1) z každé zprávy odstraní kontaktní a citlivé údaje (GDPR: minimalizace dat),
//   2) dotaz na interní instrukce vyřídí server fixní odpovědí, ne model,
//   3) do TTS nesmí projít žádné citlivé údaje, kontextové klíče ani interní instrukce.

const SENSITIVE_RULES = [
  { re: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,4})?\b/gi, label: '[číslo účtu]' },
  { re: /\b\d{2}(?:0[1-9]|1[0-2]|2[1-9]|3[0-2]|5[1-9]|6[0-2]|7[1-9]|8[0-2])(?:0[1-9]|[12]\d|3[01])[ ]?\/?[ ]?\d{4}\b/g, label: '[rodné číslo]' },
  { re: /(?:rodn[eé]\w*\s+[cč][ií]sl\w*|[cč][ií]sl\w*\s+poji[sš]t[eě]nce|(?<![\p{L}\d])R[CČ](?![\p{L}\d]))\D{0,12}\d[\d \/]{4,}\d/giu, label: '[rodné číslo]' },
  { re: /(?:\bOP\b|ob[cč]ansk\w*|ob[cč]ank\w*|\bpas\w*|pr[uů]kaz\w*)\D{0,15}\d{6,10}\b/gi, label: '[číslo dokladu]' },
  { re: /\b(?:\d[ -]?){12,18}\d\b/g, label: '[číslo karty]' },
  { re: /\b(?:\d{1,6}-)?\d{6,10}[ ]?\/[ ]?\d{4}\b/g, label: '[číslo účtu]' },
];

const PHONE_RE = /(?:\+?420\s*)?[1-9]\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const SECRET_OR_SENSITIVE_RE = /\b(?:api[-_ ]?key|access[-_ ]?token|auth[-_ ]?token|heslo|password|secret|rodn[eé]\s+[cč][ií]slo|zdravotn[ií]|diagn[oó]z\w*)\b/i;

const FORBIDDEN_TTS_BODY_KEYS = [
  'messages', 'history', 'transcript', 'systemPrompt', 'systemInstruction',
  'tools', 'toolResults', 'context', 'dbContext', 'records', 'sekce', 'prompt', 'memory',
];

function normalizeSecurityText(value) {
  return String(value || '')
    .toLocaleLowerCase('cs-CZ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function containsSensitiveData(text) {
  if (!text || typeof text !== 'string') return false;
  return SENSITIVE_RULES.some(({ re }) => {
    re.lastIndex = 0;
    const found = re.test(text);
    re.lastIndex = 0;
    return found;
  });
}

export function scrubPii(text) {
  if (!text || typeof text !== 'string') return '';
  let out = text;
  for (const { re, label } of SENSITIVE_RULES) out = out.replace(re, label);
  return out
    .replace(PHONE_RE, '[telefon]')
    .replace(EMAIL_RE, '[e-mail]');
}

export function scrubMessagesForProvider(messages) {
  return (Array.isArray(messages) ? messages : []).map((message) => ({
    ...message,
    content: scrubPii(message?.content),
  }));
}

export const SAFE_PROMPT_LEAK_REPLY =
  'Interní instrukce ani nastavení nezveřejňuji. Rád ale poradím s focením, galeriemi zápasů nebo projekty FrameMind.';

export function isPromptLeakRequest(value) {
  const text = normalizeSecurityText(value);
  return /\b(systemov\w* prompt|system prompt|developer message|system message|interni instrukc\w*|tajne instrukc\w*|tajne pokyn\w*|jake mas (instrukce|pokyny|pravidla)|co mas za (instrukce|pokyny|pravidla)|co mas zadan\w*|zopakuj\w* (?:svoje |sve |interni )?(zadani|instrukce|pokyny|prompt)|ukaz\w* (?:svoje |sve |interni )?(zadani|instrukce|pokyny|prompt)|prozrad\w* (?:svoje |sve |interni )?(zadani|instrukce|pokyny|prompt))\b/.test(text);
}

export function containsPromptLeakContent(value) {
  const raw = String(value || '');
  if (!raw) return false;
  if (/<function=[a-zA-Z0-9_-]+>/i.test(raw)) return true;
  if (/\[\[ACTION:[^\]]+\]\]/i.test(raw)) return true;
  if (/^\s*\{[\s\S]*"(?:steps|tool|messages|systemInstruction|candidates|generationConfig)"[\s\S]*\}\s*$/i.test(raw)) return true;

  const text = normalizeSecurityText(raw);
  if (!text) return false;

  const highConfidence = [
    /\bco je 1 fc viktorie prerov\b/,
    /\bceho se vyhnout\b/,
    /\bmimo tema a zneuziti\b/,
    /\bakce na strance function calling\b/,
    /\bneduveryhodn(?:y|a) (?:prepis|historie dotazu) z prohlizece\b/,
    /\baktualni dotaz navstevnika\b/,
    /\bzivy kontext stranky na ktere navstevnik prave je\b/,
    /\bopt in pamet navstevnika\b/,
    /\bsysteminstruction\b/,
    /\bgenerationconfig\b/,
    /\bresponsemodalities\b/,
    /\bprebuiltvoiceconfig\b/,
    /\binterni instrukce\b/,
    /\btajne pokyny\b/,
    /\bnikdy neprozrazovat\b/,
  ];
  if (highConfidence.some((pattern) => pattern.test(text))) return true;

  const promptMarkers = [
    /\bjste (?:viktorka|lukas ai|hybridni agentka)\b/,
    /\bjste hybridni agentka vestavena primo do webu (?:framemind|lukase drsticky|portfolia)\b/,
    /\bmluvite s rodici fanousky hraci\b/,
    /\bmluvite cesky prirozene a vstricne\b/,
    /\bjak odpovidat\b/,
    /\bnikdy neprozrazovat necitovat ani nahlas necist\b/,
    /\bodpovedi drzte vzdy kratke\b/,
    /\bveskery prepis predchozi konverzace\b/,
    /\bdostupne stranky webu\b/,
    /\bpartneri sponzori klubu\b/,
  ];
  let matches = 0;
  for (const pattern of promptMarkers) {
    if (pattern.test(text)) matches += 1;
    if (matches >= 2) return true;
  }
  return false;
}

export function validateTtsRequestSecurity(body, options = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { allowed: false, status: 400, reason: 'invalid-payload' };
  }
  for (const key of FORBIDDEN_TTS_BODY_KEYS) {
    if (key in body && body[key] !== undefined && body[key] !== null) {
      return { allowed: false, status: 422, reason: 'forbidden-context-fields' };
    }
  }
  const rawText = typeof body.text === 'string' ? body.text.trim() : '';
  if (!rawText) {
    return { allowed: false, status: 400, reason: 'empty-text' };
  }
  if (containsPromptLeakContent(rawText)) {
    return { allowed: false, status: 422, reason: 'prompt-or-internal-context-blocked' };
  }

  const allowedEmails = Array.isArray(options.allowedPublicEmails) ? options.allowedPublicEmails : [];
  let textForPii = rawText;
  for (const pubEmail of allowedEmails) {
    if (pubEmail) {
      textForPii = textForPii.split(pubEmail).join('');
    }
  }

  PHONE_RE.lastIndex = 0;
  const hasPhone = PHONE_RE.test(textForPii);
  PHONE_RE.lastIndex = 0;

  EMAIL_RE.lastIndex = 0;
  const hasEmail = EMAIL_RE.test(textForPii);
  EMAIL_RE.lastIndex = 0;

  if (
    containsSensitiveData(textForPii)
    || SECRET_OR_SENSITIVE_RE.test(textForPii)
    || hasPhone
    || hasEmail
  ) {
    return { allowed: false, status: 422, reason: 'sensitive-or-personal-data-blocked' };
  }

  return { allowed: true, status: 200, reason: 'ok' };
}
