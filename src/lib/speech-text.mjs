// Text in the chat can contain visual markup that is useful on screen but
// distracting when a browser or managed voice reads it aloud.

const SPEECH_DIGIT = ['nula', 'jedna', 'dva', 'tři', 'čtyři', 'pět', 'šest', 'sedm', 'osm', 'devět'];
const SPEECH_NUM = [
  'nula', 'jedna', 'dva', 'tři', 'čtyři', 'pět', 'šest', 'sedm', 'osm', 'devět',
  'deset', 'jedenáct', 'dvanáct', 'třináct', 'čtrnáct', 'patnáct', 'šestnáct', 'sedmnáct', 'osmnáct', 'devatenáct',
];

const NON_TERMINAL_ABBR_RE = /\b(?:např|tzv|atd|apod|mj|tj|č|roč|st|ml|vs|ing|mgr|bc|mudr|judr|phdr|rndr)\.$/i;

export function cleanTextForSpeech(value) {
  return String(value || '')
    .replace(/\[\[ACTION:[^\]]+\]\]/gi, ' ')
    .replace(/<function=[a-zA-Z0-9_-]+>[\s\S]*?<\/function>/g, ' ')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/(?:[:;=8xX]-?[)(/\\DPpOo]|\^_\^)/g, '')
    .replace(/[*_`~#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeForSpeech(value, lang = 'cs-CZ') {
  let s = String(value || '');
  const isEn = String(lang || '').toLowerCase().startsWith('en');

  if (isEn) {
    s = s.replace(/\bU[\s\u00A0-]?0?(\d{1,2})\b/gi, (whole, n) => {
      const num = Number(n);
      return num >= 6 && num <= 23 ? `under ${num}` : whole;
    });
    s = s.replace(/(\b\d{1,2})\s+:\s+(\d{1,2}\b)/g, '$1:$2');
    s = s.replace(/\bvs\.?(?=\s+[A-Z0-9])/gi, 'versus');
    return s;
  }

  // Telefon: (+420) 9 číslic, případně po trojicích → číslice po jedné, trojice = pauza.
  s = s.replace(/(?<!\d)(?:(?:\+|00)\s?420[\s\u00A0-]?)?\d{3}[\s\u00A0-]?\d{3}[\s\u00A0-]?\d{3}(?!\d)/g, (m) => {
    const digits = m.replace(/\D/g, '');
    if (digits.length < 9) return m;
    const words = digits.split('').map((d) => SPEECH_DIGIT[Number(d)]);
    const groups = [];
    for (let i = 0; i < words.length; i += 3) groups.push(words.slice(i, i + 3).join(' '));
    return groups.join(', ');
  });

  // Název klubu s řadovou číslovkou: "1. FC" → "První FC" (aby TTS nečetlo "jedna tečka FC").
  s = s.replace(/\b1\.\s*FC\b/g, 'První FC');

  // Datum s vodicí nulou (02. 11. → 2. 11.), aby Gemini TTS nečetlo "02" jako "20".
  s = s.replace(/\b0(\d)\.\s*0?(\d{1,2})\./g, '$1. $2.');

  // Kategorie U08 / U8 / u-10 → "U" + číslovka slovem (bez vodicí nuly = žádné přehození).
  s = s.replace(/\bU[\s\u00A0-]?0?(\d{1,2})\b/gi, (whole, n) => {
    const num = Number(n);
    return num >= 0 && num <= 19 ? `U ${SPEECH_NUM[num]}` : whole;
  });

  // Skóre s mezerami kolem dvojtečky ("2 : 1" → "2:1").
  s = s.replace(/(\b\d{1,2})\s+:\s+(\d{1,2}\b)/g, '$1:$2');

  // Zkratka "vs" / "vs." mezi týmy v české větě → "proti".
  s = s.replace(/\bvs\.?(?=\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ0-9])/gi, 'proti');

  return s;
}

export function takeCompleteSentences(text, startLen = 0) {
  const src = String(text || '');
  const out = [];
  let lastBoundary = startLen;

  for (let j = startLen; j < src.length; j++) {
    const c = src[j];
    if (c === '.' || c === '!' || c === '?' || c === '…' || c === '\n') {
      if (c === '.') {
        const nextChar = src[j + 1] || '';
        if (nextChar && !/\s/.test(nextChar)) continue;
        const prefix = src.slice(lastBoundary, j + 1).trim();
        if (/(?<!:\d)\b\d{1,3}\.$/.test(prefix) && !/\b(?:19|20)\d{2}\.$/.test(prefix)) continue;
        if (NON_TERMINAL_ABBR_RE.test(prefix)) continue;
      }
      const seg = src.slice(lastBoundary, j + 1).trim();
      if (seg.replace(/[^\p{L}\p{N}]/gu, '').length >= 2) out.push(seg);
      lastBoundary = j + 1;
    }
  }
  return { sentences: out, consumed: lastBoundary };
}
