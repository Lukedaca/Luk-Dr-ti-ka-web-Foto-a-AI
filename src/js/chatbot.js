/**
 * chatbot.js - Lukas AI public + agent workbench experience
 * Shared state (window.aiChat) drives both hero chat and floating widget.
 */
;(function chatbotIIFE() {
  'use strict';

  var CHATBOT_AGENT_FORM_URL = '/';
  var CHATBOT_AGENT_FORM_NAME = 'lukas-ai-agent';
  var CHATBOT_INACTIVITY_MS = 180000;
  var CHATBOT_API_URL = '/.netlify/functions/chat';
  var CHATBOT_TTS_API_URL = '/.netlify/functions/tts';
  var CHATBOT_DEFAULT_MODE = 'talk';
  var CHATBOT_ALLOWED_MODES = { talk: true, think: true, build: true };
  var CHATBOT_VOICE_OUTPUT_KEY = 'lukas_ai_voice_output';
  var CHATBOT_SESSION_ID_KEY = 'lukas_ai_session_id';
  var CHATBOT_VISITOR_ID_KEY = 'lukas_ai_visitor_id';
  var CHATBOT_MEMORY_CONSENT_KEY = 'lukas_ai_memory_consent';
  var CHATBOT_MEMORY_PROMPT_KEY = 'lukas_ai_memory_prompted';
  var CHATBOT_CAN_NATIVE_SPEAK = !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
  var CHATBOT_CAN_SERVER_TTS = !!((window.AudioContext || window.webkitAudioContext) && window.fetch);
  var CHATBOT_CAN_SPEAK = !!CHATBOT_CAN_SERVER_TTS;
  var CHATBOT_TTS_SAMPLE_RATE = 24000;
  var CHATBOT_TTS_FIRST_STRONG_MIN = 18;
  var CHATBOT_TTS_FIRST_SOFT_MIN = 52;
  var CHATBOT_TTS_FIRST_HARD_MAX = 160;
  var CHATBOT_TTS_NEXT_STRONG_MIN = 48;
  var CHATBOT_TTS_NEXT_SOFT_MIN = 140;
  var CHATBOT_TTS_NEXT_HARD_MAX = 300;
  var CHATBOT_FAST_NATIVE_VOICE_KEY = 'lukas_ai_fast_native_voice';

  function chatbotText(path, fallback) {
    return typeof window.ldGetText === 'function' ? window.ldGetText(path, fallback) : fallback;
  }

  function chatbotNormalizeMode(mode) {
    return CHATBOT_ALLOWED_MODES[mode] ? mode : CHATBOT_DEFAULT_MODE;
  }

  function chatbotLanguage() {
    return typeof window.ldGetLanguage === 'function' ? window.ldGetLanguage() : 'cs';
  }

  function chatbotLocale() {
    var isEn = chatbotLanguage() === 'en';
    return {
      welcome: isEn
        ? 'Hi, I am Lukas AI. I can chat with you, think through your request and immediately prepare a mini output. You can write in English or Czech and you can also talk to me by voice.'
        : 'Ahoj, jsem Lukáš AI. Umím si s tebou povídat, promyslet zadání a rovnou připravit mini výstup. Můžeš psát česky i anglicky a můžeš se mnou i mluvit hlasem.',
      modeMeta: {
        talk: {
          label: 'Talk',
          badge: isEn ? 'Hybrid agent' : 'Hybridní agent',
          helper: isEn
            ? 'Talk to me like a digital version of Lukas. English when needed, Czech by default.'
            : 'Povídej si se mnou jako s digitální verzí Lukáše. Česky defaultně, anglicky podle potřeby.',
          replies: isEn
            ? [
                { text: 'What do you do?', value: 'What exactly do you do and how do you help people?' },
                { text: 'Reply by voice', value: 'Please reply by voice while I keep typing.' },
                { text: 'Show portfolio', value: 'Show me the portfolio and tell me what stands out most.' },
                { text: 'Photography', value: 'What photography services do you offer?' },
                { text: 'Fotograf AI', value: 'Explain Fotograf AI to me in simple terms.' }
              ]
            : [
                { text: 'Co přesně děláš?', value: 'Co přesně děláš a s čím lidem pomáháš?' },
                { text: 'Odpovídej hlasem', value: 'Odpovídej mi prosím hlasem, ale já budu dál psát.' },
                { text: 'Speak English', value: 'Please continue in English and tell me what you do.' },
                { text: 'Ukaž portfolio', value: 'Ukaž mi portfolio a co je na něm nejzajímavější.' },
                { text: 'Fotograf AI', value: 'Vysvětli mi lidsky, co je Fotograf AI.' }
              ]
        },
        think: {
          label: 'Think',
          badge: isEn ? 'Agent reasoning' : 'Agentní úvaha',
          helper: isEn
            ? 'I will help choose a practical direction for photography, portfolio or collaboration.'
            : 'Pomůžu vybrat praktický směr pro focení, portfolio nebo spolupráci.',
          replies: isEn
            ? [
                { text: 'Latest gallery', value: 'Show me the latest photo gallery.' },
                { text: 'Photo shoot choice', value: 'Help me choose the right type of photo shoot.' },
                { text: 'Collaboration', value: 'What is the best next step if I want to work with Lukas?' }
              ]
            : [
                { text: 'Nejnovější galerie', value: 'Ukaž mi nejnovější fotogalerii.' },
                { text: 'Výběr focení', value: 'Pomoz mi vybrat vhodný typ focení.' },
                { text: 'Spolupráce', value: 'Jaký je nejlepší další krok, když chci spolupracovat s Lukášem?' }
              ]
        },
        build: {
          label: 'Brief',
          badge: isEn ? 'Inquiry brief' : 'Poptávkový brief',
          helper: isEn
            ? 'I prepare a short non-technical brief for a shoot, portfolio or collaboration.'
            : 'Připravím krátký netechnický brief pro focení, portfolio nebo spolupráci.',
          replies: isEn
            ? [
                { text: 'Shoot brief', value: 'Create a short inquiry brief for a photo shoot.' },
                { text: 'Portfolio note', value: 'Prepare a short note about what I liked in the portfolio.' },
                { text: 'Contact message', value: 'Draft a short message for contacting Lukas about collaboration.' }
              ]
            : [
                { text: 'Brief focení', value: 'Vytvoř krátký poptávkový brief pro focení.' },
                { text: 'Poznámka k portfoliu', value: 'Připrav krátkou poznámku k tomu, co mě zaujalo v portfoliu.' },
                { text: 'Zpráva Lukášovi', value: 'Navrhni krátkou zprávu Lukášovi kvůli spolupráci.' }
              ]
        }
      },
      workbench: {
        buildSteps: isEn ? ['Understand the goal', 'Prepare a mini output', 'Suggest the next step'] : ['Pochopím cíl', 'Připravím mini výstup', 'Navrhnu další krok'],
        thinkSteps: isEn ? ['Understand context', 'Choose the best direction', 'Show recommendation'] : ['Pochopím kontext', 'Vyberu nejlepší směr', 'Ukážu doporučení'],
        talkSteps: isEn ? ['Start the conversation', 'Choose a useful direction', 'Move things forward'] : ['Navážu konverzaci', 'Vyberu užitečný směr', 'Posunu to dál']
      },
      helperNoteHtml: isEn
        ? 'Click <strong class="text-white/85 font-semibold">Talk by voice</strong> for a live voice call or enable <strong class="text-white/85 font-semibold">voice replies</strong> when you want to type and hear answers aloud. The hybrid agent works in <strong class="text-white/85 font-semibold">CZ / EN</strong>.'
        : 'Klikni na <strong class="text-white/85 font-semibold">Mluvit hlasem</strong> pro voice call nebo zapni <strong class="text-white/85 font-semibold">hlasové odpovědi</strong>, když chceš psát a slyšet odpovědi nahlas. Hybridní agent funguje v <strong class="text-white/85 font-semibold">CZ / EN</strong>.',
      voiceOutputUnsupported: isEn ? 'Voice replies unavailable' : 'Hlasové odpovědi nejsou dostupné',
      voiceOutputOn: isEn ? 'Voice replies: on' : 'Hlasové odpovědi: zapnuto',
      voiceOutputOff: isEn ? 'Voice replies: off' : 'Hlasové odpovědi: vypnuto',
      voiceShortOn: isEn ? 'Voice on' : 'Hlas zap.',
      voiceShortOff: isEn ? 'Voice off' : 'Hlas vyp.',
      voiceEnabledMessage: isEn ? 'Voice replies are enabled. Keep typing and I will answer aloud as well.' : 'Hlasové odpovědi jsou zapnuté. Klidně piš, budu odpovídat i nahlas.',
      voiceDisabledMessage: isEn ? 'Voice replies are disabled. I will answer only in text now.' : 'Hlasové odpovědi jsou vypnuté. Budu už jen psát.',
      voiceGeminiUnavailable: isEn ? 'Gemini TTS voice is not available right now, so I will keep replying in text.' : 'Gemini TTS hlas teď není dostupný, takže zatím odpovím textem.',
      publicAssistantBadge: isEn ? 'Hybrid agent' : 'Hybridní agent',
      widgetAssistantBadge: isEn ? 'Hybrid agent' : 'Hybridní agent',
      defaultAssistantMessage: isEn ? 'I will think it through with you and suggest the next step.' : 'Promyslím to s tebou a navrhnu další krok.',
      tour: {
        launch: isEn ? 'Live demo' : 'Živá ukázka',
        pickTitle: isEn ? 'Pick your field — the agent tailors the demo live' : 'Vyber obor — agent ukázku přizpůsobí naživo',
        pickHint: isEn ? 'Watch it talk and drive the page hands-free.' : 'Sleduj, jak mluví a sám ovládá stránku.',
        fields: isEn
          ? [
              { label: 'E-shop', value: 'online e-shop' },
              { label: 'Services', value: 'company providing services' },
              { label: 'Restaurant', value: 'restaurant / café' },
              { label: 'General demo', value: '' }
            ]
          : [
              { label: 'E-shop', value: 'e-shop' },
              { label: 'Služby', value: 'firma poskytující služby' },
              { label: 'Restaurace', value: 'restaurace / kavárna' },
              { label: 'Obecná ukázka', value: '' }
            ],
        loading: isEn ? 'Preparing your live demo…' : 'Připravuju živou ukázku…',
        badge: isEn ? 'LIVE DEMO' : 'ŽIVÁ UKÁZKA',
        stop: isEn ? 'Stop' : 'Zastavit',
        skip: isEn ? 'Skip' : 'Přeskočit',
        cancel: isEn ? 'Cancel' : 'Zrušit'
      }
    };
  }

  var CHATBOT_MODE_META = {
    talk: {
      label: 'Talk',
      badge: 'Public presence',
      helper: 'Povídej si se mnou jako s digitální verzí Lukáše. Česky defaultně, anglicky podle potřeby.',
      replies: [
        { text: 'Co přesně děláš?', value: 'Co přesně děláš a s čím lidem pomáháš?' },
        { text: 'Odpovídej hlasem', value: 'Odpovídej mi prosím hlasem, ale já budu dál psát.' },
        { text: 'Speak English', value: 'Please continue in English and tell me what you do.' },
        { text: 'Ukaž portfolio', value: 'Ukaž mi portfolio a co je na něm nejzajímavější.' },
        { text: 'Fotograf AI', value: 'Vysvětli mi lidsky, co je Fotograf AI.' }
      ]
    },
    think: {
      label: 'Think',
      badge: 'Agent reasoning',
      helper: 'Pomůžu vybrat praktický směr pro focení, portfolio nebo spolupráci.',
      replies: [
        { text: 'Nejnovější galerie', value: 'Ukaž mi nejnovější fotogalerii.' },
        { text: 'Výběr focení', value: 'Pomoz mi vybrat vhodný typ focení.' },
        { text: 'Spolupráce', value: 'Jaký je nejlepší další krok, když chci spolupracovat s Lukášem?' }
      ]
    },
    build: {
      label: 'Brief',
      badge: 'Poptávkový brief',
      helper: 'Připravím krátký netechnický brief pro focení, portfolio nebo spolupráci.',
      replies: [
        { text: 'Brief focení', value: 'Vytvoř krátký poptávkový brief pro focení.' },
        { text: 'Poznámka k portfoliu', value: 'Připrav krátkou poznámku k tomu, co mě zaujalo v portfoliu.' },
        { text: 'Zpráva Lukášovi', value: 'Navrhni krátkou zprávu Lukášovi kvůli spolupráci.' }
      ]
    }
  };

  var CHATBOT_WELCOME = 'Ahoj, jsem Lukáš AI. Umím si s tebou povídat, promyslet zadání a rovnou připravit mini výstup. Můžeš psát česky i anglicky a můžeš se mnou i mluvit hlasem.';

  function chatbotWelcomeMessage() {
    return chatbotLocale().welcome;
  }

  function chatbotDefaultWorkbench(mode) {
    var locale = chatbotLocale();
    var meta = chatbotModeMeta(mode);
    var isEn = chatbotLanguage() === 'en';
    return {
      summary: meta.helper,
      intent: mode + '-mode',
      steps: mode === 'build'
        ? locale.workbench.buildSteps
        : mode === 'think'
          ? locale.workbench.thinkSteps
          : locale.workbench.talkSteps,
      artifactTitle: mode === 'build'
        ? (isEn ? 'What I can prepare' : 'Co můžu připravit')
        : (isEn ? 'What this mode can do' : 'Co tenhle režim umí'),
      artifactBody: mode === 'build'
        ? (isEn ? 'I can prepare a short non-technical brief, contact message or portfolio note.' : 'Můžu připravit krátký netechnický brief, zprávu ke kontaktu nebo poznámku k portfoliu.')
        : mode === 'think'
          ? (isEn ? 'I can help choose a sensible next step around photography, portfolio or collaboration.' : 'Můžu pomoct vybrat rozumný další krok kolem focení, portfolia nebo spolupráce.')
          : (isEn ? 'I can talk about Lukas, the projects, the portfolio and switch into an agent workflow when it makes sense.' : 'Můžu mluvit o Lukášovi, projektech, portfoliu a při správné chvíli se přepnout do agentního režimu.'),
      ctaLabel: mode === 'build' ? (isEn ? 'Prepare a brief' : 'Připravit brief') : (isEn ? 'Show latest gallery' : 'Ukázat nejnovější galerii'),
      ctaValue: mode === 'build'
        ? (isEn ? 'Create a short non-technical collaboration brief.' : 'Vytvoř krátký netechnický brief ke spolupráci.')
        : (isEn ? 'Show me the latest photo gallery.' : 'Ukaž mi nejnovější fotogalerii.')
    };
  }

  function chatbotNormalizeWorkbench(workbench, mode, message) {
    var fallback = chatbotDefaultWorkbench(mode);
    var data = workbench && typeof workbench === 'object' ? workbench : {};

    return {
      summary: typeof data.summary === 'string' && data.summary.trim() ? data.summary.trim() : fallback.summary,
      intent: typeof data.intent === 'string' && data.intent.trim() ? data.intent.trim() : fallback.intent,
      steps: Array.isArray(data.steps) && data.steps.length
        ? data.steps.filter(function(step) { return typeof step === 'string' && step.trim(); }).slice(0, 4)
        : fallback.steps,
      artifactTitle: typeof data.artifactTitle === 'string' && data.artifactTitle.trim() ? data.artifactTitle.trim() : fallback.artifactTitle,
      artifactBody: typeof data.artifactBody === 'string' && data.artifactBody.trim() ? data.artifactBody.trim() : (message || fallback.artifactBody),
      ctaLabel: typeof data.ctaLabel === 'string' && data.ctaLabel.trim() ? data.ctaLabel.trim() : fallback.ctaLabel,
      ctaValue: typeof data.ctaValue === 'string' && data.ctaValue.trim() ? data.ctaValue.trim() : fallback.ctaValue
    };
  }

  function chatbotNormalizeReplies(replies, mode) {
    if (!Array.isArray(replies) || !replies.length) {
      return chatbotModeMeta(mode).replies;
    }

    var normalized = replies
      .map(function(reply) {
        return {
          text: typeof reply.text === 'string' ? reply.text.trim().slice(0, 32) : '',
          value: typeof reply.value === 'string' ? reply.value.trim().slice(0, 180) : ''
        };
      })
      .filter(function(reply) { return reply.text && reply.value; })
      .slice(0, 3);

    return normalized.length ? normalized : chatbotModeMeta(mode).replies;
  }

  var chatbotState = {
    messages: [],
    isWidgetOpen: false,
    isHeroVisible: true,
    inactivityTimer: null,
    notificationSent: false,
    isProcessing: false,
    mode: CHATBOT_DEFAULT_MODE,
    workbench: chatbotDefaultWorkbench(CHATBOT_DEFAULT_MODE),
    voiceOutputEnabled: false,
    voiceOutputErrorShown: false,
    preferredSpeechLang: 'cs-CZ',
    sessionId: null,
    visitorId: null,
    memoryConsent: false
  };

  var chatbotDOM = {
    chatBtn: null,
    chatWindow: null,
    chatInput: null,
    sendBtn: null,
    closeChat: null,
    clearChat: null,
    messages: null,
    quickReplies: null,
    unreadBadge: null,
    widgetModeBadge: null,
    heroInput: null,
    heroSend: null,
    heroMessages: null,
    heroQuickReplies: null,
    heroSpeechToggle: null,
    widgetSpeechToggle: null,
    modeButtons: [],
    heroModeBadge: null,
    workbenchSummary: null,
    workbenchIntent: null,
    workbenchSteps: null,
    workbenchArtifactTitle: null,
    workbenchArtifactBody: null,
    workbenchCta: null
  };

  var chatbotUnreadCount = 0;
  var chatbotPlaybackCtx = null;
  var chatbotPlaybackSource = null;
  var chatbotNativeSpeech = window.speechSynthesis || null;
  var chatbotSpeechRequestId = 0;
  var chatbotAudioQueue = [];
  var chatbotAudioPlaying = false;
  var chatbotWarmedUp = false;
  var chatbotTtsWarmedUp = false;

  function chatbotScrollToBottom(container) {
    if (!container) return;
    if (container.dataset.chatbotScrollPending === 'true') return;
    container.dataset.chatbotScrollPending = 'true';
    window.requestAnimationFrame(function() {
      container.dataset.chatbotScrollPending = 'false';
      container.scrollTop = container.scrollHeight;
    });
  }

  function chatbotEscapeHTML(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function chatbotModeMeta(mode) {
    var meta = chatbotLocale().modeMeta;
    return meta[mode] || meta.talk;
  }

  function chatbotDetectVoiceOutputCommand(text) {
    if (!text) return null;
    var normalized = String(text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    var wantsOn = (
      /(^|\b)(zapni|zapnout|zapnete|aktivuj|aktivovat|povol|povolit|mluv|odpovidej)(\b|$)/.test(normalized) &&
      /(hlas|hlasovy|hlasove|nahlas|voice|speech)/.test(normalized)
    ) || /odpovidej mi prosim hlasem/.test(normalized);

    var wantsOff = (
      /(^|\b)(vypni|vypnout|vypnete|zrus|zrusit|stopni|zastav)(\b|$)/.test(normalized) &&
      /(hlas|hlasovy|hlasove|nahlas|voice|speech)/.test(normalized)
    );

    if (wantsOn) return 'on';
    if (wantsOff) return 'off';
    return null;
  }

  function chatbotReadVoiceOutputPreference() {
    if (!CHATBOT_CAN_SPEAK) return false;
    try {
      return window.localStorage.getItem(CHATBOT_VOICE_OUTPUT_KEY) === 'on';
    } catch (err) {
      return false;
    }
  }

  function chatbotPersistVoiceOutputPreference(enabled) {
    try {
      window.localStorage.setItem(CHATBOT_VOICE_OUTPUT_KEY, enabled ? 'on' : 'off');
    } catch (err) {
      // ignore storage failures
    }
  }

  function chatbotMakeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
  }

  function chatbotStorageGet(store, key) {
    try { return store.getItem(key); } catch (err) { return null; }
  }

  function chatbotStorageSet(store, key, value) {
    try { store.setItem(key, value); return true; } catch (err) { return false; }
  }

  function chatbotStorageRemove(store, key) {
    try { store.removeItem(key); } catch (err) { /* noop */ }
  }

  function chatbotGetSessionId() {
    if (chatbotState.sessionId) return chatbotState.sessionId;
    var existing = chatbotStorageGet(window.sessionStorage, CHATBOT_SESSION_ID_KEY);
    chatbotState.sessionId = existing || chatbotMakeId();
    chatbotStorageSet(window.sessionStorage, CHATBOT_SESSION_ID_KEY, chatbotState.sessionId);
    return chatbotState.sessionId;
  }

  function chatbotReadMemoryConsent() {
    return chatbotStorageGet(window.localStorage, CHATBOT_MEMORY_CONSENT_KEY) === 'yes';
  }

  function chatbotMemoryPromptAnswered() {
    return chatbotStorageGet(window.localStorage, CHATBOT_MEMORY_PROMPT_KEY) === 'yes';
  }

  function chatbotGetVisitorId(createIfMissing) {
    var existing = chatbotStorageGet(window.localStorage, CHATBOT_VISITOR_ID_KEY);
    if (existing || !createIfMissing) return existing || '';
    var next = chatbotMakeId();
    chatbotStorageSet(window.localStorage, CHATBOT_VISITOR_ID_KEY, next);
    return next;
  }

  function chatbotSetMemoryConsent(enabled) {
    chatbotState.memoryConsent = !!enabled;
    chatbotStorageSet(window.localStorage, CHATBOT_MEMORY_PROMPT_KEY, 'yes');
    chatbotStorageSet(window.localStorage, CHATBOT_MEMORY_CONSENT_KEY, enabled ? 'yes' : 'no');
    if (enabled) {
      chatbotState.visitorId = chatbotGetVisitorId(true);
    }
  }

  function chatbotGetTurnstileToken() {
    if (!window.lukasTurnstile || typeof window.lukasTurnstile.getToken !== 'function') {
      return Promise.resolve(null);
    }
    return window.lukasTurnstile.getToken().catch(function () { return null; });
  }

  function chatbotMemoryPayload() {
    var consent = chatbotState.memoryConsent === true;
    return {
      session_id: chatbotGetSessionId(),
      visitor_id: consent ? chatbotGetVisitorId(true) : null,
      memory_consent: consent
    };
  }

  function chatbotGuessSpeechLang(text) {
    if (!text) return chatbotState.preferredSpeechLang || 'cs-CZ';
    if (/[áčďéěíňóřšťúůýž]/i.test(text) || /\b(jsem|můžu|můžeš|ahoj|fotka|fotky|spolupráce|portfolio|chci|prosím|mluv|hlasem)\b/i.test(text)) {
      return 'cs-CZ';
    }
    if (/\b(hello|please|what|how|services|portfolio|pricing|agent|english|voice|speak|project)\b/i.test(text)) {
      return 'en-US';
    }
    return chatbotState.preferredSpeechLang || 'cs-CZ';
  }

  function chatbotBase64ToArrayBuffer(base64) {
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function chatbotInt16ToFloat32(int16Array) {
    var float32 = new Float32Array(int16Array.length);
    for (var i = 0; i < int16Array.length; i++) {
      float32[i] = int16Array[i] / 0x8000;
    }
    return float32;
  }

  function chatbotStopSpeech() {
    chatbotSpeechRequestId++;
    chatbotAudioQueue = [];
    chatbotAudioPlaying = false;
    if (chatbotNativeSpeech) {
      try {
        chatbotNativeSpeech.cancel();
      } catch (err) {
        // ignore native speech cancel failures
      }
    }
    if (chatbotPlaybackSource) {
      try {
        chatbotPlaybackSource.stop(0);
      } catch (err) {
        // ignore stop errors for already-ended sources
      }
      try {
        chatbotPlaybackSource.disconnect();
      } catch (err) {
        // ignore disconnect errors
      }
      chatbotPlaybackSource = null;
    }
  }

  function chatbotFindNativeVoice(lang) {
    if (!chatbotNativeSpeech || !chatbotNativeSpeech.getVoices) return null;
    var voices = chatbotNativeSpeech.getVoices() || [];
    if (!voices.length) return null;
    var requestedLang = String(lang || 'cs-CZ').toLowerCase();
    var langPrefix = requestedLang.slice(0, 2);
    var preferredNames = [
      'jakub', 'google cestina', 'microsoft czech', 'czech',
      'aria', 'guy', 'jenny', 'google us english', 'microsoft english'
    ];
    var bestVoice = null;
    var bestScore = -1;
    for (var i = 0; i < voices.length; i++) {
      var voice = voices[i];
      var voiceLang = String(voice.lang || '').toLowerCase();
      var voiceName = String(voice.name || '').toLowerCase();
      var score = 0;
      if (voiceLang === requestedLang) score += 80;
      if (voiceLang.slice(0, 2) === langPrefix) score += 45;
      if (voice.localService) score += 8;
      if (/natural|online|neural|enhanced|google|microsoft|apple/.test(voiceName)) score += 16;
      for (var j = 0; j < preferredNames.length; j++) {
        if (voiceName.indexOf(preferredNames[j]) !== -1) score += 22;
      }
      if (score > bestScore) {
        bestScore = score;
        bestVoice = voice;
      }
    }
    return bestScore > 0 ? bestVoice : null;
  }

  function chatbotSpeakNativeText(text, lang, requestId, interrupt) {
    if (!CHATBOT_CAN_NATIVE_SPEAK || !chatbotNativeSpeech || !text) return false;
    if (requestId !== chatbotSpeechRequestId) return false;

    try {
      if (interrupt) chatbotNativeSpeech.cancel();
      var utterance = new window.SpeechSynthesisUtterance(text);
      utterance.lang = lang || 'cs-CZ';
      utterance.rate = String(utterance.lang).toLowerCase().indexOf('en') === 0 ? 0.98 : 0.95;
      utterance.pitch = String(utterance.lang).toLowerCase().indexOf('en') === 0 ? 0.94 : 0.9;
      utterance.volume = 1;

      var voice = chatbotFindNativeVoice(utterance.lang);
      if (voice) utterance.voice = voice;

      chatbotNativeSpeech.speak(utterance);
      return true;
    } catch (err) {
      console.error('Native speech synthesis error:', err);
      return false;
    }
  }

  function chatbotUseNativeSpeechFirst() {
    return false;
  }

  function chatbotEnsurePlaybackContext() {
    if (!CHATBOT_CAN_SERVER_TTS) return null;
    if (!chatbotPlaybackCtx || chatbotPlaybackCtx.state === 'closed') {
      var AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      chatbotPlaybackCtx = new AudioContextCtor({ sampleRate: CHATBOT_TTS_SAMPLE_RATE });
    }
    if (chatbotPlaybackCtx.state === 'suspended') {
      return chatbotPlaybackCtx.resume().then(function() {
        return chatbotPlaybackCtx;
      });
    }
    return Promise.resolve(chatbotPlaybackCtx);
  }

  function chatbotWarmPlaybackContext() {
    if (!CHATBOT_CAN_SERVER_TTS) return;
    try {
      var ctxPromise = chatbotEnsurePlaybackContext();
      if (ctxPromise && ctxPromise.catch) ctxPromise.catch(function() {});
    } catch (err) {
      // Browser can still block audio context creation outside a user gesture.
    }
  }

  function chatbotPrewarmTts() {
    if (!CHATBOT_CAN_SERVER_TTS || chatbotTtsWarmedUp) return;
    chatbotTtsWarmedUp = true;
    try {
      fetch(CHATBOT_TTS_API_URL, { method: 'GET', cache: 'no-store' }).catch(function() {
        chatbotTtsWarmedUp = false;
      });
    } catch (err) {
      chatbotTtsWarmedUp = false;
    }
  }

  function chatbotPrepareSpeechOutput() {
    chatbotWarmPlaybackContext();
    chatbotPrewarmTts();
  }

  function chatbotRequestSpeechAudio(text, lang) {
    return fetch(CHATBOT_TTS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        lang: lang
      })
    })
    .then(function(res) {
      if (!res.ok) {
        return res.json().catch(function() { return {}; }).then(function(data) {
          throw new Error(data.error || 'TTS request failed (' + res.status + ')');
        });
      }
      return res.json();
    });
  }

  function chatbotSpeakAudioPayload(speech) {
    if (!speech || !speech.audio) return;
    chatbotStopSpeech();
    chatbotState.preferredSpeechLang = speech.lang || chatbotState.preferredSpeechLang || 'cs-CZ';
    var requestId = chatbotSpeechRequestId;
    chatbotPlaySpeechAudio(speech.audio, speech.sampleRate || CHATBOT_TTS_SAMPLE_RATE, requestId)
      .catch(function(err) {
        console.error('Chatbot inline TTS playback error:', err);
      });
  }

  function chatbotPlaySpeechAudio(base64Audio, sampleRate, requestId) {
    // Jednorázové přehrání (legacy). Queue varianta níže.
    return chatbotEnsurePlaybackContext().then(function(audioCtx) {
      if (!audioCtx || requestId !== chatbotSpeechRequestId) return;

      var arrayBuf = chatbotBase64ToArrayBuffer(base64Audio);
      var int16 = new Int16Array(arrayBuf);
      var float32 = chatbotInt16ToFloat32(int16);
      var audioBuffer = audioCtx.createBuffer(1, float32.length, sampleRate || CHATBOT_TTS_SAMPLE_RATE);
      var source = audioCtx.createBufferSource();

      audioBuffer.getChannelData(0).set(float32);
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = function() {
        if (chatbotPlaybackSource === source) {
          chatbotPlaybackSource = null;
        }
      };

      chatbotPlaybackSource = source;
      if (requestId === chatbotSpeechRequestId) {
        source.start(0);
      }
    });
  }

  function chatbotPlayQueuedBuffer(base64Audio, sampleRate, requestId) {
    return chatbotEnsurePlaybackContext().then(function(audioCtx) {
      if (!audioCtx || requestId !== chatbotSpeechRequestId) return;
      return new Promise(function(resolve) {
        try {
          var arrayBuf = chatbotBase64ToArrayBuffer(base64Audio);
          var int16 = new Int16Array(arrayBuf);
          var float32 = chatbotInt16ToFloat32(int16);
          var audioBuffer = audioCtx.createBuffer(1, float32.length, sampleRate || CHATBOT_TTS_SAMPLE_RATE);
          var source = audioCtx.createBufferSource();
          audioBuffer.getChannelData(0).set(float32);
          source.buffer = audioBuffer;
          source.connect(audioCtx.destination);
          source.onended = function() {
            if (chatbotPlaybackSource === source) chatbotPlaybackSource = null;
            resolve();
          };
          chatbotPlaybackSource = source;
          if (requestId === chatbotSpeechRequestId) {
            source.start(0);
          } else {
            resolve();
          }
        } catch (err) {
          console.error('Queued playback error:', err);
          resolve();
        }
      });
    });
  }

  function chatbotDrainAudioQueue() {
    if (chatbotAudioPlaying) return;
    var next = chatbotAudioQueue[0];
    if (!next) return;
    if (!next.ready) return; // čekáme než dorazí TTS
    chatbotAudioQueue.shift();
    if (next.requestId !== chatbotSpeechRequestId || !next.audio) {
      chatbotDrainAudioQueue();
      return;
    }
    chatbotAudioPlaying = true;
    chatbotPlayQueuedBuffer(next.audio, next.sampleRate, next.requestId)
      .catch(function(err) { console.error('Queue play error:', err); })
      .then(function() {
        chatbotAudioPlaying = false;
        chatbotDrainAudioQueue();
      });
  }

  function chatbotQueueSentenceSpeech(text, lang, requestId) {
    if (!CHATBOT_CAN_SPEAK || !text) return;
    if (chatbotUseNativeSpeechFirst() && chatbotSpeakNativeText(text, lang, requestId, false)) {
      return;
    }
    if (!CHATBOT_CAN_SERVER_TTS) return;
    // Placeholder, ať se pořadí vět zachová i kdyby druhý request dorazil dřív
    var slot = { audio: null, sampleRate: CHATBOT_TTS_SAMPLE_RATE, requestId: requestId, ready: false };
    chatbotAudioQueue.push(slot);

    chatbotRequestSpeechAudio(text, lang)
      .then(function(data) {
        if (requestId !== chatbotSpeechRequestId) return;
        if (data && data.audio) {
          slot.audio = data.audio;
          slot.sampleRate = data.sampleRate || CHATBOT_TTS_SAMPLE_RATE;
        }
        slot.ready = true;
        chatbotDrainAudioQueue();
      })
      .catch(function(err) {
        console.error('Chatbot TTS error:', err);
        chatbotShowVoiceOutputErrorOnce();
        slot.ready = true;
        slot.audio = null;
        chatbotDrainAudioQueue();
      });
  }

  function chatbotShowVoiceOutputErrorOnce() {
    if (chatbotState.voiceOutputErrorShown) return;
    chatbotState.voiceOutputErrorShown = true;
    var message = chatbotLocale().voiceGeminiUnavailable;
    chatbotState.messages.push({ role: 'assistant', content: message });
    chatbotRenderBubble(chatbotDOM.heroMessages, 'assistant', message);
    chatbotRenderBubble(chatbotDOM.messages, 'assistant', message);
  }

  function chatbotUpdateSpeechToggleButtons() {
    var locale = chatbotLocale();
    var enabled = chatbotState.voiceOutputEnabled;
    var unsupported = !CHATBOT_CAN_SPEAK;
    var heroLabel = unsupported ? locale.voiceOutputUnsupported : (enabled ? locale.voiceOutputOn : locale.voiceOutputOff);
    var widgetLabel = unsupported ? 'Voice N/A' : (enabled ? locale.voiceShortOn : locale.voiceShortOff);

    [chatbotDOM.heroSpeechToggle, chatbotDOM.widgetSpeechToggle].forEach(function(button, index) {
      if (!button) return;
      button.disabled = unsupported;
      button.setAttribute('data-speech-output', enabled ? 'on' : 'off');
      button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      button.textContent = index === 0 ? heroLabel : widgetLabel;
    });

    var tourBtn = document.getElementById('hero-tour-btn');
    if (tourBtn && locale.tour) {
      var tourLabel = tourBtn.querySelector('.agent-tour-launch-label');
      if (tourLabel) tourLabel.textContent = locale.tour.launch;
    }
  }

  function chatbotSetVoiceOutput(enabled, options) {
    if (!CHATBOT_CAN_SPEAK) {
      chatbotState.voiceOutputEnabled = false;
      chatbotUpdateSpeechToggleButtons();
      return;
    }

    chatbotState.voiceOutputEnabled = !!enabled;
    chatbotPersistVoiceOutputPreference(chatbotState.voiceOutputEnabled);
    chatbotUpdateSpeechToggleButtons();

    if (chatbotState.voiceOutputEnabled) {
      chatbotPrepareSpeechOutput();
    }

    if (!chatbotState.voiceOutputEnabled) {
      chatbotStopSpeech();
    }

    if (!options || !options.silent) {
      var locale = chatbotLocale();
      var confirmMessage = chatbotState.voiceOutputEnabled
        ? locale.voiceEnabledMessage
        : locale.voiceDisabledMessage;

      chatbotState.messages.push({ role: 'assistant', content: confirmMessage });
      chatbotRenderBubble(chatbotDOM.heroMessages, 'assistant', confirmMessage);
      chatbotRenderBubble(chatbotDOM.messages, 'assistant', confirmMessage);
      if (chatbotState.voiceOutputEnabled) {
        chatbotSpeakText(confirmMessage, confirmMessage);
      }
    }
  }

  function chatbotToggleVoiceOutput() {
    chatbotSetVoiceOutput(!chatbotState.voiceOutputEnabled);
  }

  function chatbotResolveVoiceDirective(action) {
    var actions = Array.isArray(action) ? action : (action ? [action] : []);
    for (var i = 0; i < actions.length; i++) {
      if (actions[i] && actions[i].type === 'voice_output') {
        return actions[i].target === 'off' ? 'off' : 'on';
      }
    }
    return null;
  }

  function chatbotSpeakText(text, langHint) {
    if (!CHATBOT_CAN_SPEAK || !chatbotState.voiceOutputEnabled || !text) return;
    if (window.aiVoice && window.aiVoice.state && window.aiVoice.state.status === 'active') return;

    var cleanText = String(text).replace(/\s+/g, ' ').trim();
    if (!cleanText) return;

    var lang = chatbotGuessSpeechLang(langHint || cleanText);
    chatbotState.preferredSpeechLang = lang;
    chatbotStopSpeech();

    var requestId = chatbotSpeechRequestId;
    chatbotQueueSentenceSpeech(cleanText, lang, requestId);
  }

  function chatbotSpeakStreamingSentence(sentence, langHint, requestId) {
    if (!CHATBOT_CAN_SPEAK || !chatbotState.voiceOutputEnabled || !sentence) return;
    if (window.aiVoice && window.aiVoice.state && window.aiVoice.state.status === 'active') return;
    var clean = String(sentence).replace(/\s+/g, ' ').trim();
    if (!clean || clean.length < 3) return;
    var lang = chatbotGuessSpeechLang(langHint || clean);
    chatbotState.preferredSpeechLang = lang;
    chatbotQueueSentenceSpeech(clean, lang, requestId);
  }

  function chatbotFindSpeechWordCut(text, min, max) {
    var limit = Math.min(text.length, max);
    var cut = limit;
    for (var i = limit - 1; i >= min; i--) {
      if (/\s/.test(text.charAt(i))) {
        cut = i + 1;
        break;
      }
    }
    return cut;
  }

  function chatbotExtractSpeechChunk(remainder, firstChunk) {
    var raw = String(remainder || '');
    var leading = raw.match(/^\s*/);
    var offset = leading ? leading[0].length : 0;
    var text = raw.slice(offset);
    if (!text) return null;

    var strongMin = firstChunk ? CHATBOT_TTS_FIRST_STRONG_MIN : CHATBOT_TTS_NEXT_STRONG_MIN;
    var softMin = firstChunk ? CHATBOT_TTS_FIRST_SOFT_MIN : CHATBOT_TTS_NEXT_SOFT_MIN;
    var hardMax = firstChunk ? CHATBOT_TTS_FIRST_HARD_MAX : CHATBOT_TTS_NEXT_HARD_MAX;
    var strongRe = new RegExp('^([\\s\\S]{' + strongMin + ',}?[.!?])(?=\\s|$)');
    var softRe = new RegExp('^([\\s\\S]{' + softMin + ',}?[,:;])(?=\\s|$)');
    var match = text.match(strongRe) || text.match(softRe);

    if (match && match[1]) {
      return {
        text: match[1].trim(),
        advance: offset + match[0].length
      };
    }

    if (text.length >= hardMax) {
      var cut = chatbotFindSpeechWordCut(text, Math.floor(hardMax * 0.55), hardMax);
      return {
        text: text.slice(0, cut).trim(),
        advance: offset + cut
      };
    }

    return null;
  }

  function chatbotSetMode(mode, syncReplies) {
    mode = chatbotNormalizeMode(mode);
    chatbotState.mode = mode;

    chatbotDOM.modeButtons.forEach(function(btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-agent-mode') === mode);
    });

    var meta = chatbotModeMeta(mode);
    var locale = chatbotLocale();
    if (chatbotDOM.heroModeBadge) chatbotDOM.heroModeBadge.textContent = locale.publicAssistantBadge;
    if (chatbotDOM.widgetModeBadge) chatbotDOM.widgetModeBadge.textContent = locale.widgetAssistantBadge;

    if (syncReplies !== false) {
      chatbotRenderQuickReplies(chatbotDOM.heroQuickReplies, meta.replies);
      chatbotRenderQuickReplies(chatbotDOM.quickReplies, meta.replies);
    }

    if (!chatbotState.messages.length) {
      chatbotRenderWorkbench(chatbotDefaultWorkbench(mode));
    }
  }

  function chatbotRenderWorkbench(workbench) {
    chatbotState.workbench = chatbotNormalizeWorkbench(workbench, chatbotState.mode, '');

    if (chatbotDOM.workbenchSummary) chatbotDOM.workbenchSummary.textContent = chatbotState.workbench.summary;
    if (chatbotDOM.workbenchIntent) chatbotDOM.workbenchIntent.textContent = chatbotState.workbench.intent;
    if (chatbotDOM.workbenchArtifactTitle) chatbotDOM.workbenchArtifactTitle.textContent = chatbotState.workbench.artifactTitle;
    if (chatbotDOM.workbenchArtifactBody) chatbotDOM.workbenchArtifactBody.textContent = chatbotState.workbench.artifactBody;

    if (chatbotDOM.workbenchSteps) {
      chatbotDOM.workbenchSteps.innerHTML = '';
      chatbotState.workbench.steps.forEach(function(step) {
        var li = document.createElement('li');
        li.className = 'agent-step-item';
        li.textContent = step;
        chatbotDOM.workbenchSteps.appendChild(li);
      });
    }

    if (chatbotDOM.workbenchCta) {
      chatbotDOM.workbenchCta.textContent = chatbotState.workbench.ctaLabel;
      chatbotDOM.workbenchCta.setAttribute('data-value', chatbotState.workbench.ctaValue);
    }
  }

  function chatbotRenderBubble(container, role, text) {
    if (!container) return;

    var time = new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
    var div = document.createElement('div');
    var isUser = role === 'user';

    div.className = 'chat-message mb-4 flex gap-2' + (isUser ? ' flex-row-reverse' : '');
    div.innerHTML =
      '<div class="message-avatar ' + (isUser ? 'bg-gradient-to-r from-blue-600 to-purple-600' : 'glass') + '">' + (isUser ? '\u{1F464}' : '\u{1F916}') + '</div>' +
      '<div class="flex flex-col ' + (isUser ? 'items-end' : 'items-start') + ' max-w-xs">' +
        '<div class="p-3 rounded-xl ' + (isUser ? 'bg-gradient-to-r from-blue-600 to-purple-600' : 'glass') + '">' + chatbotEscapeHTML(text) + '</div>' +
        '<div class="message-time">' + time + '</div>' +
      '</div>';

    container.appendChild(div);
    chatbotScrollToBottom(container);
  }

  function chatbotCreateAssistantStreamBubble(container) {
    if (!container) return null;
    var time = new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
    var wrap = document.createElement('div');
    wrap.className = 'chat-message mb-4 flex gap-2';

    var avatar = document.createElement('div');
    avatar.className = 'message-avatar glass';
    avatar.textContent = '\u{1F916}';

    var col = document.createElement('div');
    col.className = 'flex flex-col items-start max-w-xs';

    var bubble = document.createElement('div');
    bubble.className = 'p-3 rounded-xl glass chatbot-streaming-bubble chatbot-stream-pending';
    bubble.innerHTML = '<span class="typing-indicator-inline" aria-live="polite"><span></span><span></span><span></span></span>';

    var timeEl = document.createElement('div');
    timeEl.className = 'message-time';
    timeEl.textContent = time;

    col.appendChild(bubble);
    col.appendChild(timeEl);
    wrap.appendChild(avatar);
    wrap.appendChild(col);
    container.appendChild(wrap);
    chatbotScrollToBottom(container);
    return bubble;
  }

  function chatbotCreateStreamingBubbles() {
    var heroBubble = chatbotCreateAssistantStreamBubble(chatbotDOM.heroMessages);
    var widgetBubble = chatbotCreateAssistantStreamBubble(chatbotDOM.messages);
    var firstAppend = true;
    var queue = '';
    var displayed = '';
    var typing = false;

    function clearPending() {
      if (heroBubble) {
        heroBubble.classList.remove('chatbot-stream-pending');
        heroBubble.textContent = '';
      }
      if (widgetBubble) {
        widgetBubble.classList.remove('chatbot-stream-pending');
        widgetBubble.textContent = '';
      }
    }

    function paint() {
      if (heroBubble) heroBubble.textContent = displayed;
      if (widgetBubble) widgetBubble.textContent = displayed;
      chatbotScrollToBottom(chatbotDOM.heroMessages);
      chatbotScrollToBottom(chatbotDOM.messages);
    }

    function tick() {
      if (!queue.length) { typing = false; return; }
      typing = true;
      // Pomalý start (prvních 18 znaků), pak adaptive batching podle délky fronty
      var batch, delay;
      if (displayed.length < 18) {
        batch = 1;
        delay = 38;
      } else if (queue.length > 200) {
        batch = 3; delay = 10;
      } else if (queue.length > 80) {
        batch = 2; delay = 16;
      } else {
        batch = 1; delay = 26;
      }
      displayed += queue.slice(0, batch);
      queue = queue.slice(batch);
      paint();
      setTimeout(tick, delay);
    }

    return {
      append: function(text) {
        if (firstAppend) { clearPending(); firstAppend = false; }
        if (!text) return;
        queue += text;
        if (!typing) tick();
      },
      replace: function(text) {
        if (firstAppend) { clearPending(); firstAppend = false; }
        text = text || '';
        var current = displayed + queue;
        if (text === current) return;
        if (text.indexOf(displayed) === 0) {
          // Server nás dohnal, jen doplň zbytek do fronty a nech typewriter dotypovat
          queue = text.slice(displayed.length);
          if (!typing) tick();
        } else {
          // Úplně jiný text → zruš typing a nastav ihned
          queue = '';
          typing = false;
          displayed = text;
          paint();
        }
      }
    };
  }

  function chatbotShowTyping(container) {
    if (!container) return;
    var existing = container.querySelector('.chatbot-typing');
    if (existing) return;

    var div = document.createElement('div');
    div.className = 'chat-message mb-4 flex gap-2 chatbot-typing';
    div.innerHTML =
      '<div class="message-avatar glass">\u{1F916}</div>' +
      '<div class="glass rounded-xl typing-indicator" aria-live="polite" aria-label="' + chatbotEscapeHTML(chatbotText('chatbot.typing', 'Hybridní agent píše...')) + '">' +
        '<span></span><span></span><span></span>' +
      '</div>';

    container.appendChild(div);
    chatbotScrollToBottom(container);
  }

  function chatbotHideTyping(container) {
    if (!container) return;
    var typing = container.querySelector('.chatbot-typing');
    if (typing) typing.remove();
  }

  function chatbotRenderQuickReplies(container, replies) {
    if (!container) return;
    container.innerHTML = '';

    if (!replies || !replies.length) {
      container.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden');

    replies.forEach(function(reply) {
      var btn = document.createElement('button');
      btn.className = 'quick-reply-btn glass px-4 py-2 rounded-full text-sm mr-2 mb-2';
      btn.setAttribute('data-value', reply.value);
      btn.setAttribute('aria-label', chatbotText('chatbot.quickReplyLabel', 'Rychla odpoved') + ': ' + reply.text);
      btn.textContent = reply.text;
      btn.addEventListener('click', function() {
        chatbotHandleSend(reply.value);
      });
      container.appendChild(btn);
    });
  }

  function chatbotRemoveMemoryControls() {
    document.querySelectorAll('.chatbot-memory-card').forEach(function(el) {
      el.remove();
    });
  }

  function chatbotRenderMemoryMessage(text) {
    chatbotRenderBubble(chatbotDOM.heroMessages, 'assistant', text);
    chatbotRenderBubble(chatbotDOM.messages, 'assistant', text);
  }

  function chatbotDeleteMemoryProfile() {
    var visitorId = chatbotGetVisitorId(false);
    chatbotStorageRemove(window.localStorage, CHATBOT_MEMORY_CONSENT_KEY);
    chatbotStorageRemove(window.localStorage, CHATBOT_VISITOR_ID_KEY);
    chatbotStorageSet(window.localStorage, CHATBOT_MEMORY_PROMPT_KEY, 'yes');
    chatbotState.memoryConsent = false;
    chatbotState.visitorId = null;
    chatbotRemoveMemoryControls();

    if (visitorId) {
      fetch('/.netlify/functions/visitor-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          visitor_id: visitorId,
          _company_website: ''
        })
      }).catch(function() {});
    }

    chatbotRenderMemoryMessage(chatbotLanguage() === 'en'
      ? 'Done. I deleted the saved profile and will not remember this chat.'
      : 'Hotovo. Uložený profil jsem smazal a tuhle konverzaci si nebudu pamatovat.');
  }

  function chatbotHandleMemoryChoice(enabled) {
    chatbotSetMemoryConsent(enabled);
    chatbotRemoveMemoryControls();
    chatbotRenderMemoryMessage(enabled
      ? (chatbotLanguage() === 'en'
        ? 'Done. I will remember only a short summary so I can follow up next time.'
        : 'Hotovo. Budu si pamatovat jen krátký souhrn, abych příště líp navázal.')
      : (chatbotLanguage() === 'en'
        ? 'No problem. I will not save a visitor memory profile.'
        : 'V pohodě. Profil paměti ukládat nebudu.'));
  }

  function chatbotRenderMemoryCard(container) {
    if (!container) return;
    var old = container.querySelector('.chatbot-memory-card');
    if (old) old.remove();

    var isEn = chatbotLanguage() === 'en';
    if (!chatbotState.memoryConsent && chatbotMemoryPromptAnswered()) return;

    var card = document.createElement('div');
    card.className = 'chatbot-memory-card glass rounded-xl p-3 mb-4 text-sm';
    card.style.cssText = 'display:flex;flex-direction:column;gap:10px;border:1px solid rgba(255,255,255,0.14);';

    var text = document.createElement('div');
    text.className = 'text-white/80';
    text.textContent = chatbotState.memoryConsent
      ? (isEn ? 'Memory is on. I store only a short summary, not the full transcript.' : 'Paměť je zapnutá. Ukládám jen krátký souhrn, ne celý přepis.')
      : (isEn ? 'Can I remember a short summary for next time? You can delete it anytime.' : 'Můžu si příště pamatovat krátký souhrn? Smažeš ho kdykoliv jedním klikem.');
    card.appendChild(text);

    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';

    if (chatbotState.memoryConsent) {
      var deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'quick-reply-btn glass px-3 py-2 rounded-full text-xs';
      deleteBtn.textContent = isEn ? 'Delete profile' : 'Smazat profil';
      deleteBtn.addEventListener('click', chatbotDeleteMemoryProfile);
      actions.appendChild(deleteBtn);
    } else {
      var yesBtn = document.createElement('button');
      yesBtn.type = 'button';
      yesBtn.className = 'quick-reply-btn glass px-3 py-2 rounded-full text-xs';
      yesBtn.textContent = isEn ? 'Remember me' : 'Pamatovat si mě';
      yesBtn.addEventListener('click', function() { chatbotHandleMemoryChoice(true); });

      var noBtn = document.createElement('button');
      noBtn.type = 'button';
      noBtn.className = 'quick-reply-btn glass px-3 py-2 rounded-full text-xs';
      noBtn.textContent = isEn ? 'Not now' : 'Ne teď';
      noBtn.addEventListener('click', function() { chatbotHandleMemoryChoice(false); });
      actions.appendChild(yesBtn);
      actions.appendChild(noBtn);
    }

    card.appendChild(actions);
    container.appendChild(card);
    chatbotScrollToBottom(container);
  }

  function chatbotMaybeRenderMemoryControls() {
    chatbotRenderMemoryCard(chatbotDOM.heroMessages);
    chatbotRenderMemoryCard(chatbotDOM.messages);
  }

  function chatbotNormalizeGalleryCategory(category) {
    var value = String(category || '').toLowerCase();
    if (value === 'all' || value === 'vse' || value === 'vše') return 'all';
    if (value === 'ai') return 'ai';
    return 'foto';
  }

  var CHATBOT_PROJECT_LINKS = {
    'sport-12': '/galerie/prerov-vs-velka-bystrice/'
  };

  function chatbotApplyPortfolioFilter(category) {
    var filter = chatbotNormalizeGalleryCategory(category);
    var buttons = document.querySelectorAll('.filter-btn, [data-filter]');
    buttons.forEach(function(btn) {
      var isActive = btn.getAttribute('data-filter') === filter;
      btn.classList.toggle('active', isActive);
      if (isActive && typeof btn.click === 'function') {
        btn.click();
      }
    });

    document.querySelectorAll('.portfolio-item').forEach(function(item) {
      var itemCategory = item.getAttribute('data-category') || '';
      item.style.display = (filter === 'all' || itemCategory === filter) ? 'block' : 'none';
    });

    var portfolio = document.getElementById('portfolio');
    if (portfolio) portfolio.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var grid = document.getElementById('portfolioGrid') || document.getElementById('portfolio-grid') || portfolio;
    if (grid) {
      grid.classList.add('ai-highlight');
      setTimeout(function() { grid.classList.remove('ai-highlight'); }, 2400);
    }
  }

  function chatbotOpenPortfolioProject(projectId) {
    var safeId = String(projectId || '').replace(/[^a-z0-9_-]/gi, '');
    if (!safeId) return;

    var portfolio = document.getElementById('portfolio');
    if (portfolio) portfolio.scrollIntoView({ behavior: 'smooth', block: 'start' });

    var card = document.querySelector('[data-project-id="' + safeId + '"]');
    if (card) {
      card.classList.add('ai-highlight');
      setTimeout(function() { card.classList.remove('ai-highlight'); }, 2400);

      var directLink = card.getAttribute('href') || card.getAttribute('data-project-link');
      if (directLink) {
        setTimeout(function() { window.location.href = directLink; }, 650);
        return;
      }

      if (typeof card.click === 'function') {
        setTimeout(function() { card.click(); }, 650);
        return;
      }
    }

    if (CHATBOT_PROJECT_LINKS[safeId]) {
      setTimeout(function() { window.location.href = CHATBOT_PROJECT_LINKS[safeId]; }, 650);
    }
  }

  var CHATBOT_SECTION_TARGETS = {
    'portfolio': {
      selectors: ['#portfolio'],
      highlight: 'portfolio-grid',
      block: 'start'
    },
    'skills': {
      selectors: ['#skills'],
      highlight: 'skills-grid',
      block: 'start'
    },
    'o-mne': {
      selectors: ['#o-mne'],
      highlight: '#o-mne',
      block: 'start'
    },
    'spoluprace': {
      selectors: ['#spoluprace'],
      highlight: '#spoluprace',
      block: 'start'
    },
    'kontakt': {
      selectors: ['#kontakt'],
      highlight: 'contact-form',
      block: 'start'
    },
    'hybridni-agent': {
      selectors: ['#hybridni-agent'],
      highlight: '#hybridni-agent',
      block: 'start'
    },
    'contact-form': {
      selectors: ['#contactForm', '#contact-form', 'form[name="contact"]'],
      highlight: 'contact-form',
      block: 'center'
    },
    'pricing': {
      selectors: ['#pricing', '[data-section="pricing"]', '#spoluprace'],
      highlight: 'pricing',
      block: 'start'
    }
  };

  var CHATBOT_SECTION_ALIASES = {
    'portfolio': 'portfolio',
    'portfolia': 'portfolio',
    'portfoliu': 'portfolio',
    'portfoliem': 'portfolio',
    'galerie': 'portfolio',
    'fotogalerie': 'portfolio',
    'fotky': 'portfolio',
    'fotografie': 'portfolio',
    'portfolio-grid': 'portfolio',
    'portfoliogrid': 'portfolio',
    'skills': 'skills',
    'dovednosti': 'skills',
    'dovednostech': 'skills',
    'schopnosti': 'skills',
    'schopnostech': 'skills',
    'skills-grid': 'skills',
    'skillsgrid': 'skills',
    'o-mne': 'o-mne',
    'omne': 'o-mne',
    'about': 'o-mne',
    'lukas': 'o-mne',
    'spoluprace': 'spoluprace',
    'spolupraci': 'spoluprace',
    'sluzby': 'spoluprace',
    'sluzbach': 'spoluprace',
    'sluzbami': 'spoluprace',
    'sluzeb': 'spoluprace',
    'kontakt': 'kontakt',
    'kontaktu': 'kontakt',
    'contact': 'kontakt',
    'formular': 'contact-form',
    'formulare': 'contact-form',
    'contactform': 'contact-form',
    'contact-form': 'contact-form',
    'cenik': 'pricing',
    'ceny': 'pricing',
    'pricing': 'pricing',
    'agent': 'hybridni-agent',
    'chat': 'hybridni-agent',
    'chatbot': 'hybridni-agent',
    'ai': 'hybridni-agent',
    'lukas-ai': 'hybridni-agent',
    'lukasai': 'hybridni-agent',
    'hybridni-agent': 'hybridni-agent',
    'hybridniagent': 'hybridni-agent'
  };

  var CHATBOT_HIGHLIGHT_TARGETS = {
    'pricing': '#pricing, [data-section="pricing"], #spoluprace',
    'portfolio-grid': '#portfolioGrid, #portfolio-grid, #portfolio',
    'portfolio': '#portfolioGrid, #portfolio-grid, #portfolio',
    'contact-form': '#contactForm, #contact-form, form[name="contact"]',
    'kontakt': '#contactForm, #contact-form, form[name="contact"], #kontakt',
    'skills-grid': '#skills-grid, #skills',
    'skills': '#skills-grid, #skills',
    'showreel': '#showreel',
    'spoluprace': '#spoluprace',
    'o-mne': '#o-mne',
    'hybridni-agent': '#hybridni-agent'
  };

  // ===== Site Adapter (FrameMind) =====
  // Jediné místo, kde žijí site-specifická fakta tohoto webu.
  // Engine (resolver/runAction) sahá výhradně sem — nikdy ne na selektory napřímo.
  // Drop na jiný web = přepojit hodnoty tady, engine se nemění.
  var CHATBOT_SITE_MANIFEST = {
    sectionTargets: CHATBOT_SECTION_TARGETS,
    sectionAliases: CHATBOT_SECTION_ALIASES,
    highlightTargets: CHATBOT_HIGHLIGHT_TARGETS,
    projectLinks: CHATBOT_PROJECT_LINKS,
    serviceCardSelector: function (service) {
      return '[data-service="' + String(service || '').replace(/"/g, '') + '"]';
    },
    contactStatusId: 'contactStatus',
    portfolioStatsId: 'portfolio-stats',
    availabilityId: 'availability',
    latestProjectId: 'sport-12'
  };

  function chatbotNormalizeTargetKey(value) {
    return String(value || '')
      .replace(/^#/, '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function chatbotResolveSectionKey(target) {
    var key = chatbotNormalizeTargetKey(target);
    if (!key) return '';
    if (CHATBOT_SECTION_TARGETS[key]) return key;
    if (CHATBOT_SECTION_ALIASES[key]) return CHATBOT_SECTION_ALIASES[key];
    var compact = key.replace(/-/g, '');
    if (CHATBOT_SECTION_ALIASES[compact]) return CHATBOT_SECTION_ALIASES[compact];
    return key;
  }

  function chatbotFindBySelectors(selectors) {
    if (!Array.isArray(selectors)) return null;
    for (var i = 0; i < selectors.length; i += 1) {
      try {
        var el = document.querySelector(selectors[i]);
        if (el) return el;
      } catch (e) {}
    }
    return null;
  }

  function chatbotScrollElement(el, block) {
    if (!el) return false;
    var behavior = 'smooth';
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        behavior = 'auto';
      }
    } catch (e) {}
    var options = { behavior: behavior, block: block || 'start', inline: 'nearest' };
    try {
      el.scrollIntoView(options);
    } catch (e) {
      el.scrollIntoView(true);
    }
    setTimeout(function() {
      try { el.scrollIntoView(options); } catch (e) {}
    }, 450);
    return true;
  }

  function chatbotResolveHighlightSelector(target) {
    var raw = String(target || '').trim();
    if (!raw) return '';
    var key = chatbotNormalizeTargetKey(raw);
    return CHATBOT_HIGHLIGHT_TARGETS[raw] || CHATBOT_HIGHLIGHT_TARGETS[key] || raw;
  }

  function chatbotHighlightSelector(target) {
    var selector = chatbotResolveHighlightSelector(target);
    if (!selector) return false;
    var el = null;
    try { el = document.querySelector(selector); } catch (e) {}
    if (!el && selector.indexOf(',') === -1) {
      el = document.getElementById(selector.replace(/^#/, ''));
    }
    if (!el) return false;
    el.classList.add('ai-highlight');
    setTimeout(function() { el.classList.remove('ai-highlight'); }, 3000);
    return true;
  }

  function chatbotScrollToSection(target, options) {
    var settings = options || {};
    var raw = String(target || '').trim();
    var key = chatbotResolveSectionKey(raw);
    var config = CHATBOT_SECTION_TARGETS[key];
    var el = config ? chatbotFindBySelectors(config.selectors) : null;

    if (!el && raw) {
      var id = raw.replace(/^#/, '');
      el = document.getElementById(id) || document.getElementById(chatbotNormalizeTargetKey(raw));
    }
    if (!el) return false;

    chatbotScrollElement(el, settings.block || (config && config.block) || 'start');

    var highlight = settings.highlightSelector || (config && config.highlight);
    if (settings.highlight !== false && highlight) {
      setTimeout(function() { chatbotHighlightSelector(highlight); }, 480);
    }
    return true;
  }

  function chatbotExecuteAction(action) {
    if (!action || !action.type) return;

    switch (action.type) {
      case 'scroll':
        chatbotScrollToSection(action.target);
        break;
      case 'filter':
        chatbotApplyPortfolioFilter(action.target);
        break;
      case 'highlight':
        chatbotHighlightSelector(action.target);
        break;
      case 'project':
        chatbotOpenPortfolioProject(action.target);
        break;
    }
  }

  function chatbotPostAgentForm(subject, fields) {
    // Netlify Forms: URL-encoded body, form-name field required
    var params = new URLSearchParams();
    params.append('form-name', CHATBOT_AGENT_FORM_NAME);
    params.append('_subject', subject);
    Object.keys(fields || {}).forEach(function(key) {
      if (fields[key] === undefined || fields[key] === null || fields[key] === '') return;
      var value = typeof fields[key] === 'object' ? JSON.stringify(fields[key], null, 2) : String(fields[key]);
      params.append(key, value);
    });
    return fetch(CHATBOT_AGENT_FORM_URL, {
      method: 'POST',
      body: params.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }).catch(function(err) {
      console.warn('Agent form action failed:', err);
    });
  }

  // ===== Engine: resolver (čistý, bez side-efektů) =====
  // Z tool+args vrátí cílový DOM prvek pomocí Site Adapteru. Nic nemění.
  // Slouží pilíři 1 (ghost kurzor) — kam má kurzor najet a co rozsvítit.
  function chatbotManifestSectionEl(sectionKey) {
    var key = chatbotResolveSectionKey(sectionKey);
    var config = CHATBOT_SITE_MANIFEST.sectionTargets[key];
    return config ? chatbotFindBySelectors(config.selectors) : null;
  }

  function chatbotQuerySafe(selector) {
    if (!selector) return null;
    try { return document.querySelector(selector); } catch (e) { return null; }
  }

  function chatbotResolveTarget(tool, args) {
    args = args || {};
    var M = CHATBOT_SITE_MANIFEST;
    switch (tool) {
      case 'scroll_to':
        return chatbotManifestSectionEl(args.section);
      case 'highlight_element':
        return chatbotQuerySafe(chatbotResolveHighlightSelector(args.target));
      case 'filter_gallery':
        return chatbotManifestSectionEl('portfolio');
      case 'show_pricing':
      case 'compare_services':
        return chatbotQuerySafe(M.highlightTargets.pricing);
      case 'prefill_contact_form':
      case 'send_inquiry':
        return chatbotQuerySafe(M.highlightTargets['contact-form']);
      case 'show_project_detail':
        return chatbotQuerySafe('[data-project-id="' + String(args.project_id || '').replace(/[^a-z0-9_-]/gi, '') + '"]')
          || chatbotManifestSectionEl('portfolio');
      case 'open_lightbox':
        return chatbotQuerySafe('[data-image-id="' + String(args.image_id || '').replace(/"/g, '') + '"]');
      case 'compare_before_after':
        return chatbotQuerySafe('[data-before-after="' + String(args.image_id || '').replace(/"/g, '') + '"]');
      case 'play_showreel':
        return chatbotQuerySafe(M.highlightTargets.showreel);
      case 'show_portfolio_stats':
        return document.getElementById(M.portfolioStatsId) || chatbotManifestSectionEl('portfolio');
      case 'check_availability':
        return document.getElementById(M.availabilityId) || chatbotManifestSectionEl('kontakt');
      default:
        return null;
    }
  }

  var CHATBOT_TOOL_HANDLERS = {
    scroll_to: function(args) {
      chatbotScrollToSection(args.section);
    },
    highlight_element: function(args) {
      chatbotHighlightSelector(args.target);
    },
    toggle_theme: function(args) {
      var mode = args && args.mode;
      var root = document.documentElement;
      if (mode === 'toggle' && typeof window.ldToggleTheme === 'function') {
        window.ldToggleTheme();
        return;
      }
      if ((mode === 'light' || mode === 'dark') && typeof window.ldApplyTheme === 'function') {
        window.ldApplyTheme(mode);
        return;
      }
      var useLight = mode === 'light' || (mode !== 'dark' && !root.classList.contains('theme-light'));
      root.classList.toggle('theme-light', useLight);
      try { localStorage.setItem('ld_theme', useLight ? 'light' : 'dark'); } catch (e) {}
      var icon = useLight ? '🌙' : '☀️';
      var desktop = document.getElementById('themeToggle');
      var mobile = document.getElementById('themeToggleMobile');
      if (desktop) desktop.textContent = icon;
      if (mobile) mobile.textContent = icon;
    },
    open_lightbox: function(args) {
      var img = document.querySelector('[data-image-id="' + (args.image_id || '').replace(/"/g,'') + '"], #' + (args.image_id || '').replace(/[^a-z0-9_-]/gi,''));
      if (img && typeof img.click === 'function') img.click();
    },
    play_showreel: function() {
      var video = document.getElementById('showreel') || document.querySelector('video[data-showreel]');
      if (video && typeof video.play === 'function') {
        chatbotScrollElement(video, 'center');
        video.play().catch(function() {});
      }
    },
    filter_gallery: function(args) {
      chatbotApplyPortfolioFilter(args.category);
    },
    show_project_detail: function(args) {
      chatbotOpenPortfolioProject(args.project_id);
    },
    compare_before_after: function(args) {
      var slider = document.querySelector('[data-before-after="' + (args.image_id || '').replace(/"/g,'') + '"]');
      if (slider) slider.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    show_portfolio_stats: function() {
      var stats = document.getElementById('portfolio-stats');
      if (stats) {
        chatbotScrollElement(stats, 'center');
      } else {
        chatbotScrollToSection('portfolio');
      }
    },
    prefill_contact_form: function(args) {
      chatbotPrefillContactForm(args, {
        status: 'Formulář je předvyplněný. Zkontrolujte údaje a potvrďte odeslání.'
      });
    },
    send_inquiry: function(args) {
      chatbotPrefillContactForm(args, { status: 'Odesílám poptávku přes Hybridního agenta...' });
      chatbotPostAgentForm('Poptavka z Lukas AI agenta', {
        type: 'send_inquiry',
        name: args.name,
        email: args.email,
        phone: args.phone,
        service: args.service,
        message: args.message
      }).then(function(response) {
        var status = document.getElementById('contactStatus');
        if (!status) return;
        status.textContent = response && response.ok
          ? 'Poptávka byla odeslána Lukášovi.'
          : 'Odeslání se nepodařilo. Zkontrolujte formulář a odešlete ho ručně.';
      });
    },
    request_callback: function(args) {
      chatbotPostAgentForm('Zadost o zpetny kontakt z Lukas AI', {
        type: 'request_callback',
        name: args.name,
        phone: args.phone,
        time_window: args.time_window,
        topic: args.topic
      });
    },
    subscribe_newsletter: function(args) {
      chatbotPostAgentForm('Newsletter signup z Lukas AI', {
        type: 'subscribe_newsletter',
        email: args.email
      });
    },
    book_consultation: function(args) {
      chatbotPostAgentForm('Zadost o konzultaci z Lukas AI', {
        type: 'book_consultation',
        name: args.name,
        email: args.email,
        date: args.date,
        time: args.time,
        topic: args.topic
      });
    },
    send_brief_to_email: function(args) {
      chatbotPostAgentForm('Projektovy brief z Lukas AI', {
        type: 'send_brief_to_email',
        name: args.name,
        email: args.email,
        brief: args.brief
      });
    },
    recommend_service: function() {},
    generate_quote_estimate: function() {},
    create_project_brief: function() {},
    show_pricing: function(args) {
      chatbotScrollToSection('pricing');
      if (args && args.service) {
        var card = document.querySelector('[data-service="' + args.service + '"]');
        if (card) {
          card.classList.add('ai-highlight');
          setTimeout(function() { card.classList.remove('ai-highlight'); }, 3000);
        }
      }
    },
    compare_services: function(args) {
      chatbotScrollToSection('pricing', { highlight: false });
      [args.service_a, args.service_b].forEach(function(svc) {
        if (!svc) return;
        var card = document.querySelector('[data-service="' + svc + '"]');
        if (card) {
          card.classList.add('ai-highlight');
          setTimeout(function() { card.classList.remove('ai-highlight'); }, 3500);
        }
      });
    },
    check_availability: function() {
      var avail = document.getElementById('availability') || document.getElementById('kontakt');
      if (avail) {
        chatbotScrollElement(avail, 'center');
      } else {
        chatbotScrollToSection('kontakt');
      }
    }
  };

  function chatbotExecuteToolCall(action) {
    if (!action || typeof action.tool !== 'string') return;
    var handler = CHATBOT_TOOL_HANDLERS[action.tool];
    if (typeof handler !== 'function') return;
    try { handler(action.args || {}); } catch (err) { console.warn('Tool handler error:', action.tool, err); }
  }

  function chatbotExecuteActions(actions) {
    if (!Array.isArray(actions) || actions.length === 0) return;
    actions.forEach(function(action, idx) {
      setTimeout(function() { chatbotExecuteToolCall(action); }, idx * 220);
    });
  }

  // ===== Živá ukázka — agent-driven tour =====
  var CHATBOT_TOUR_API_URL = '/.netlify/functions/tour';
  var chatbotTourActive = false;
  var chatbotTourAborted = false;
  var chatbotTourTimer = null;
  var chatbotTourStyleInjected = false;

  var CHATBOT_TOUR_FALLBACK = {
    cs: [
      { say: 'Ráda vám naživo ukážu, co tenhle hybridní agent zvládne.', tool: 'scroll_to', args: { section: 'hybridni-agent' } },
      { say: 'Tohle je hybridní agent — mluví a zároveň sám ovládá celý web.', tool: 'highlight_element', args: { target: 'skills-grid' } },
      { say: 'Takhle bych vašim klientům ukázala portfolio.', tool: 'filter_gallery', args: { category: 'all' } },
      { say: 'A čísla, která budují důvěru.', tool: 'show_portfolio_stats', args: {} },
      { say: 'A takhle nezávazně chytnete poptávku.', tool: 'scroll_to', args: { section: 'kontakt' } },
      { say: 'Formulář jsem pro ukázku rovnou předvyplnila.', tool: 'prefill_contact_form', args: { name: 'Ukázková firma', email: 'ukazka@vase-firma.cz', service: 'ai-agent-na-miru', message: 'Chceme na web hybridního agenta jako tenhle.' } }
    ],
    en: [
      { say: 'Let me show you live what this hybrid agent can do.', tool: 'scroll_to', args: { section: 'hybridni-agent' } },
      { say: 'This is the hybrid agent — it talks and drives the whole site itself.', tool: 'highlight_element', args: { target: 'skills-grid' } },
      { say: 'This is how I would show your clients the portfolio.', tool: 'filter_gallery', args: { category: 'all' } },
      { say: 'And the numbers that build trust.', tool: 'show_portfolio_stats', args: {} },
      { say: 'And this is how you capture a lead, no pressure.', tool: 'scroll_to', args: { section: 'kontakt' } },
      { say: 'I pre-filled the contact form for the demo.', tool: 'prefill_contact_form', args: { name: 'Demo Company', email: 'demo@your-company.com', service: 'ai-agent-na-miru', message: 'We want a hybrid agent like this on our site.' } }
    ]
  };

  function chatbotTourLang() { return chatbotLanguage() === 'en' ? 'en' : 'cs'; }
  function chatbotTourStrings() { return chatbotLocale().tour; }
  function chatbotTourFallback(lang) { return CHATBOT_TOUR_FALLBACK[lang] || CHATBOT_TOUR_FALLBACK.cs; }

  function chatbotTourEnsureStyle() {
    if (chatbotTourStyleInjected) return;
    chatbotTourStyleInjected = true;
    var css = [
      '.agent-tour-launch{display:inline-flex;align-items:center;gap:.4rem;padding:.35rem .8rem;border-radius:999px;font-size:.8rem;font-weight:700;color:#fff;border:1px solid rgba(255,255,255,.18);background:linear-gradient(90deg,#2563eb,#7c3aed);cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,opacity .15s}',
      '.agent-tour-launch:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(124,58,237,.35)}',
      '.agent-tour-launch:disabled{opacity:.5;cursor:default;transform:none;box-shadow:none}',
      '.agent-tour-launch>span:first-child{font-size:.62rem;line-height:1}',
      '.chatbot-tour-overlay{position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:rgba(5,6,15,.72);backdrop-filter:blur(6px);padding:1rem}',
      '.chatbot-tour-card{max-width:30rem;width:100%;background:rgba(17,18,32,.96);border:1px solid rgba(255,255,255,.12);border-radius:1.25rem;padding:1.5rem;color:#fff;box-shadow:0 24px 60px rgba(0,0,0,.5)}',
      '.chatbot-tour-card h4{font-size:1.15rem;font-weight:800;margin:0 0 .35rem}',
      '.chatbot-tour-card p{font-size:.85rem;color:rgba(255,255,255,.6);margin:0 0 1rem}',
      '.chatbot-tour-chips{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem}',
      '.chatbot-tour-chip{flex:1 1 calc(50% - .5rem);padding:.7rem .6rem;border-radius:.85rem;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:#fff;font-weight:600;font-size:.9rem;cursor:pointer;transition:background .15s,border-color .15s}',
      '.chatbot-tour-chip:hover{background:linear-gradient(90deg,rgba(37,99,235,.3),rgba(124,58,237,.3));border-color:rgba(124,58,237,.6)}',
      '.chatbot-tour-cancel{display:block;margin:0 auto;background:none;border:none;color:rgba(255,255,255,.5);font-size:.8rem;cursor:pointer;padding:.3rem}',
      '.chatbot-tour-hud{position:fixed;left:50%;bottom:1.1rem;transform:translateX(-50%);z-index:9999;width:min(40rem,calc(100vw - 1.5rem));background:rgba(17,18,32,.97);border:1px solid rgba(124,58,237,.4);border-radius:1.1rem;padding:.85rem 1rem;color:#fff;box-shadow:0 16px 44px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:.55rem;animation:chatbotTourIn .25s ease}',
      '@keyframes chatbotTourIn{from{opacity:0}to{opacity:1}}',
      '.chatbot-tour-hud-top{display:flex;align-items:center;gap:.6rem}',
      '.chatbot-tour-badge{display:inline-flex;align-items:center;gap:.4rem;font-size:.65rem;font-weight:800;letter-spacing:.08em;color:#c4b5fd;white-space:nowrap}',
      '.chatbot-tour-badge .dot{width:.5rem;height:.5rem;border-radius:50%;background:#a855f7;animation:chatbotTourPulse 1s infinite}',
      '@keyframes chatbotTourPulse{0%,100%{opacity:1}50%{opacity:.3}}',
      '.chatbot-tour-dots{display:flex;gap:.3rem;flex:1;flex-wrap:wrap}',
      '.chatbot-tour-dots i{width:.45rem;height:.45rem;border-radius:50%;background:rgba(255,255,255,.2)}',
      '.chatbot-tour-dots i.on{background:linear-gradient(90deg,#2563eb,#7c3aed)}',
      '.chatbot-tour-btn{padding:.3rem .7rem;border-radius:.6rem;font-size:.78rem;font-weight:700;cursor:pointer;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff}',
      '.chatbot-tour-btn.stop{background:rgba(239,68,68,.18);border-color:rgba(239,68,68,.5)}',
      '.chatbot-tour-caption{font-size:.95rem;line-height:1.4;font-weight:500}'
    ].join('');
    var style = document.createElement('style');
    style.id = 'chatbot-tour-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function chatbotTourClosePicker() {
    var ov = document.getElementById('chatbot-tour-overlay');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }

  function chatbotTourOpenPicker() {
    if (chatbotTourActive) return;
    chatbotTourEnsureStyle();
    chatbotTourClosePicker();
    var t = chatbotTourStrings();
    var ov = document.createElement('div');
    ov.className = 'chatbot-tour-overlay';
    ov.id = 'chatbot-tour-overlay';
    var card = document.createElement('div');
    card.className = 'chatbot-tour-card';
    var h = document.createElement('h4'); h.textContent = t.pickTitle;
    var p = document.createElement('p'); p.textContent = t.pickHint;
    var chips = document.createElement('div'); chips.className = 'chatbot-tour-chips';
    t.fields.forEach(function(f) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chatbot-tour-chip'; b.textContent = f.label;
      b.addEventListener('click', function() { chatbotTourStart(f.value); });
      chips.appendChild(b);
    });
    var cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'chatbot-tour-cancel'; cancel.textContent = t.cancel;
    cancel.addEventListener('click', chatbotTourClosePicker);
    card.appendChild(h); card.appendChild(p); card.appendChild(chips); card.appendChild(cancel);
    ov.appendChild(card);
    ov.addEventListener('click', function(e) { if (e.target === ov) chatbotTourClosePicker(); });
    document.body.appendChild(ov);
  }

  function chatbotTourRemoveHud() {
    var h = document.getElementById('chatbot-tour-hud');
    if (h && h.parentNode) h.parentNode.removeChild(h);
  }

  function chatbotTourRenderHud() {
    chatbotTourRemoveHud();
    var t = chatbotTourStrings();
    var hud = document.createElement('div'); hud.className = 'chatbot-tour-hud'; hud.id = 'chatbot-tour-hud';
    var top = document.createElement('div'); top.className = 'chatbot-tour-hud-top';
    var badge = document.createElement('span'); badge.className = 'chatbot-tour-badge';
    var dot = document.createElement('span'); dot.className = 'dot';
    var blabel = document.createElement('span'); blabel.textContent = t.badge;
    badge.appendChild(dot); badge.appendChild(blabel);
    var dots = document.createElement('div'); dots.className = 'chatbot-tour-dots'; dots.id = 'chatbot-tour-dots';
    var skip = document.createElement('button'); skip.type = 'button'; skip.className = 'chatbot-tour-btn'; skip.textContent = t.skip;
    skip.addEventListener('click', chatbotTourSkip);
    var stop = document.createElement('button'); stop.type = 'button'; stop.className = 'chatbot-tour-btn stop'; stop.textContent = t.stop;
    stop.addEventListener('click', chatbotTourStop);
    top.appendChild(badge); top.appendChild(dots); top.appendChild(skip); top.appendChild(stop);
    var cap = document.createElement('div'); cap.className = 'chatbot-tour-caption'; cap.id = 'chatbot-tour-caption';
    hud.appendChild(top); hud.appendChild(cap);
    document.body.appendChild(hud);
  }

  function chatbotTourUpdateHud(idx, total, caption) {
    var cap = document.getElementById('chatbot-tour-caption');
    if (cap) cap.textContent = caption || '';
    var dots = document.getElementById('chatbot-tour-dots');
    if (dots) {
      dots.innerHTML = '';
      for (var k = 0; k < total; k++) {
        var i = document.createElement('i');
        if (k <= idx) i.className = 'on';
        dots.appendChild(i);
      }
    }
  }

  function chatbotTourSpeak(text, lang) {
    return new Promise(function(resolve) {
      var fallbackDelay = Math.min(6000, 1400 + (text ? text.length : 0) * 45);
      if (!CHATBOT_CAN_SERVER_TTS || !text) { setTimeout(resolve, fallbackDelay); return; }
      var ttsLang = lang === 'en' ? 'en-US' : 'cs-CZ';
      chatbotStopSpeech();
      var rid = chatbotSpeechRequestId;
      chatbotRequestSpeechAudio(text, ttsLang)
        .then(function(data) {
          if (chatbotTourAborted || rid !== chatbotSpeechRequestId) { resolve(); return; }
          if (data && data.audio) {
            chatbotPlayQueuedBuffer(data.audio, data.sampleRate || CHATBOT_TTS_SAMPLE_RATE, rid)
              .then(function() { resolve(); })
              .catch(function() { resolve(); });
          } else {
            setTimeout(resolve, fallbackDelay);
          }
        })
        .catch(function() { setTimeout(resolve, fallbackDelay); });
    });
  }

  function chatbotTourRun(steps, lang) {
    var i = 0;
    function step() {
      if (chatbotTourAborted) { chatbotTourFinish(); return; }
      if (i >= steps.length) { chatbotTourFinish(); return; }
      var s = steps[i];
      chatbotTourUpdateHud(i, steps.length, s.say);
      chatbotTourSpeak(s.say, lang).then(function() {
        if (chatbotTourAborted) { chatbotTourFinish(); return; }
        try { chatbotExecuteToolCall({ tool: s.tool, args: s.args || {} }); } catch (e) {}
        i++;
        chatbotTourTimer = setTimeout(step, 1100);
      });
    }
    step();
  }

  function chatbotTourFetchSteps(context, lang) {
    return fetch(CHATBOT_TOUR_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: lang, context: context || '' })
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        return (d && Array.isArray(d.steps) && d.steps.length >= 3) ? d.steps : chatbotTourFallback(lang);
      })
      .catch(function() { return chatbotTourFallback(lang); });
  }

  function chatbotTourStart(context) {
    if (chatbotTourActive) return;
    chatbotTourActive = true;
    chatbotTourAborted = false;
    chatbotTourEnsureStyle();
    chatbotTourClosePicker();
    try { chatbotWarmPlaybackContext(); chatbotPrewarmTts(); } catch (e) {}
    var lang = chatbotTourLang();
    var btn = document.getElementById('hero-tour-btn');
    if (btn) btn.disabled = true;
    chatbotTourRenderHud();
    chatbotTourUpdateHud(-1, 0, chatbotTourStrings().loading);
    chatbotTourFetchSteps(context, lang).then(function(steps) {
      if (chatbotTourAborted) { chatbotTourFinish(); return; }
      chatbotTourRun(steps, lang);
    });
  }

  function chatbotTourSkip() {
    if (!chatbotTourActive) return;
    chatbotStopSpeech();
  }

  function chatbotTourStop() {
    chatbotTourAborted = true;
    if (chatbotTourTimer) { clearTimeout(chatbotTourTimer); chatbotTourTimer = null; }
    chatbotStopSpeech();
    chatbotTourFinish();
  }

  function chatbotTourFinish() {
    chatbotTourActive = false;
    if (chatbotTourTimer) { clearTimeout(chatbotTourTimer); chatbotTourTimer = null; }
    chatbotStopSpeech();
    chatbotTourRemoveHud();
    var btn = document.getElementById('hero-tour-btn');
    if (btn) btn.disabled = false;
  }

  function chatbotSendTranscript() {
    if (chatbotState.notificationSent || chatbotState.messages.length < 2) return;
    chatbotState.notificationSent = true;

    var transcript = chatbotState.messages.map(function(m) {
      return (m.role === 'user'
        ? chatbotText('chatbot.transcriptUser', 'Uzivatel')
        : chatbotText('chatbot.transcriptAssistant', 'Hybridní agent')) + ': ' + m.content;
    }).join('\n\n');

    var params = new URLSearchParams();
    params.append('form-name', CHATBOT_AGENT_FORM_NAME);
    params.append('type', 'transcript');
    params.append('_subject', chatbotText('chatbot.transcriptSubject', 'Lukas AI prepis') + ' (' + chatbotState.messages.length + ' zpráv)');
    params.append('message', transcript);

    fetch(CHATBOT_AGENT_FORM_URL, {
      method: 'POST',
      body: params.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }).catch(function() {});
  }

  function chatbotResetInactivity() {
    if (chatbotState.inactivityTimer) clearTimeout(chatbotState.inactivityTimer);
    chatbotState.inactivityTimer = setTimeout(function() {
      chatbotSendTranscript();
    }, CHATBOT_INACTIVITY_MS);
  }

  function chatbotHideQuickReplies() {
    if (chatbotDOM.heroQuickReplies) chatbotDOM.heroQuickReplies.classList.add('hidden');
    if (chatbotDOM.quickReplies) chatbotDOM.quickReplies.classList.add('hidden');
  }

  function chatbotUpdateUnreadBadge() {
    if (!chatbotDOM.unreadBadge) return;
    if (chatbotUnreadCount > 0) {
      chatbotDOM.unreadBadge.textContent = chatbotUnreadCount;
      chatbotDOM.unreadBadge.classList.remove('hidden');
    } else {
      chatbotDOM.unreadBadge.classList.add('hidden');
    }
  }

  function chatbotStreamFromAgent(mode, bubbles, onSentence, speechRequestId) {
    var payload = {
      mode: chatbotNormalizeMode(mode),
      messages: chatbotState.messages.map(function(m) {
        return { role: m.role, content: m.content };
      }),
      _company_website: ''
    };
    var memoryPayload = chatbotMemoryPayload();
    Object.keys(memoryPayload).forEach(function(key) {
      payload[key] = memoryPayload[key];
    });

    return chatbotGetTurnstileToken().then(function(turnstileToken) {
      if (turnstileToken) payload.turnstile_token = turnstileToken;
      return fetch(CHATBOT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }).then(function(res) {
      if (res.status === 429) {
        return res.json().catch(function() { return {}; }).then(function(data) {
          var limitErr = new Error('rate_limit');
          limitErr.limitReached = true;
          limitErr.limitData = data || {};
          throw limitErr;
        });
      }
      if (!res.ok || !res.body) {
        return res.json().catch(function() { return {}; }).then(function(data) {
          throw new Error((data && (data.error || data.message)) || 'Chat error ' + res.status);
        });
      }

      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';
      var fullText = '';
      var sentenceCursor = 0;
      var meta = null;
      var firstAudioFired = false;

      function handleLine(line) {
        if (!line) return;
        try {
          var obj = JSON.parse(line);
          if (typeof obj.t === 'string') {
            fullText += obj.t;
            bubbles.append(obj.t);
            if (onSentence) {
              while (true) {
                var remainder = fullText.slice(sentenceCursor);
                var speechChunk = chatbotExtractSpeechChunk(remainder, !firstAudioFired);
                if (!speechChunk) break;
                sentenceCursor += speechChunk.advance;
                if (speechChunk.text && speechChunk.text.length >= 3) {
                  onSentence(speechChunk.text, speechRequestId);
                  firstAudioFired = true;
                }
              }
            }
          } else if (typeof obj.replace === 'string') {
            fullText = obj.replace;
            bubbles.replace(obj.replace);
          } else if (obj.m) {
            meta = obj.m;
          }
        } catch (err) {
          // ignore malformed line
        }
      }

      function pump() {
        return reader.read().then(function(result) {
          if (result.done) {
            if (buffer.trim()) handleLine(buffer.trim());
            // Flush zbytek věty do TTS (pokud zbylo cokoliv)
            if (onSentence) {
              var tail = fullText.slice(sentenceCursor).trim();
              if (tail.length >= 3) {
                onSentence(tail, speechRequestId);
                sentenceCursor = fullText.length;
              }
            }
            return { text: fullText, meta: meta };
          }
          buffer += decoder.decode(result.value, { stream: true });
          var nl;
          while ((nl = buffer.indexOf('\n')) !== -1) {
            var line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            handleLine(line);
          }
          return pump();
        });
      }

      return pump();
    });
  }

  function chatbotPrewarmChat() {
    if (chatbotWarmedUp) return;
    chatbotWarmedUp = true;
    try {
      fetch(CHATBOT_API_URL, { method: 'GET', cache: 'no-store' }).catch(function() {});
    } catch (err) {
      // ignore
    }
    if (chatbotState.voiceOutputEnabled) {
      chatbotPrewarmTts();
    }
  }

  function chatbotHandleSend(text) {
    if (!text || !text.trim()) return;
    if (chatbotState.isProcessing) return;
    text = text.trim();

    if (chatbotDOM.heroInput) chatbotDOM.heroInput.value = '';
    if (chatbotDOM.chatInput) chatbotDOM.chatInput.value = '';

    chatbotHideQuickReplies();
    chatbotRenderBubble(chatbotDOM.heroMessages, 'user', text);
    chatbotRenderBubble(chatbotDOM.messages, 'user', text);

    var voiceCommand = chatbotDetectVoiceOutputCommand(text);
    if (voiceCommand) {
      chatbotSetVoiceOutput(voiceCommand === 'on');
      return;
    }

    chatbotState.isProcessing = true;
    chatbotState.messages.push({ role: 'user', content: text });
    chatbotResetInactivity();

    // Stop any previous audio, reset speech request id for this turn
    if (chatbotState.voiceOutputEnabled) {
      chatbotStopSpeech();
    }
    var modeAtSend = chatbotNormalizeMode(chatbotState.mode);
    var wantsVoice = chatbotState.voiceOutputEnabled && !(window.aiVoice && window.aiVoice.state && window.aiVoice.state.status === 'active');
    var speechRequestId = chatbotSpeechRequestId;
    var streamSpeechStarted = false;

    if (wantsVoice) {
      chatbotPrepareSpeechOutput();
    }

    // Create streaming assistant bubbles immediately (no typing dots - text pops in)
    var bubbles = chatbotCreateStreamingBubbles();

    function onSentence(sentence, reqId) {
      if (!wantsVoice) return;
      streamSpeechStarted = true;
      chatbotSpeakStreamingSentence(sentence, sentence, reqId);
    }

    chatbotStreamFromAgent(modeAtSend, bubbles, onSentence, speechRequestId)
      .then(function(result) {
        var mode = chatbotNormalizeMode((result && result.meta && result.meta.mode) || modeAtSend);
        var message = (result && result.text ? result.text.trim() : '') || chatbotText('chatbot.fallback', 'Teď jsem to nezvládl. Zkus to prosím znovu.');
        var meta = (result && result.meta) || {};

        // If server sent a "replace" chunk, bubble already shows it; otherwise ensure trim
        if (bubbles) bubbles.replace(message);

        chatbotState.messages.push({ role: 'assistant', content: message });
        chatbotState.isProcessing = false;

        // Update workbench + quick replies from defaults (client-side, fast)
        var defaultWb = chatbotDefaultWorkbench(mode);
        defaultWb.artifactBody = message.slice(0, 420);
        chatbotSetMode(mode, false);
        chatbotRenderWorkbench(defaultWb);
        var defaultReplies = chatbotModeMeta(mode).replies || [];
        chatbotRenderQuickReplies(chatbotDOM.heroQuickReplies, defaultReplies);
        chatbotRenderQuickReplies(chatbotDOM.quickReplies, defaultReplies);

        // Handle action
        var action = meta.action || null;
        var voiceDirective = chatbotResolveVoiceDirective(action);
        if (voiceDirective === 'on') {
          chatbotSetVoiceOutput(true, { silent: true });
        } else if (voiceDirective === 'off') {
          chatbotSetVoiceOutput(false, { silent: true });
        }

        if (message && !streamSpeechStarted && ((wantsVoice || voiceDirective === 'on') && voiceDirective !== 'off')) {
          chatbotSpeakText(message, message);
        }

        if (!chatbotState.isWidgetOpen) {
          chatbotUnreadCount++;
          chatbotUpdateUnreadBadge();
        }

        if (action && action.type !== 'voice_output') {
          setTimeout(function() { chatbotExecuteAction(action); }, 600);
        }

        if (Array.isArray(meta.actions) && meta.actions.length > 0) {
          setTimeout(function() { chatbotExecuteActions(meta.actions); }, 600);
        }
      })
      .catch(function(err) {
        chatbotState.isProcessing = false;

        if (err && err.limitReached) {
          var limitData = err.limitData || {};
          var fb = limitData.fallback || {};
          var msg = fb.message || 'Zdá se, že jsme si pěkně popovídali. Pokud potřebuješ pokračovat, napiš mi přímo na lukas.drsticka@gmail.com.';
          if (bubbles) bubbles.replace(msg);
          chatbotState.messages.push({ role: 'assistant', content: msg });
          chatbotShowEmailFallback(fb);
          return;
        }

        console.error('Chatbot stream error:', err);
        var fallback = chatbotText('chatbot.fallback', 'Teď zrovna nemůžu odpovědět. Zkus to prosím za chvíli.');
        if (bubbles) bubbles.replace(fallback);
        chatbotState.messages.push({ role: 'assistant', content: fallback });
      });
  }

  function chatbotBuildConversationSummary() {
    return chatbotState.messages.map(function(m) {
      return (m.role === 'user' ? 'Uživatel' : 'Hybridní agent') + ': ' + (m.content || '');
    }).join('\n\n').slice(0, 1800);
  }

  function chatbotFindContactForm() {
    return document.getElementById('contactForm') || document.querySelector('form[name="contact"], #contact-form');
  }

  function chatbotFindContactField(form, field) {
    if (!form) return null;
    var idMap = {
      name: 'contactName',
      email: 'contactEmail',
      service: 'contactService',
      message: 'contactMessage'
    };
    return document.getElementById(idMap[field]) || form.querySelector('[name="' + field + '"], #contact-' + field);
  }

  var CHATBOT_SERVICE_LABELS = {
    'fotografie': 'Fotografie',
    'portretni-foceni': 'Portrétní focení',
    'sportovni-foceni': 'Sportovní focení',
    'akcni-foceni': 'Focení akce',
    'produktove-foceni': 'Produktové focení',
    'webovy-projekt': 'Webové stránky',
    'ai': 'AI chatbot',
    'ai-chatbot': 'AI chatbot',
    'ai-agent-na-miru': 'AI agent na míru',
    'ai-builder': 'AI řešení',
    'ai-konzultace': 'AI konzultace',
    'automatizace': 'Automatizace',
    'konzultace': 'Konzultace'
  };

  function chatbotEnsureSelectOption(select, value, label) {
    if (!select || !value) return;
    var exists = Array.prototype.some.call(select.options || [], function(option) {
      return option.value === value;
    });
    if (!exists) {
      var option = document.createElement('option');
      option.value = value;
      option.textContent = label || value;
      select.appendChild(option);
    }
  }

  function chatbotSetContactField(input, value) {
    if (!input || value === undefined || value === null || value === '') return;
    input.value = String(value);
    input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  }

  function chatbotScrollToForm(form) {
    if (!form) return;
    // Použij browser-native scrollIntoView. Offset zajišťuje CSS `scroll-margin-top`
    // (viz assets/styles.css `#contactForm`). Tohle je deterministic + survives layout shifts.
    try {
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      // Fallback pro starší browsery bez smooth scroll
      form.scrollIntoView(true);
    }
    // Re-scroll po dokončení layout shifts (typewriter, AI suggestions, agent reply bubble)
    setTimeout(function() {
      try {
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) { /* noop */ }
    }, 650);
  }

  function chatbotPrefillContactForm(args, options) {
    var form = chatbotFindContactForm();
    if (!form) return false;
    var fields = args || {};

    ['name', 'email', 'message'].forEach(function(field) {
      chatbotSetContactField(chatbotFindContactField(form, field), fields[field]);
    });

    var serviceInput = chatbotFindContactField(form, 'service');
    if (serviceInput && fields.service) {
      var serviceValue = String(fields.service);
      chatbotEnsureSelectOption(serviceInput, serviceValue, CHATBOT_SERVICE_LABELS[serviceValue] || serviceValue);
      chatbotSetContactField(serviceInput, serviceValue);
    }

    var status = document.getElementById('contactStatus');
    if (status && options && options.status) status.textContent = options.status;

    form.classList.add('ai-highlight');
    setTimeout(function() { form.classList.remove('ai-highlight'); }, 2600);
    // Počkej na příští frame aby DOM dohnal layout (po prefill), pak scrolluj
    requestAnimationFrame(function() { chatbotScrollToForm(form); });
    // contactMessage textarea má auto-resize listener → po dispatched 'input' může
    // form expandovat během dalších 100ms. Re-scroll když layout settled.
    setTimeout(function() { chatbotScrollToForm(form); }, 120);
    return true;
  }

  function chatbotOpenPrefillForm() {
    var form = chatbotFindContactForm();
    if (form) {
      var msgInput = chatbotFindContactField(form, 'message');
      if (msgInput) {
        chatbotSetContactField(msgInput, 'Pokračování konverzace s Hybridním agentem:\n\n' + chatbotBuildConversationSummary());
      }
      chatbotScrollToForm(form);
      return;
    }
    var subject = encodeURIComponent('Pokračování konverzace z webu');
    var body = encodeURIComponent(chatbotBuildConversationSummary());
    window.location.href = 'mailto:lukas.drsticka@gmail.com?subject=' + subject + '&body=' + body;
  }

  function chatbotShowEmailFallback(fallbackData) {
    var existing = document.getElementById('chatbot-email-fallback');
    if (existing) existing.remove();

    var container = document.createElement('div');
    container.id = 'chatbot-email-fallback';
    container.className = 'chatbot-email-fallback';
    container.style.cssText = 'margin:12px 0;padding:14px 16px;border-radius:12px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);display:flex;flex-direction:column;gap:10px;';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Otevřít formulář s naší konverzací';
    btn.style.cssText = 'padding:10px 16px;border-radius:8px;border:0;background:#6366f1;color:#fff;font-weight:600;cursor:pointer;align-self:flex-start;';
    btn.addEventListener('click', chatbotOpenPrefillForm);

    var emailLink = document.createElement('a');
    emailLink.href = 'mailto:' + (fallbackData && fallbackData.email ? fallbackData.email : 'lukas.drsticka@gmail.com');
    emailLink.textContent = '✉ ' + (fallbackData && fallbackData.email ? fallbackData.email : 'lukas.drsticka@gmail.com');
    emailLink.style.cssText = 'color:#6366f1;text-decoration:none;font-weight:500;';

    container.appendChild(btn);
    container.appendChild(emailLink);

    var host = chatbotDOM.heroMessages || chatbotDOM.messages;
    if (host) {
      host.appendChild(container);
      chatbotScrollToBottom(host);
    }
  }

  function chatbotSyncWidgetMessages() {
    if (!chatbotDOM.messages) return;
    chatbotDOM.messages.innerHTML = '';
    chatbotState.messages.forEach(function(message) {
      chatbotRenderBubble(chatbotDOM.messages, message.role, message.content);
    });
  }

  function chatbotClearState() {
    chatbotState.messages = [];
    chatbotState.notificationSent = false;
    chatbotState.isProcessing = false;
    chatbotUnreadCount = 0;
    chatbotUpdateUnreadBadge();

    chatbotStopSpeech();

    if (chatbotState.inactivityTimer) {
      clearTimeout(chatbotState.inactivityTimer);
      chatbotState.inactivityTimer = null;
    }

    if (chatbotDOM.heroMessages) chatbotDOM.heroMessages.innerHTML = '';
    if (chatbotDOM.messages) chatbotDOM.messages.innerHTML = '';

    chatbotShowWelcome();
    chatbotRenderWorkbench(chatbotDefaultWorkbench(chatbotState.mode));
    chatbotRenderQuickReplies(chatbotDOM.heroQuickReplies, chatbotModeMeta(chatbotState.mode).replies);
    chatbotRenderQuickReplies(chatbotDOM.quickReplies, chatbotModeMeta(chatbotState.mode).replies);
  }

  function chatbotSyncLocaleUI() {
    var locale = chatbotLocale();
    var helperNode = document.getElementById('hero-chat-helper');
    if (helperNode) helperNode.innerHTML = locale.helperNoteHtml;

    chatbotSetMode(chatbotState.mode, false);
    chatbotUpdateSpeechToggleButtons();

    var hasUserMessages = chatbotState.messages.some(function(message) {
      return message.role === 'user';
    });

    if (!hasUserMessages) {
      chatbotState.messages = [];
      if (chatbotDOM.heroMessages) chatbotDOM.heroMessages.innerHTML = '';
      if (chatbotDOM.messages) chatbotDOM.messages.innerHTML = '';
      chatbotShowWelcome();
      chatbotRenderWorkbench(chatbotDefaultWorkbench(chatbotState.mode));
      chatbotRenderQuickReplies(chatbotDOM.heroQuickReplies, chatbotModeMeta(chatbotState.mode).replies);
      chatbotRenderQuickReplies(chatbotDOM.quickReplies, chatbotModeMeta(chatbotState.mode).replies);
    }
  }

  function chatbotShowWelcome() {
    var welcome = chatbotWelcomeMessage();
    chatbotRenderBubble(chatbotDOM.heroMessages, 'assistant', welcome);
    chatbotRenderBubble(chatbotDOM.messages, 'assistant', welcome);
    chatbotMaybeRenderMemoryControls();
  }

  function chatbotOpenWidget() {
    if (!chatbotDOM.chatWindow) return;
    chatbotDOM.chatWindow.classList.remove('hidden');
    chatbotState.isWidgetOpen = true;
    chatbotUnreadCount = 0;
    chatbotUpdateUnreadBadge();
    chatbotSyncWidgetMessages();

    if (!chatbotState.messages.length && chatbotDOM.messages) {
      chatbotRenderBubble(chatbotDOM.messages, 'assistant', chatbotWelcomeMessage());
      chatbotMaybeRenderMemoryControls();
      chatbotRenderQuickReplies(chatbotDOM.quickReplies, chatbotModeMeta(chatbotState.mode).replies);
    }
  }

  function chatbotCloseWidget() {
    if (!chatbotDOM.chatWindow) return;
    chatbotDOM.chatWindow.classList.add('hidden');
    chatbotState.isWidgetOpen = false;
  }

  function chatbotInitHero() {
    chatbotDOM.heroInput = document.getElementById('hero-input');
    chatbotDOM.heroSend = document.getElementById('hero-send');
    chatbotDOM.heroMessages = document.getElementById('hero-messages');
    chatbotDOM.heroQuickReplies = document.getElementById('hero-quick-replies');
    chatbotDOM.heroSpeechToggle = document.getElementById('hero-speech-toggle');
    chatbotDOM.modeButtons = Array.prototype.slice.call(document.querySelectorAll('[data-agent-mode]'));
    chatbotDOM.heroModeBadge = document.getElementById('agent-mode-badge');
    chatbotDOM.workbenchSummary = document.getElementById('agent-summary');
    chatbotDOM.workbenchIntent = document.getElementById('agent-intent');
    chatbotDOM.workbenchSteps = document.getElementById('agent-steps');
    chatbotDOM.workbenchArtifactTitle = document.getElementById('agent-artifact-title');
    chatbotDOM.workbenchArtifactBody = document.getElementById('agent-artifact-body');
    chatbotDOM.workbenchCta = document.getElementById('agent-cta');

    if (!chatbotDOM.heroMessages) return;

    if (chatbotDOM.heroInput) {
      chatbotDOM.heroInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          chatbotHandleSend(chatbotDOM.heroInput.value);
        }
      });
    }

    if (chatbotDOM.heroSend) {
      chatbotDOM.heroSend.addEventListener('click', function() {
        chatbotHandleSend(chatbotDOM.heroInput ? chatbotDOM.heroInput.value : '');
      });
    }

    if (chatbotDOM.heroSpeechToggle) {
      chatbotDOM.heroSpeechToggle.addEventListener('click', chatbotToggleVoiceOutput);
    }

    chatbotDOM.heroTourBtn = document.getElementById('hero-tour-btn');
    if (chatbotDOM.heroTourBtn) {
      chatbotTourEnsureStyle();
      chatbotDOM.heroTourBtn.addEventListener('click', chatbotTourOpenPicker);
    }

    chatbotDOM.modeButtons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        chatbotSetMode(btn.getAttribute('data-agent-mode'));
      });
    });

    if (chatbotDOM.workbenchCta) {
      chatbotDOM.workbenchCta.addEventListener('click', function() {
        chatbotHandleSend(chatbotDOM.workbenchCta.getAttribute('data-value') || '');
      });
    }

    var heroSection = document.getElementById('hybridni-agent');
    if (heroSection) {
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          chatbotState.isHeroVisible = entry.isIntersecting;
        });
      }, { threshold: 0.1 });
      observer.observe(heroSection);
    }

    chatbotShowWelcome();
    chatbotRenderWorkbench(chatbotDefaultWorkbench(chatbotState.mode));
    chatbotSetMode(chatbotState.mode);
  }

  function chatbotInitWidget() {
    chatbotDOM.chatBtn = document.getElementById('chatBtn');
    chatbotDOM.chatWindow = document.getElementById('chatWindow');
    chatbotDOM.chatInput = document.getElementById('chatInput');
    chatbotDOM.sendBtn = document.getElementById('sendBtn');
    chatbotDOM.closeChat = document.getElementById('closeChat');
    chatbotDOM.clearChat = document.getElementById('clearChat');
    chatbotDOM.messages = document.getElementById('messages');
    chatbotDOM.quickReplies = document.getElementById('quickReplies');
    chatbotDOM.unreadBadge = document.getElementById('unreadBadge');
    chatbotDOM.widgetModeBadge = document.getElementById('chat-mode-badge');
    chatbotDOM.widgetSpeechToggle = document.getElementById('widget-speech-toggle');

    if (!chatbotDOM.chatBtn) return;

    chatbotDOM.chatBtn.addEventListener('click', function() {
      if (chatbotState.isWidgetOpen) chatbotCloseWidget();
      else chatbotOpenWidget();
    });

    if (chatbotDOM.closeChat) {
      chatbotDOM.closeChat.addEventListener('click', chatbotCloseWidget);
    }

    if (chatbotDOM.clearChat) {
      chatbotDOM.clearChat.addEventListener('click', chatbotClearState);
    }

    if (chatbotDOM.widgetSpeechToggle) {
      chatbotDOM.widgetSpeechToggle.addEventListener('click', chatbotToggleVoiceOutput);
    }

    if (chatbotDOM.sendBtn) {
      chatbotDOM.sendBtn.addEventListener('click', function() {
        chatbotHandleSend(chatbotDOM.chatInput ? chatbotDOM.chatInput.value : '');
      });
    }

    if (chatbotDOM.chatInput) {
      chatbotDOM.chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          chatbotHandleSend(chatbotDOM.chatInput.value);
        }
      });
    }

    if (chatbotDOM.messages) {
      chatbotRenderBubble(chatbotDOM.messages, 'assistant', chatbotWelcomeMessage());
      chatbotMaybeRenderMemoryControls();
    }
    chatbotRenderQuickReplies(chatbotDOM.quickReplies, chatbotModeMeta(chatbotState.mode).replies);
    chatbotSetMode(chatbotState.mode, false);
    chatbotUpdateSpeechToggleButtons();
    chatbotUpdateUnreadBadge();
  }

  window.addEventListener('beforeunload', function() {
    chatbotSendTranscript();
    chatbotStopSpeech();
    if (chatbotPlaybackCtx && chatbotPlaybackCtx.state !== 'closed') {
      chatbotPlaybackCtx.close().catch(function() {});
    }
  });

  function chatbotSetupPrewarm() {
    // Keep-warm: prefetchni chat funkci jakmile je uživatel blízko sekce hybridního agenta,
    // nebo jakmile poprvé klikne do vstupu. Zabíjí Netlify cold start.
    var heroSection = document.getElementById('hybridni-agent');
    if (heroSection && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function(entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            chatbotPrewarmChat();
            io.disconnect();
            break;
          }
        }
      }, { rootMargin: '400px 0px' });
      io.observe(heroSection);
    } else {
      // Fallback: prewarm po 2s
      setTimeout(chatbotPrewarmChat, 2000);
    }
    // První focus do inputu také prewarmne
    ['hero-input', 'chatInput'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('focus', chatbotPrewarmChat, { once: true });
    });
  }

  function chatbotInit() {
    chatbotState.sessionId = chatbotGetSessionId();
    chatbotState.memoryConsent = chatbotReadMemoryConsent();
    chatbotState.visitorId = chatbotState.memoryConsent ? chatbotGetVisitorId(true) : chatbotGetVisitorId(false);
    chatbotState.voiceOutputEnabled = chatbotReadVoiceOutputPreference();
    if (chatbotState.voiceOutputEnabled) chatbotPrewarmTts();
    chatbotInitHero();
    chatbotInitWidget();
    chatbotSyncLocaleUI();
    chatbotSetupPrewarm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', chatbotInit);
  } else {
    chatbotInit();
  }

  window.aiChat = {
    state: chatbotState,
    send: chatbotHandleSend,
    clear: chatbotClearState,
    openWidget: chatbotOpenWidget,
    closeWidget: chatbotCloseWidget,
    setMode: chatbotSetMode,
    setVoiceOutput: chatbotSetVoiceOutput,
    reinit: chatbotInit
  };

  window.addEventListener('ld:languagechange', chatbotSyncLocaleUI);
})();
