// Obrana proti tomu, aby Gemini TTS přečetlo nahlas naše vlastní pokyny pro hlas,
// pojistka délky vygenerovaného audia (audioLooksOverlong) a detekce WAV/PCM16.

const STYLE_CS = 'Přečtěte text jako hybridní agentka portfolia Lukáše Drštičky a FrameMind: vřelým, profesionálním ženským hlasem s klidnou jistotou a přirozenými mikropauzami. Spisovně, s jasnou artikulací, přiměřeným tempem, zdvořile, bez generického robotického tónu: ';
const STYLE_EN = 'Read as the hybrid agent for Lukáš Drštička and FrameMind: a warm, professional female voice with calm confidence and natural micro-pauses. Clear articulation, measured pace, courteous tone, no generic assistant feel: ';

export const PROMPT_VARIANTS = ['legacy', 'mark-cs', 'mark-en', 'legacy-mark', 'short'];
export const DEFAULT_VARIANT = 'legacy';
export const STYLE_VERSION = 'v1';

export function buildTtsPrompt(text, lang, variant = DEFAULT_VARIANT, customHint = '') {
  const en = String(lang || '').toLowerCase().startsWith('en');
  const style = customHint || (en ? STYLE_EN : STYLE_CS);

  switch (variant) {
    case 'legacy':
      return style + text;
    case 'mark-cs':
      return [
        'Úkol: vytvoř mluvenou nahrávku. Přečti nahlas VÝHRADNĚ text, který následuje za značkou [PŘEPIS].',
        'Tyto pokyny ani samotnou značku nikdy nevyslovuj.',
        '',
        '[PŘEPIS]',
        text,
      ].join('\n');
    case 'mark-en':
      return [
        'Read the transcript below aloud as speech.',
        `Style: ${style.replace(/:\s*$/, '')}`,
        '',
        '#### TRANSCRIPT',
        text,
      ].join('\n');
    case 'legacy-mark':
      return `${style}\n\n#### TRANSCRIPT\n${text}`;
    case 'short':
      return (en ? 'Warm, professional female voice, calm pace: ' : 'Vřelý profesionální ženský hlas, spisovná čeština, klidné tempo: ') + text;
    default:
      return style + text;
  }
}

export function base64Bytes(b64) {
  const s = String(b64 || '');
  if (!s) return 0;
  const padding = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  return Math.floor((s.length * 3) / 4) - padding;
}

export function extractPcmFromBytes(bytes, defaultSampleRate = 24000) {
  if (!bytes || bytes.length < 12) {
    const evenLen = bytes ? bytes.length - (bytes.length % 2) : 0;
    return { pcmBytes: bytes ? bytes.subarray(0, evenLen) : new Uint8Array(0), sampleRate: defaultSampleRate, isWav: false };
  }
  const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45;
  if (!isRiff) {
    const evenLen = bytes.length - (bytes.length % 2);
    return { pcmBytes: bytes.subarray(0, evenLen), sampleRate: defaultSampleRate, isWav: false };
  }
  let sampleRate = defaultSampleRate;
  let offset = 12;
  let dataStart = 44;
  let dataLen = Math.max(0, bytes.length - 44);
  while (offset + 8 <= bytes.length) {
    const id0 = bytes[offset], id1 = bytes[offset + 1], id2 = bytes[offset + 2], id3 = bytes[offset + 3];
    const chunkSize = (bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24)) >>> 0;
    if (id0 === 0x66 && id1 === 0x6d && id2 === 0x74 && id3 === 0x20 && offset + 16 <= bytes.length) {
      const sr = (bytes[offset + 12] | (bytes[offset + 13] << 8) | (bytes[offset + 14] << 16) | (bytes[offset + 15] << 24)) >>> 0;
      if (sr >= 8000 && sr <= 96000) sampleRate = sr;
    }
    if (id0 === 0x64 && id1 === 0x61 && id2 === 0x74 && id3 === 0x61) {
      dataStart = offset + 8;
      dataLen = Math.min(chunkSize || (bytes.length - dataStart), bytes.length - dataStart);
      break;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  const safeStart = Math.min(dataStart, bytes.length);
  const rawSlice = bytes.subarray(safeStart, safeStart + Math.max(0, dataLen));
  const evenLen = rawSlice.length - (rawSlice.length % 2);
  return { pcmBytes: rawSlice.subarray(0, evenLen), sampleRate, isWav: true };
}

export function audioLooksOverlong(text, pcmBytes, sampleRate = 24000) {
  const chars = String(text || '').length;
  if (!chars || !(pcmBytes > 0)) return false;
  const seconds = pcmBytes / (sampleRate * 2); // PCM16 = 2 bajty na vzorek
  const slowestPlausible = 1.5 + chars / 6;
  return seconds > slowestPlausible * 2 + 4;
}
