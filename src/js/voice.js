/**
 * voice.js — hlasový hovor s Lukáš AI přes Microsoft Azure AI Speech.
 *
 * Smyčka: mikrofon → detekce řeči → Azure REST rozpoznání (krátká nahrávka)
 * → text jde do stejného agenta jako psaný dotaz (window.aiChat.send)
 * → agent odpoví a přečte odpověď svým hlasem (Azure TTS) → znovu poslouchám.
 *
 * Nahrávka se nikam neukládá ani neposílá jinam než do Azure na rozpoznání.
 * Token vydává /.netlify/functions/voice-token (krátkodobý, klíč nejde do prohlížeče).
 *
 * Public API: window.aiVoice = { start, end, state }
 * Stav nikdy není 'active' — chatbot kvůli tomu dřív mlčel (legacy Gemini Live).
 */
import {
  downsample,
  concatFloat32,
  encodeWavPcm16,
  rms,
  createSpeechDetector,
  sttUrl,
  parseSttResponse,
} from './voice-audio.mjs';

(function voiceIIFE() {
  'use strict';

  var VOICE_TOKEN_URL = '/.netlify/functions/voice-token';
  var VOICE_MAX_DURATION_MS = 5 * 60 * 1000;
  var VOICE_MAX_UTTERANCE_MS = 15000;
  var VOICE_NO_SPEECH_MS = 12000;
  var VOICE_MAX_IDLE_ROUNDS = 2;
  var VOICE_REPLY_SETTLE_MS = 1200;
  var VOICE_REPLY_MAX_WAIT_MS = 60000;
  var VOICE_BUFFER_SIZE = 4096;

  // idle | connecting | listening | recognizing | thinking | speaking | ending
  var voiceState = {
    status: 'idle',
    transcript: [],
    startTime: null,
    elapsed: 0
  };

  var voiceDOM = { callBtn: null, overlay: null, orb: null, timer: null, hangup: null, transcript: null, statusEl: null };

  var session = null; // { token, region, fetchedAt }
  var audioCtx = null;
  var micStream = null;
  var micSource = null;
  var processor = null;
  var capture = null; // aktivní poslech: { chunks, detector, startedAt, resolve }
  var maxTimer = null;
  var elapsedTimer = null;
  var runId = 0;
  var prevVoiceOutput = null;

  function t(path, fallback) {
    return typeof window.ldGetText === 'function' ? window.ldGetText(path, fallback) : fallback;
  }

  function isEnglish() {
    return typeof window.ldGetLanguage === 'function' && window.ldGetLanguage() === 'en';
  }

  function checkSupport() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && Ctx && window.fetch);
  }

  function setStatus(status, customText) {
    voiceState.status = status;
    var labels = {
      idle: '',
      connecting: t('voice.connecting', 'Připojuji...'),
      listening: t('voice.listening', 'Poslouchám…'),
      recognizing: t('voice.recognizing', 'Rozpoznávám…'),
      thinking: t('voice.thinking', 'Přemýšlím…'),
      speaking: t('voice.speaking', 'Mluvím…'),
      ending: t('voice.ending', 'Ukončuji...')
    };
    if (voiceDOM.statusEl) voiceDOM.statusEl.textContent = customText || labels[status] || '';
    if (voiceDOM.callBtn) {
      voiceDOM.callBtn.disabled = (status === 'connecting' || status === 'ending');
      voiceDOM.callBtn.setAttribute('data-voice-status', status);
    }
    if (voiceDOM.orb) {
      voiceDOM.orb.classList.toggle('voice-orb-pulse', status === 'listening' || status === 'connecting');
      voiceDOM.orb.classList.toggle('voice-orb-speaking', status === 'speaking');
    }
  }

  function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }

  function addTranscriptLine(role, text) {
    voiceState.transcript.push({ role: role, text: text });
    if (!voiceDOM.transcript) return;
    var line = document.createElement('div');
    line.className = 'voice-transcript-line voice-transcript-' + role;
    var label = document.createElement('strong');
    label.textContent = (role === 'user' ? t('voice.userLabel', 'Vy') : 'Lukáš AI') + ': ';
    line.appendChild(label);
    line.appendChild(document.createTextNode(text));
    voiceDOM.transcript.appendChild(line);
    voiceDOM.transcript.scrollTop = voiceDOM.transcript.scrollHeight;
  }

  function showOverlay() {
    if (!voiceDOM.overlay) return;
    voiceDOM.overlay.classList.remove('hidden');
    voiceDOM.overlay.classList.add('voice-overlay-active');
  }

  function hideOverlay() {
    if (!voiceDOM.overlay) return;
    voiceDOM.overlay.classList.add('hidden');
    voiceDOM.overlay.classList.remove('voice-overlay-active');
  }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  // ── Token ────────────────────────────────────────────────────────────────
  function fetchSession() {
    return fetch(VOICE_TOKEN_URL, { method: 'POST' })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok || !data.token || !data.region) {
            throw new Error(data.error || ('voice token ' + res.status));
          }
          session = { token: data.token, region: data.region, fetchedAt: Date.now() };
          return session;
        });
      });
  }

  function ensureSession() {
    // Azure STS token platí 10 minut; obnovíme s rezervou.
    if (session && Date.now() - session.fetchedAt < 8 * 60 * 1000) return Promise.resolve(session);
    return fetchSession();
  }

  // ── Mikrofon ─────────────────────────────────────────────────────────────
  function openMic() {
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
    }).then(function (stream) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      micStream = stream;
      audioCtx = new Ctx();
      micSource = audioCtx.createMediaStreamSource(stream);
      processor = audioCtx.createScriptProcessor(VOICE_BUFFER_SIZE, 1, 1);
      processor.onaudioprocess = onAudioBlock;
      micSource.connect(processor);
      processor.connect(audioCtx.destination);
    });
  }

  function onAudioBlock(event) {
    var out = event.outputBuffer;
    if (out && out.numberOfChannels) out.getChannelData(0).fill(0); // nic nepouštět do repro
    if (!capture) return;
    var block = new Float32Array(event.inputBuffer.getChannelData(0));
    var blockMs = (block.length / audioCtx.sampleRate) * 1000;
    var phase = capture.detector.push(rms(block), blockMs);
    if (phase === 'waiting' || phase === 'calibrating') {
      // Nikdo nemluví: zahodit případné cvaknutí a držet krátký předběh,
      // ať se neusekne první slabika.
      capture.chunks = [];
      capture.preroll.push(block);
      if (capture.preroll.length > 3) capture.preroll.shift();
    } else {
      capture.chunks.push(block);
    }
    var elapsed = Date.now() - capture.startedAt;
    if (phase === 'done') finishCapture('speech');
    else if (capture.detector.started && elapsed > VOICE_MAX_UTTERANCE_MS) finishCapture('speech');
    else if (!capture.detector.started && elapsed > VOICE_NO_SPEECH_MS) finishCapture('silence');
  }

  function listenOnce() {
    return new Promise(function (resolve) {
      capture = {
        chunks: [],
        preroll: [],
        detector: createSpeechDetector(),
        startedAt: Date.now(),
        resolve: resolve
      };
    });
  }

  function finishCapture(kind) {
    var c = capture;
    capture = null;
    if (!c) return;
    if (kind !== 'speech' || !c.chunks.length) { c.resolve(null); return; }
    var samples = downsample(concatFloat32(c.preroll.concat(c.chunks)), audioCtx.sampleRate);
    c.resolve(encodeWavPcm16(samples));
  }

  // ── Rozpoznání (Azure REST, krátká nahrávka) ─────────────────────────────
  function recognize(wav, retried) {
    return ensureSession().then(function (s) {
      return fetch(sttUrl(s.region, isEnglish() ? 'en-US' : 'cs-CZ'), {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + s.token,
          'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
          'Accept': 'application/json'
        },
        body: wav
      }).then(function (res) {
        if (res.status === 401 && !retried) {
          session = null;
          return recognize(wav, true);
        }
        if (!res.ok) throw new Error('stt ' + res.status);
        return res.json().then(parseSttResponse);
      });
    });
  }

  // ── Odpověď agenta ───────────────────────────────────────────────────────
  function lastAssistantText() {
    var msgs = window.aiChat && window.aiChat.state && window.aiChat.state.messages;
    if (!msgs) return '';
    for (var i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant') return String(msgs[i].content || '');
    }
    return '';
  }

  function agentBusy() {
    var chat = window.aiChat;
    if (!chat) return false;
    var speaking = typeof chat.isSpeaking === 'function' && chat.isSpeaking();
    if (speaking && voiceState.status !== 'speaking') setStatus('speaking');
    return !!(chat.state && chat.state.isProcessing) || speaking;
  }

  // Čeká, až agent dopíše i domluví; ticho musí vydržet, protože TTS věty
  // dobíhají po skončení textového streamu.
  function waitForReply(myRun) {
    var started = Date.now();
    var quietSince = 0;
    function tick() {
      if (myRun !== runId) return Promise.resolve();
      if (Date.now() - started > VOICE_REPLY_MAX_WAIT_MS) return Promise.resolve();
      if (agentBusy()) quietSince = 0;
      else if (!quietSince) quietSince = Date.now();
      if (quietSince && Date.now() - quietSince >= VOICE_REPLY_SETTLE_MS) return Promise.resolve();
      return wait(150).then(tick);
    }
    return wait(300).then(tick);
  }

  function askAgent(text, myRun) {
    var chat = window.aiChat;
    if (!chat || typeof chat.send !== 'function') return Promise.reject(new Error('agent unavailable'));
    var before = lastAssistantText();
    setStatus('thinking');
    chat.send(text);
    return waitForReply(myRun).then(function () {
      var reply = lastAssistantText();
      if (reply && reply !== before) addTranscriptLine('assistant', reply);
    });
  }

  // ── Hlavní smyčka ────────────────────────────────────────────────────────
  function loop(myRun, idleRounds) {
    if (myRun !== runId) return Promise.resolve();
    setStatus('listening');
    return listenOnce().then(function (wav) {
      if (myRun !== runId) return;
      if (!wav) {
        if (idleRounds + 1 >= VOICE_MAX_IDLE_ROUNDS) { voiceEnd(); return; }
        return loop(myRun, idleRounds + 1);
      }
      setStatus('recognizing');
      return recognize(wav).then(function (result) {
        if (myRun !== runId) return;
        if (!result.ok) return loop(myRun, idleRounds);
        addTranscriptLine('user', result.text);
        return askAgent(result.text, myRun).then(function () { return loop(myRun, 0); });
      });
    });
  }

  function startTimers() {
    voiceState.startTime = Date.now();
    voiceState.elapsed = 0;
    if (voiceDOM.timer) voiceDOM.timer.textContent = '00:00';
    elapsedTimer = setInterval(function () {
      voiceState.elapsed++;
      if (voiceDOM.timer) voiceDOM.timer.textContent = formatTime(voiceState.elapsed);
    }, 1000);
    maxTimer = setTimeout(voiceEnd, VOICE_MAX_DURATION_MS);
  }

  function voiceStart() {
    if (voiceState.status !== 'idle') return;
    if (!checkSupport()) {
      showOverlay();
      setStatus('ending', t('voice.unsupported', 'Tenhle prohlížeč hlasový hovor nepodporuje. Můžete psát.'));
      setTimeout(function () { hideOverlay(); setStatus('idle'); }, 2500);
      return;
    }
    var myRun = ++runId;
    voiceState.transcript = [];
    if (voiceDOM.transcript) voiceDOM.transcript.innerHTML = '';
    showOverlay();
    setStatus('connecting');

    // Odpovědi v hovoru agent čte nahlas; původní volbu po hovoru vrátíme.
    if (window.aiChat && window.aiChat.state && typeof window.aiChat.setVoiceOutput === 'function') {
      prevVoiceOutput = !!window.aiChat.state.voiceOutputEnabled;
      if (!prevVoiceOutput) window.aiChat.setVoiceOutput(true, { silent: true });
    }

    fetchSession()
      .then(openMic)
      .then(function () {
        if (myRun !== runId) return;
        startTimers();
        return loop(myRun, 0);
      })
      .catch(function (err) {
        console.error('voice.js:', err);
        if (myRun !== runId) return;
        setStatus('ending', t('voice.connectionFailed', 'Nepodařilo se navázat spojení') + '. ' + t('voice.fallbackText', 'Můžete psát.'));
        cleanup();
        setTimeout(function () { hideOverlay(); setStatus('idle'); }, 2500);
      });
  }

  function cleanup() {
    capture = null;
    if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null; }
    if (maxTimer) { clearTimeout(maxTimer); maxTimer = null; }
    if (processor) { try { processor.disconnect(); } catch (e) {} processor.onaudioprocess = null; processor = null; }
    if (micSource) { try { micSource.disconnect(); } catch (e) {} micSource = null; }
    if (micStream) { micStream.getTracks().forEach(function (tr) { tr.stop(); }); micStream = null; }
    if (audioCtx) { try { audioCtx.close(); } catch (e) {} audioCtx = null; }
    if (prevVoiceOutput === false && window.aiChat && typeof window.aiChat.setVoiceOutput === 'function') {
      window.aiChat.setVoiceOutput(false, { silent: true });
    }
    prevVoiceOutput = null;
  }

  function voiceEnd() {
    if (voiceState.status === 'idle' || voiceState.status === 'ending') return;
    runId++;
    setStatus('ending');
    if (capture) capture.resolve(null);
    if (window.aiChat && typeof window.aiChat.stopSpeech === 'function') window.aiChat.stopSpeech();
    cleanup();
    setTimeout(function () { hideOverlay(); setStatus('idle'); }, 500);
  }

  function voiceInit() {
    voiceDOM.callBtn = document.getElementById('voice-call-btn');
    voiceDOM.overlay = document.getElementById('voice-overlay');
    voiceDOM.orb = document.getElementById('voice-orb');
    voiceDOM.timer = document.getElementById('voice-timer');
    voiceDOM.hangup = document.getElementById('voice-hangup');
    voiceDOM.transcript = document.getElementById('voice-transcript');
    voiceDOM.statusEl = document.getElementById('voice-status');

    if (voiceDOM.callBtn) {
      voiceDOM.callBtn.addEventListener('click', function () {
        if (voiceState.status === 'idle') voiceStart();
        else voiceEnd();
      });
    }
    if (voiceDOM.hangup) voiceDOM.hangup.addEventListener('click', voiceEnd);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && voiceState.status !== 'idle') voiceEnd();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', voiceInit);
  else voiceInit();

  window.aiVoice = { start: voiceStart, end: voiceEnd, state: voiceState };
})();
