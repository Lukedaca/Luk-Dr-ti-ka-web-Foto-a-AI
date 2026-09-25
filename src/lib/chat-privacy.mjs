// Ochrana dat na hranici k poskytovateli (Gemini) — převzato z Viktorky (chat-history.mjs).
// Historie chatu přichází z prohlížeče, proto se před odesláním modelu:
//   1) z každé zprávy odstraní kontaktní údaje (GDPR: minimalizace dat),
//   2) dotaz na interní instrukce vyřídí server fixní odpovědí, ne model.

export function scrubPii(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/(?:\+?420\s*)?[1-9]\d{2}\s*\d{3}\s*\d{3}\b/g, '[telefon]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[e-mail]');
}

export function scrubMessagesForProvider(messages) {
  return (Array.isArray(messages) ? messages : []).map((message) => ({
    ...message,
    content: scrubPii(message?.content),
  }));
}

export const SAFE_PROMPT_LEAK_REPLY =
  'Interní instrukce ani nastavení nezveřejňuji. Rád ale poradím s focením, galeriemi zápasů nebo projekty FrameMind.';

function normalizeSecurityText(value) {
  return String(value || '')
    .toLocaleLowerCase('cs-CZ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isPromptLeakRequest(value) {
  const text = normalizeSecurityText(value);
  return /\b(systemov\w* prompt|system prompt|developer message|system message|interni instrukc\w*|tajne instrukc\w*|tajne pokyn\w*|jake mas (instrukce|pokyny|pravidla)|co mas za (instrukce|pokyny|pravidla)|co mas zadan\w*|zopakuj\w* (?:svoje |sve |interni )?(zadani|instrukce|pokyny|prompt)|ukaz\w* (?:svoje |sve |interni )?(zadani|instrukce|pokyny|prompt)|prozrad\w* (?:svoje |sve |interni )?(zadani|instrukce|pokyny|prompt))\b/.test(text);
}
