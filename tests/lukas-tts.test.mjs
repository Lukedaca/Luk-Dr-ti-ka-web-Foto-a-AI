import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanTextForSpeech, handler as ttsHandler } from '../netlify/functions/tts.js';

test('TTS cleanTextForSpeech sanitizes inputs properly', () => {
  assert.equal(cleanTextForSpeech('Hello [[ACTION:test]] world'), 'Hello world');
  assert.equal(cleanTextForSpeech('Check https://example.com/audio link'), 'Check link');
  assert.equal(cleanTextForSpeech('   lots   of   spaces   '), 'lots of spaces');
});

test('TTS handler responds to GET with gemini metadata', async () => {
  const res = await ttsHandler({ httpMethod: 'GET', headers: {} });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.equal(body.provider, 'gemini');
  assert.equal(body.format, 'pcm16');
  assert.equal(body.voice, 'Sulafat');
  assert.equal(body.model, 'gemini-3.8-flash-lite-tts');
  assert.equal(body.sampleRate, 24000);
});

test('TTS handler responds to OPTIONS with 204', async () => {
  const res = await ttsHandler({ httpMethod: 'OPTIONS', headers: {} });
  assert.equal(res.statusCode, 204);
});
