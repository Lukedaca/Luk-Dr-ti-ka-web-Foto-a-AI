import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanTextForSpeech, handler as ttsHandler } from '../netlify/functions/tts.js';
import { handler as azureTokenHandler } from '../netlify/functions/azure-speech-token.mjs';

test('TTS cleanTextForSpeech sanitizes inputs properly', () => {
  assert.equal(cleanTextForSpeech('Hello [[ACTION:test]] world'), 'Hello world');
  assert.equal(cleanTextForSpeech('Check https://example.com/audio link'), 'Check link');
  assert.equal(cleanTextForSpeech('   lots   of   spaces   '), 'lots of spaces');
});

test('TTS handler responds to GET with azure-speech metadata', async () => {
  const res = await ttsHandler({ httpMethod: 'GET', headers: {} });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.equal(body.provider, 'azure-speech');
  assert.equal(body.format, 'audio-24khz-48kbitrate-mono-mp3');
  assert.equal(body.voice, 'cs-CZ-VlastaNeural');
  assert.equal(body.sampleRate, 24000);
});

test('Azure Speech token handler responds to OPTIONS with 204', async () => {
  const res = await azureTokenHandler({ httpMethod: 'OPTIONS', headers: {} });
  assert.equal(res.statusCode, 204);
});
