// Čisté audio funkce hlasového hovoru (bez DOM) — testované v tests/voice-audio.test.mjs.
// Azure Speech REST pro krátké nahrávky chce WAV, PCM16, mono, 16 kHz, max. 60 s.

export const STT_SAMPLE_RATE = 16000;

// Převzorkování Float32 z rychlosti AudioContextu (typicky 48 kHz) na 16 kHz.
// Průměrování okna místo prostého vynechání vzorků = jednoduchý anti-aliasing.
export function downsample(input, fromRate, toRate = STT_SAMPLE_RATE) {
  if (!input || !input.length) return new Float32Array(0);
  if (fromRate === toRate) return Float32Array.from(input);
  if (fromRate < toRate) throw new Error('upsampling not supported');
  const ratio = fromRate / toRate;
  const length = Math.floor(input.length / ratio);
  const out = new Float32Array(length);
  let pos = 0;
  for (let i = 0; i < length; i++) {
    const end = Math.min(input.length, Math.round((i + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (; pos < end; pos++) { sum += input[pos]; count++; }
    out[i] = count ? sum / count : 0;
  }
  return out;
}

export function concatFloat32(chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

// WAV (RIFF) hlavička + PCM16 little-endian.
export function encodeWavPcm16(samples, sampleRate = STT_SAMPLE_RATE) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset, s) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);          // velikost fmt bloku
  view.setUint16(20, 1, true);           // PCM
  view.setUint16(22, 1, true);           // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);           // block align
  view.setUint16(34, 16, true);          // bitů na vzorek
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

export function rms(block) {
  if (!block || !block.length) return 0;
  let sum = 0;
  for (let i = 0; i < block.length; i++) sum += block[i] * block[i];
  return Math.sqrt(sum / block.length);
}

// Jednoduchá detekce řeči: práh se odvodí z hluku pozadí, řeč začne nad prahem
// a skončí po `silenceMs` ticha. Vrací stav, volající jen podává bloky.
export function createSpeechDetector({ silenceMs = 900, minSpeechMs = 250, floorBlocks = 6 } = {}) {
  let floor = 0;
  let floorCount = 0;
  let speechMs = 0;
  let silenceAfterSpeechMs = 0;
  let started = false;
  return {
    push(level, blockMs) {
      if (floorCount < floorBlocks) {
        floor = (floor * floorCount + level) / (floorCount + 1);
        floorCount++;
        return 'calibrating';
      }
      const threshold = Math.max(0.012, floor * 2.5);
      if (level > threshold) {
        speechMs += blockMs;
        silenceAfterSpeechMs = 0;
        if (speechMs >= minSpeechMs) started = true;
        return started ? 'speech' : 'maybe';
      }
      if (!started) {
        // pomalá adaptace na hluk, dokud nikdo nemluví
        floor = floor * 0.95 + level * 0.05;
        speechMs = 0;
        return 'waiting';
      }
      silenceAfterSpeechMs += blockMs;
      return silenceAfterSpeechMs >= silenceMs ? 'done' : 'speech';
    },
    get started() { return started; },
  };
}

export function sttUrl(region, language) {
  const safeRegion = String(region || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!safeRegion) throw new Error('missing region');
  const lang = language === 'en-US' ? 'en-US' : 'cs-CZ';
  return `https://${safeRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${lang}&format=simple&profanity=masked`;
}

// Odpověď Azure REST (format=simple): { RecognitionStatus, DisplayText, ... }
export function parseSttResponse(json) {
  if (!json || typeof json !== 'object') return { ok: false, reason: 'invalid' };
  if (json.RecognitionStatus === 'Success') {
    const text = String(json.DisplayText || '').trim();
    return text ? { ok: true, text } : { ok: false, reason: 'empty' };
  }
  return { ok: false, reason: String(json.RecognitionStatus || 'unknown') };
}
