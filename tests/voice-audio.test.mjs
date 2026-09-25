import test from 'node:test';
import assert from 'node:assert/strict';
import {
  downsample,
  concatFloat32,
  encodeWavPcm16,
  rms,
  createSpeechDetector,
  sttUrl,
  parseSttResponse,
  STT_SAMPLE_RATE,
} from '../src/js/voice-audio.mjs';

test('downsample 48k → 16k zkrátí signál na třetinu a zachová úroveň', () => {
  const input = new Float32Array(4800).fill(0.5);
  const out = downsample(input, 48000);
  assert.equal(out.length, 1600);
  assert.ok(out.every((v) => Math.abs(v - 0.5) < 1e-6));
});

test('downsample odmítne upsampling a stejnou rychlost jen zkopíruje', () => {
  assert.throws(() => downsample(new Float32Array(10), 8000));
  const same = downsample(new Float32Array([0.1, 0.2]), 16000);
  assert.deepEqual(Array.from(same).map((v) => +v.toFixed(3)), [0.1, 0.2]);
});

test('WAV hlavička odpovídá požadavku Azure REST (PCM16 mono 16 kHz)', () => {
  const buf = encodeWavPcm16(new Float32Array([0, 1, -1, 0.5]));
  const v = new DataView(buf);
  const str = (o, n) => String.fromCharCode(...new Uint8Array(buf, o, n));
  assert.equal(str(0, 4), 'RIFF');
  assert.equal(str(8, 4), 'WAVE');
  assert.equal(v.getUint16(20, true), 1);
  assert.equal(v.getUint16(22, true), 1);
  assert.equal(v.getUint32(24, true), STT_SAMPLE_RATE);
  assert.equal(v.getUint16(34, true), 16);
  assert.equal(v.getUint32(40, true), 8);
  assert.equal(buf.byteLength, 44 + 8);
  assert.equal(v.getInt16(46, true), 0x7fff);
  assert.equal(v.getInt16(48, true), -0x8000);
});

test('concatFloat32 a rms', () => {
  const all = concatFloat32([new Float32Array([1, 1]), new Float32Array([1])]);
  assert.equal(all.length, 3);
  assert.equal(rms(all), 1);
  assert.equal(rms(new Float32Array(0)), 0);
});

test('detektor řeči: ticho → řeč → ticho skončí jako done', () => {
  const d = createSpeechDetector({ silenceMs: 300, minSpeechMs: 100, floorBlocks: 3 });
  const states = [];
  for (let i = 0; i < 3; i++) states.push(d.push(0.002, 50));
  for (let i = 0; i < 5; i++) states.push(d.push(0.2, 50));
  for (let i = 0; i < 6; i++) states.push(d.push(0.002, 50));
  assert.equal(states[0], 'calibrating');
  assert.ok(states.includes('speech'));
  assert.equal(states[states.length - 1], 'done');
});

test('detektor řeči: krátké cvaknutí nespustí nahrávku', () => {
  const d = createSpeechDetector({ minSpeechMs: 250, floorBlocks: 2 });
  d.push(0.002, 50); d.push(0.002, 50);
  d.push(0.3, 50);
  for (let i = 0; i < 10; i++) d.push(0.002, 50);
  assert.equal(d.started, false);
});

test('sttUrl: region je očištěný, jazyk jen cs-CZ / en-US', () => {
  assert.equal(
    sttUrl('northeurope', 'cs-CZ'),
    'https://northeurope.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=cs-CZ&format=simple&profanity=masked',
  );
  assert.match(sttUrl('west.europe/../evil', 'en-US'), /^https:\/\/westeuropeevil\.stt\.speech\.microsoft\.com\/.*language=en-US/);
  assert.match(sttUrl('northeurope', 'de-DE'), /language=cs-CZ/);
  assert.throws(() => sttUrl('', 'cs-CZ'));
});

test('parseSttResponse', () => {
  assert.deepEqual(parseSttResponse({ RecognitionStatus: 'Success', DisplayText: ' Fotíš portréty? ' }), { ok: true, text: 'Fotíš portréty?' });
  assert.deepEqual(parseSttResponse({ RecognitionStatus: 'NoMatch' }), { ok: false, reason: 'NoMatch' });
  assert.deepEqual(parseSttResponse({ RecognitionStatus: 'Success', DisplayText: '' }), { ok: false, reason: 'empty' });
  assert.deepEqual(parseSttResponse(null), { ok: false, reason: 'invalid' });
});
