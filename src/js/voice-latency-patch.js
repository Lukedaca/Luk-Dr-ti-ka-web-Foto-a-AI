/**
 * voice-latency-patch.js
 * Low-latency voice mode for text replies.
 *
 * Problem with server TTS:
 * chat stream -> TTS request -> audio generation -> base64 playback = slow first sound.
 *
 * This patch used to intercept /tts calls for browser SpeechSynthesis.
 * Premium voice now stays server-side only, so this fallback remains disabled.
 */
;(function voiceLatencyPatchIIFE() {
  'use strict';

  var TTS_ENDPOINT = '/.netlify/functions/tts';
  var VOICE_OUTPUT_KEY = 'lukas_ai_voice_output';
  var FAST_NATIVE_KEY = 'lukas_ai_fast_native_voice';
  var originalFetch = window.fetch ? window.fetch.bind(window) : null;
  var selectedVoiceByLang = {};
  var lastSpokenAt = 0;

  function isFastNativeEnabled() {
    return false;
  }

  function isVoiceOutputEnabled() {
    try {
      return window.localStorage.getItem(VOICE_OUTPUT_KEY) === 'on';
    } catch (err) {
      return false;
    }
  }

  function isLiveVoiceCallActive() {
    return !!(window.aiVoice && window.aiVoice.state && window.aiVoice.state.status === 'active');
  }

  function supportsNativeSpeech() {
    return !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
  }

  function normalizeLang(lang) {
    var value = String(lang || '').toLowerCase();
    if (value.indexOf('en') === 0) return 'en-US';
    if (value.indexOf('cs') === 0 || value.indexOf('cz') === 0) return 'cs-CZ';
    try {
      if (typeof window.ldGetLanguage === 'function' && window.ldGetLanguage() === 'en') return 'en-US';
    } catch (err) {
      // ignore
    }
    return 'cs-CZ';
  }

  function getBestVoice(lang) {
    if (!supportsNativeSpeech() || !window.speechSynthesis.getVoices) return null;
    if (selectedVoiceByLang[lang]) return selectedVoiceByLang[lang];

    var voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;

    var langPrefix = lang.slice(0, 2).toLowerCase();
    var preferredNames = [
      'jakub', 'google cestina', 'microsoft czech', 'czech',
      'aria', 'guy', 'jenny', 'google us english', 'microsoft english'
    ];
    var exact = voices.find(function(v) { return String(v.lang || '').toLowerCase() === lang.toLowerCase(); });
    var prefix = voices.find(function(v) { return String(v.lang || '').toLowerCase().slice(0, 2) === langPrefix; });
    var local = voices.find(function(v) { return v.localService && String(v.lang || '').toLowerCase().slice(0, 2) === langPrefix; });
    var preferred = voices.find(function(v) {
      var name = String(v.name || '').toLowerCase();
      return String(v.lang || '').toLowerCase().slice(0, 2) === langPrefix
        && preferredNames.some(function(part) { return name.indexOf(part) !== -1; });
    });

    selectedVoiceByLang[lang] = preferred || local || exact || prefix || null;
    return selectedVoiceByLang[lang];
  }

  function cleanSpeechText(text) {
    return String(text || '')
      .replace(/\[\[ACTION:[^\]]+\]\]/gi, '')
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function speakNative(text, lang) {
    if (!supportsNativeSpeech()) return false;
    if (!isVoiceOutputEnabled()) return false;
    if (!isFastNativeEnabled()) return false;
    if (isLiveVoiceCallActive()) return false;

    var clean = cleanSpeechText(text);
    if (!clean) return false;

    try {
      var normalizedLang = normalizeLang(lang);
      var utterance = new window.SpeechSynthesisUtterance(clean);
      var voice = getBestVoice(normalizedLang);

      utterance.lang = normalizedLang;
      utterance.rate = normalizedLang === 'en-US' ? 0.98 : 0.95;
      utterance.pitch = normalizedLang === 'en-US' ? 0.94 : 0.9;
      utterance.volume = 1;
      if (voice) utterance.voice = voice;

      // Do not cancel here. chatbot.js increments requestId and clears its own queue.
      // Native SpeechSynthesis should speak sentence chunks in order.
      window.speechSynthesis.speak(utterance);
      lastSpokenAt = Date.now();
      return true;
    } catch (err) {
      return false;
    }
  }

  function isTtsRequest(input) {
    var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    return typeof url === 'string' && url.indexOf(TTS_ENDPOINT) !== -1;
  }

  function parseBody(init) {
    if (!init || !init.body || typeof init.body !== 'string') return {};
    try {
      return JSON.parse(init.body);
    } catch (err) {
      return {};
    }
  }

  function fakeTtsResponse(lang, nativeSpoken) {
    var body = JSON.stringify({
      audio: null,
      sampleRate: 24000,
      lang: lang || 'cs-CZ',
      native: true,
      spoken: !!nativeSpoken
    });
    return Promise.resolve(new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  function installFetchInterceptor() {
    if (!originalFetch || !supportsNativeSpeech()) return;
    if (window.__lukasFastNativeVoiceInstalled) return;
    window.__lukasFastNativeVoiceInstalled = true;

    window.fetch = function(input, init) {
      if (isTtsRequest(input) && isFastNativeEnabled()) {
        var body = parseBody(init);
        var lang = normalizeLang(body.lang);
        var spoken = speakNative(body.text, lang);
        return fakeTtsResponse(lang, spoken);
      }
      return originalFetch(input, init);
    };
  }

  function warmVoices() {
    if (!supportsNativeSpeech()) return;
    try {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = function() {
        selectedVoiceByLang = {};
        getBestVoice('cs-CZ');
        getBestVoice('en-US');
      };
    } catch (err) {
      // ignore
    }
  }

  function warmEndpoints() {
    if (!originalFetch) return;
    originalFetch('/.netlify/functions/chat', { method: 'GET', cache: 'no-store' }).catch(function() {});
  }

  function bind() {
    warmVoices();
    installFetchInterceptor();
    warmEndpoints();

    document.addEventListener('click', function(event) {
      var target = event.target && event.target.closest ? event.target.closest('button, a, [role="button"]') : event.target;
      if (target && target.id === 'hero-speech-toggle') {
        setTimeout(warmVoices, 80);
        setTimeout(warmEndpoints, 120);
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
