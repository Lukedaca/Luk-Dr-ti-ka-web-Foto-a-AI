/**
 * chatbot.js - Lukas AI public + agent workbench experience
 * Shared state (window.aiChat) drives both hero chat and floating widget.
 */
;(function chatbotIIFE() {
  'use strict';

  var CHATBOT_FORMSPREE_URL = 'https://formspree.io/f/movlrlzj';
  var CHATBOT_INACTIVITY_MS = 180000;
  var CHATBOT_API_URL = '/.netlify/functions/chat';
  var CHATBOT_TTS_API_URL = '/.netlify/functions/tts';
  var CHATBOT_DEFAULT_MODE = 'talk';
  var CHATBOT_PUBLIC_MODE = 'talk';
  var CHATBOT_VOICE_OUTPUT_KEY = 'lukas_ai_voice_output';
  var CHATBOT_CAN_SPEAK = !!((window.AudioContext || window.webkitAudioContext) && window.fetch);
  var CHATBOT_TTS_SAMPLE_RATE = 24000;

  function chatbotText(path, fallback) {
    return typeof window.ldGetText === 'function' ? window.ldGetText(path, fallback) : fallback;
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
          badge: isEn ? 'Public assistant' : 'Veřejný asistent',
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
            ? 'I will break the request down, suggest a direction and point out weak spots.'
            : 'Rozeberu zadání, navrhnu směr a upozorním na slabiny.',
          replies: isEn
            ? [
                { text: 'AI agent for business', value: 'Think through an AI agent for a small company that would do real work.' },
                { text: 'Website automation', value: 'How would you automate lead flow and website communication?' },
                { text: 'Pilot strategy', value: 'Suggest a sensible pilot for deploying an AI assistant.' }
              ]
            : [
                { text: 'AI agent pro firmu', value: 'Promysli AI agenta pro menší firmu, který by dělal reálnou práci.' },
                { text: 'Automatizace webu', value: 'Jak bys zautomatizoval lead flow a komunikaci na webu?' },
                { text: 'Strategie pilotu', value: 'Navrhni rozumný pilot pro nasazení AI asistenta.' }
              ]
        },
        build: {
          label: 'Build',
          badge: isEn ? 'Mini deliverable' : 'Mini výstup',
          helper: isEn
            ? 'I prepare an output that is already usable for a call, brief or next decision.'
            : 'Připravuju výstup, který už jde někam poslat nebo podle něj jednat.',
          replies: isEn
            ? [
                { text: 'Mini brief', value: 'Create a short collaboration brief for an AI agent on a website.' },
                { text: 'Draft scope', value: 'Write scope for the first version of a personal AI agent.' },
                { text: 'Roadmap', value: 'Prepare a short launch roadmap for that kind of agent.' }
              ]
            : [
                { text: 'Mini brief', value: 'Vytvoř mi mini brief spolupráce na AI agentovi pro web.' },
                { text: 'Návrh scope', value: 'Sepiš scope pro první verzi osobního AI agenta.' },
                { text: 'Roadmapa', value: 'Připrav krátkou roadmapu pro launch takového agenta.' }
              ]
        }
      },
      workbench: {
        buildSteps: isEn ? ['Understand the goal', 'Prepare a mini output', 'Suggest the next step'] : ['Pochopím cíl', 'Připravím mini výstup', 'Navrhnu další krok'],
        thinkSteps: isEn ? ['Understand context', 'Choose the best direction', 'Show recommendation'] : ['Pochopím kontext', 'Vyberu nejlepší směr', 'Ukážu doporučení'],
        talkSteps: isEn ? ['Start the conversation', 'Choose a useful direction', 'Move things forward'] : ['Navážu konverzaci', 'Vyberu užitečný směr', 'Posunu to dál']
      },
      helperNoteHtml: isEn
        ? 'Click <strong class="text-white/85 font-semibold">Talk by voice</strong> for a live voice call or enable <strong class="text-white/85 font-semibold">voice replies</strong> when you want to type and hear answers aloud. The assistant works in <strong class="text-white/85 font-semibold">CZ / EN</strong>.'
        : 'Klikni na <strong class="text-white/85 font-semibold">Mluvit hlasem</strong> pro voice call nebo zapni <strong class="text-white/85 font-semibold">hlasové odpovědi</strong>, když chceš psát a slyšet odpovědi nahlas. Asistent funguje v <strong class="text-white/85 font-semibold">CZ / EN</strong>.',
      voiceOutputUnsupported: isEn ? 'Voice replies unavailable' : 'Hlasové odpovědi nejsou dostupné',
      voiceOutputOn: isEn ? 'Voice replies: on' : 'Hlasové odpovědi: zapnuto',
      voiceOutputOff: isEn ? 'Voice replies: off' : 'Hlasové odpovědi: vypnuto',
      voiceShortOn: isEn ? 'Voice on' : 'Hlas zap.',
      voiceShortOff: isEn ? 'Voice off' : 'Hlas vyp.',
      voiceEnabledMessage: isEn ? 'Voice replies are enabled. Keep typing and I will answer aloud as well.' : 'Hlasové odpovědi jsou zapnuté. Klidně piš, budu odpovídat i nahlas.',
      voiceDisabledMessage: isEn ? 'Voice replies are disabled. I will answer only in text now.' : 'Hlasové odpovědi jsou vypnuté. Budu už jen psát.',
      publicAssistantBadge: isEn ? 'Public assistant' : 'Veřejný asistent',
      widgetAssistantBadge: isEn ? 'Assistant' : 'Asistent',
      defaultAssistantMessage: isEn ? 'I will think it through with you and suggest the next step.' : 'Promyslím to s tebou a navrhnu další krok.'
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
      helper: 'Rozeberu zadání, navrhnu směr a upozorním na slabiny.',
      replies: [
        { text: 'AI agent pro firmu', value: 'Promysli AI agenta pro menší firmu, který by dělal reálnou práci.' },
        { text: 'Automatizace webu', value: 'Jak bys zautomatizoval lead flow a komunikaci na webu?' },
        { text: 'Strategie pilotu', value: 'Navrhni rozumný pilot pro nasazení AI asistenta.' }
      ]
    },
    build: {
      label: 'Build',
      badge: 'Mini deliverable',
      helper: 'Připravuju výstup, který už jde někam poslat nebo podle něj jednat.',
      replies: [
        { text: 'Mini brief', value: 'Vytvoř mi mini brief spolupráce na AI agentovi pro web.' },
        { text: 'Návrh scope', value: 'Sepiš scope pro první verzi osobního AI agenta.' },
        { text: 'Roadmapa', value: 'Připrav krátkou roadmapu pro launch takového agenta.' }
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
        ? (isEn ? 'What this can produce' : 'Co z toho může vzniknout')
        : (isEn ? 'What this mode can do' : 'Co tenhle režim umí'),
      artifactBody: mode === 'build'
        ? (isEn ? 'I can prepare a mini brief, automation scope, AI agent proposal or a call summary.' : 'Můžu připravit mini brief, scope automatizace, návrh AI agenta nebo call summary.')
        : mode === 'think'
          ? (isEn ? 'I can break down the idea, show risks, suggest architecture and recommend a first pilot.' : 'Můžu rozebrat nápad, ukázat rizika, navrhnout architekturu a doporučit první pilot.')
          : (isEn ? 'I can talk about Lukas, the projects, the portfolio and switch into an agent workflow when it makes sense.' : 'Můžu mluvit o Lukášovi, projektech, portfoliu a při správné chvíli se přepnout do agentního režimu.'),
      ctaLabel: mode === 'build' ? (isEn ? 'Try build mode' : 'Zkusit build mode') : (isEn ? 'Show me a concrete proposal' : 'Chci vidět konkrétní návrh'),
      ctaValue: mode === 'build'
        ? (isEn ? 'Create a concrete collaboration proposal for an AI agent.' : 'Vytvoř mi konkrétní návrh spolupráce na AI agentovi.')
        : (isEn ? 'Switch to build mode and prepare a concrete proposal for me.' : 'Přepneme to do build mode a připrav mi konkrétní návrh.')
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
    preferredSpeechLang: 'cs-CZ'
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
  var chatbotSpeechRequestId = 0;
  var chatbotAudioQueue = [];
  var chatbotAudioPlaying = false;
  var chatbotWarmedUp = false;

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

  function chatbotEnsurePlaybackContext() {
    if (!CHATBOT_CAN_SPEAK) return null;
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
        slot.ready = true;
        slot.audio = null;
        chatbotDrainAudioQueue();
      });
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

  function chatbotSetMode(mode, syncReplies) {
    mode = CHATBOT_PUBLIC_MODE;
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
    container.scrollTop = container.scrollHeight;
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
    container.scrollTop = container.scrollHeight;
    return bubble;
  }

  function chatbotCreateStreamingBubbles() {
    var heroBubble = chatbotCreateAssistantStreamBubble(chatbotDOM.heroMessages);
    var widgetBubble = chatbotCreateAssistantStreamBubble(chatbotDOM.messages);
    var firstAppend = true;
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
    return {
      append: function(text) {
        if (firstAppend) { clearPending(); firstAppend = false; }
        if (heroBubble) heroBubble.textContent += text;
        if (widgetBubble) widgetBubble.textContent += text;
        if (chatbotDOM.heroMessages) chatbotDOM.heroMessages.scrollTop = chatbotDOM.heroMessages.scrollHeight;
        if (chatbotDOM.messages) chatbotDOM.messages.scrollTop = chatbotDOM.messages.scrollHeight;
      },
      replace: function(text) {
        if (firstAppend) { clearPending(); firstAppend = false; }
        if (heroBubble) heroBubble.textContent = text;
        if (widgetBubble) widgetBubble.textContent = text;
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
      '<div class="glass rounded-xl typing-indicator" aria-live="polite" aria-label="' + chatbotEscapeHTML(chatbotText('chatbot.typing', 'Asistent pise...')) + '">' +
        '<span></span><span></span><span></span>' +
      '</div>';

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
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

  function chatbotExecuteAction(action) {
    if (!action || !action.type) return;

    switch (action.type) {
      case 'scroll':
        var scrollTarget = document.getElementById(action.target);
        if (scrollTarget) scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      case 'filter':
        var filterBtn = document.querySelector('[data-filter="' + action.target + '"]');
        if (filterBtn) filterBtn.click();
        break;
      case 'highlight':
        var highlightTarget = document.getElementById(action.target);
        if (highlightTarget) {
          highlightTarget.classList.add('ai-highlight');
          setTimeout(function() { highlightTarget.classList.remove('ai-highlight'); }, 3000);
        }
        break;
    }
  }

  function chatbotSendTranscript() {
    if (chatbotState.notificationSent || chatbotState.messages.length < 2) return;
    chatbotState.notificationSent = true;

    var transcript = chatbotState.messages.map(function(m) {
      return (m.role === 'user'
        ? chatbotText('chatbot.transcriptUser', 'Uzivatel')
        : chatbotText('chatbot.transcriptAssistant', 'Asistent')) + ': ' + m.content;
    }).join('\n\n');

    var formData = new FormData();
    formData.append('_subject', chatbotText('chatbot.transcriptSubject', 'Lukas AI prepis') + ' (' + chatbotState.messages.length + ' zpráv)');
    formData.append('message', transcript);

    fetch(CHATBOT_FORMSPREE_URL, {
      method: 'POST',
      body: formData,
      headers: { 'Accept': 'application/json' }
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

  function chatbotStreamFromAgent(bubbles, onSentence, speechRequestId) {
    var payload = {
      messages: chatbotState.messages.map(function(m) {
        return { role: m.role, content: m.content };
      })
    };

    return fetch(CHATBOT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function(res) {
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
            // Sentence detection -> fire TTS per sentence
            if (onSentence) {
              while (true) {
                var remainder = fullText.slice(sentenceCursor);
                // Pre-fire: první audio chunk může skončit už na , ; : pokud
                // už nasbíral 25+ znaků — TTS dostane rychlejší první kousek.
                var reSentence = (!firstAudioFired && remainder.length >= 25)
                  ? /^([\s\S]{25,}?[\.!\?,;:])(\s|$)/
                  : /^([\s\S]*?[\.!\?])(\s|$)/;
                var match = remainder.match(reSentence);
                if (!match) break;
                var sentence = match[1].trim();
                sentenceCursor += match[0].length;
                if (sentence.length >= 6) {
                  onSentence(sentence, speechRequestId);
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
    var speechRequestId = chatbotSpeechRequestId;
    var wantsVoice = chatbotState.voiceOutputEnabled && !(window.aiVoice && window.aiVoice.state && window.aiVoice.state.status === 'active');

    // Create streaming assistant bubbles immediately (no typing dots — text pops in)
    var bubbles = chatbotCreateStreamingBubbles();

    function onSentence(sentence, reqId) {
      if (!wantsVoice) return;
      chatbotSpeakStreamingSentence(sentence, sentence, reqId);
    }

    chatbotStreamFromAgent(bubbles, onSentence, speechRequestId)
      .then(function(result) {
        var mode = CHATBOT_PUBLIC_MODE;
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

        if (!chatbotState.isWidgetOpen) {
          chatbotUnreadCount++;
          chatbotUpdateUnreadBadge();
        }

        if (action && action.type !== 'voice_output') {
          setTimeout(function() { chatbotExecuteAction(action); }, 600);
        }
      })
      .catch(function(err) {
        console.error('Chatbot stream error:', err);
        chatbotState.isProcessing = false;
        var fallback = chatbotText('chatbot.fallback', 'Teď zrovna nemůžu odpovědět. Zkus to prosím za chvíli.');
        if (bubbles) bubbles.replace(fallback);
        chatbotState.messages.push({ role: 'assistant', content: fallback });
      });
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

    var heroSection = document.getElementById('ai-asistent');
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

    if (chatbotDOM.messages) chatbotRenderBubble(chatbotDOM.messages, 'assistant', chatbotWelcomeMessage());
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
    var heroSection = document.getElementById('ai-asistent');
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
    chatbotState.voiceOutputEnabled = chatbotReadVoiceOutputPreference();
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
