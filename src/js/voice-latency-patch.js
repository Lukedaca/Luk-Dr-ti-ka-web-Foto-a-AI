/**
 * voice-latency-patch.js
 * Perceived-latency patch for text → voice replies.
 * It gives an instant native browser acknowledgement while the higher-quality OpenAI TTS is being generated.
 */
;(function voiceLatencyPatchIIFE() {
  'use strict';

  var VOICE_OUTPUT_KEY = 'lukas_ai_voice_output';
  var ACK_COOLDOWN_MS = 6500;
  var ACK_DELAY_MS = 220;
  var lastAckAt = 0;
  var ackTimer = null;

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

  function detectLang() {
    try {
      if (typeof window.ldGetLanguage === 'function' && window.ldGetLanguage() === 'en') return 'en-US';
    } catch (err) {
      // ignore
    }
    return 'cs-CZ';
  }

  function warmVoiceEndpoints() {
    if (!window.fetch) return;
    fetch('/.netlify/functions/tts', { method: 'GET', cache: 'no-store' }).catch(function() {});
    fetch('/.netlify/functions/chat', { method: 'GET', cache: 'no-store' }).catch(function() {});
  }

  function speakInstantAck() {
    if (!isVoiceOutputEnabled()) return;
    if (isLiveVoiceCallActive()) return;
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;

    var now = Date.now();
    if (now - lastAckAt < ACK_COOLDOWN_MS) return;
    lastAckAt = now;

    var lang = detectLang();
    var text = lang === 'en-US' ? 'Okay.' : 'Jasně.';

    try {
      var utterance = new window.SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 1.08;
      utterance.pitch = 1;
      utterance.volume = 0.85;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      // Native acknowledgement is optional. Do not break the chat.
    }
  }

  function scheduleInstantAck() {
    if (!isVoiceOutputEnabled()) return;
    if (ackTimer) window.clearTimeout(ackTimer);
    ackTimer = window.setTimeout(function() {
      ackTimer = null;
      speakInstantAck();
    }, ACK_DELAY_MS);
  }

  function shouldTriggerFromElement(el) {
    if (!el) return false;
    if (el.id === 'hero-send') return true;
    if (el.id === 'sendMessage' || el.id === 'sendBtn' || el.id === 'chat-send') return true;
    if (el.closest && el.closest('.hero-qr')) return true;
    if (el.closest && el.closest('.quick-reply')) return true;
    return false;
  }

  function bindLatencyPatch() {
    warmVoiceEndpoints();

    document.addEventListener('click', function(event) {
      var target = event.target;
      if (target && target.closest) target = target.closest('button, a, [role="button"]') || target;

      if (target && (target.id === 'hero-speech-toggle' || target.id === 'widget-speech-toggle')) {
        window.setTimeout(warmVoiceEndpoints, 80);
        return;
      }

      if (shouldTriggerFromElement(target)) {
        scheduleInstantAck();
      }
    }, true);

    document.addEventListener('keydown', function(event) {
      if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
      var target = event.target;
      if (!target) return;
      if (target.id === 'hero-input' || target.id === 'chatInput' || target.id === 'messageInput') {
        scheduleInstantAck();
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindLatencyPatch);
  } else {
    bindLatencyPatch();
  }
})();
