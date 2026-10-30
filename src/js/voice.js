/**
 * voice.js — hlasový hovor s Lukáš AI přes nativní Web Speech API a Gemini 3.8 TTS.
 *
 * Smyčka: mikrofon (nativní SpeechRecognition v prohlížeči, bez externích tokenů a bez Azure)
 * → text jde do agenta (window.aiChat.send)
 * → agent odpoví a přečte odpověď svým hlasem (Google Gemini 3.8 TTS, Sulafat)
 * → po domluvení znovu poslouchá další repliku.
 *
 * Public API: window.aiVoice = { start, end, state }
 */

(function voiceIIFE() {
  'use strict';

  var VOICE_MAX_DURATION_MS = 5 * 60 * 1000;
  var VOICE_REPLY_SETTLE_MS = 1200;
  var VOICE_REPLY_MAX_WAIT_MS = 60000;

  var voiceState = {
    status: 'idle',
    transcript: [],
    startTime: null,
    elapsed: 0
  };

  var voiceDOM = {
    callBtn: null,
    overlay: null,
    orb: null,
    timer: null,
    hangup: null,
    transcript: null,
    statusEl: null
  };

  var recognition = null;
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

  function getSpeechRecognitionCtor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function checkSupport() {
    return !!getSpeechRecognitionCtor();
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

  function listenTurn(myRun) {
    return new Promise(function (resolve) {
      var SpeechRecognitionCtor = getSpeechRecognitionCtor();
      if (!SpeechRecognitionCtor || myRun !== runId) {
        resolve(null);
        return;
      }

      var rec = new SpeechRecognitionCtor();
      recognition = rec;
      rec.lang = isEnglish() ? 'en-US' : 'cs-CZ';
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      var recognizedText = '';

      rec.onstart = function () {
        if (myRun === runId) setStatus('listening');
      };

      rec.onresult = function (event) {
        if (myRun !== runId) return;
        var interim = '';
        for (var i = event.resultIndex; i < event.results.length; i++) {
          var res = event.results[i];
          if (res.isFinal) {
            recognizedText = (recognizedText + ' ' + res[0].transcript).trim();
          } else {
            interim = (interim + ' ' + res[0].transcript).trim();
          }
        }
        if (interim) {
          setStatus('listening', interim);
        }
      };

      rec.onerror = function (event) {
        if (event.error === 'no-speech') {
          resolve(null);
          return;
        }
        console.warn('SpeechRecognition error:', event.error);
        resolve(null);
      };

      rec.onend = function () {
        recognition = null;
        resolve(recognizedText || null);
      };

      try {
        rec.start();
      } catch (err) {
        console.warn('SpeechRecognition start failed:', err);
        recognition = null;
        resolve(null);
      }
    });
  }

  function loop(myRun, idleRounds) {
    if (myRun !== runId) return Promise.resolve();
    return listenTurn(myRun).then(function (text) {
      if (myRun !== runId) return;
      if (!text) {
        if (idleRounds + 1 >= 3) {
          voiceEnd();
          return;
        }
        return loop(myRun, idleRounds + 1);
      }
      addTranscriptLine('user', text);
      return askAgent(text, myRun).then(function () {
        return loop(myRun, 0);
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
      setStatus('ending', t('voice.unsupported', 'Tenhle prohlížeč nativní hlas nepodporuje. Můžete psát.'));
      setTimeout(function () { hideOverlay(); setStatus('idle'); }, 2500);
      return;
    }
    var myRun = ++runId;
    voiceState.transcript = [];
    if (voiceDOM.transcript) voiceDOM.transcript.innerHTML = '';
    showOverlay();
    setStatus('connecting');

    if (window.aiChat && window.aiChat.state && typeof window.aiChat.setVoiceOutput === 'function') {
      prevVoiceOutput = !!window.aiChat.state.voiceOutputEnabled;
      if (!prevVoiceOutput) window.aiChat.setVoiceOutput(true, { silent: true });
    }

    startTimers();
    loop(myRun, 0).catch(function (err) {
      console.error('voice.js loop error:', err);
      if (myRun !== runId) return;
      setStatus('ending', t('voice.connectionFailed', 'Hovor byl ukončen.'));
      cleanup();
      setTimeout(function () { hideOverlay(); setStatus('idle'); }, 2000);
    });
  }

  function cleanup() {
    if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null; }
    if (maxTimer) { clearTimeout(maxTimer); maxTimer = null; }
    if (recognition) {
      try { recognition.abort(); } catch (e) {}
      recognition = null;
    }
    if (prevVoiceOutput === false && window.aiChat && typeof window.aiChat.setVoiceOutput === 'function') {
      window.aiChat.setVoiceOutput(false, { silent: true });
    }
    prevVoiceOutput = null;
  }

  function voiceEnd() {
    if (voiceState.status === 'idle' || voiceState.status === 'ending') return;
    runId++;
    setStatus('ending');
    if (recognition) {
      try { recognition.abort(); } catch (e) {}
      recognition = null;
    }
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
