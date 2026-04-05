/**
 * chatbot.js - Lukas AI public + agent workbench experience
 * Shared state (window.aiChat) drives both hero chat and floating widget.
 */
;(function chatbotIIFE() {
  'use strict';

  var CHATBOT_FORMSPREE_URL = 'https://formspree.io/f/movlrlzj';
  var CHATBOT_INACTIVITY_MS = 180000;
  var CHATBOT_API_URL = '/.netlify/functions/chat';
  var CHATBOT_DEFAULT_MODE = 'talk';

  var CHATBOT_MODE_META = {
    talk: {
      label: 'Talk',
      badge: 'Public presence',
      helper: 'Povidej si se mnou jako s digitalni verzi Lukase. Czech by default, English when needed.',
      replies: [
        { text: 'Co presne delas?', value: 'Co presne delas a s cim lidem pomahas?' },
        { text: 'Speak English', value: 'Please continue in English and tell me what you do.' },
        { text: 'Ukaz portfolio', value: 'Ukaz mi portfolio a co je na nem nejzajimavejsi.' },
        { text: 'Fotograf AI', value: 'Vysvetli mi lidsky, co je Fotograf AI.' }
      ]
    },
    think: {
      label: 'Think',
      badge: 'Agent reasoning',
      helper: 'Rozeberu zadani, navrhnu smer a upozornim na slabiny.',
      replies: [
        { text: 'AI agent pro firmu', value: 'Promysli AI agenta pro mensi firmu, ktery by delal realnou praci.' },
        { text: 'Automatizace webu', value: 'Jak bys zautomatizoval lead flow a komunikaci na webu?' },
        { text: 'Strategie pilotu', value: 'Navrhni rozumny pilot pro nasazeni AI asistenta.' }
      ]
    },
    build: {
      label: 'Build',
      badge: 'Mini deliverable',
      helper: 'Pripravuju vystup, ktery uz jde nekam poslat nebo podle nej jednat.',
      replies: [
        { text: 'Mini brief', value: 'Vytvor mi mini brief spoluprace na AI agentovi pro web.' },
        { text: 'Navrh scope', value: 'Sepis scope pro prvni verzi osobniho AI agenta.' },
        { text: 'Roadmapa', value: 'Priprav kratkou roadmapu pro launch takoveho agenta.' }
      ]
    }
  };

  var CHATBOT_WELCOME = 'Ahoj, jsem Lukas AI. Umim si s tebou povidat, promyslet zadani a rovnou pripravit mini vystup. Muzeš psat cesky i anglicky a muzes se mnou i mluvit hlasem.';

  function chatbotDefaultWorkbench(mode) {
    var meta = CHATBOT_MODE_META[mode] || CHATBOT_MODE_META.talk;
    return {
      summary: meta.helper,
      intent: mode + '-mode',
      steps: mode === 'build'
        ? ['Pochopim cil', 'Pripravim mini vystup', 'Navrhnu dalsi krok']
        : mode === 'think'
          ? ['Pochopim kontext', 'Vyberu nejlepsi smer', 'Ukazu doporuceni']
          : ['Navazu konverzaci', 'Vyberu uzitecny smer', 'Posunu to dal'],
      artifactTitle: mode === 'build' ? 'Co z toho muze vzniknout' : 'Co tenhle rezim umi',
      artifactBody: mode === 'build'
        ? 'Muzu pripravit mini brief, scope automatizace, navrh AI agenta nebo call summary.'
        : mode === 'think'
          ? 'Muzu rozebrat napad, ukazat rizika, navrhnout architekturu a doporucit prvni pilot.'
          : 'Muzu mluvit o Lukasovi, projektech, portfoliu a pri spravne chvili se prepnout do agentniho rezimu.',
      ctaLabel: mode === 'build' ? 'Zkusit build mode' : 'Chci videt konkretni navrh',
      ctaValue: mode === 'build'
        ? 'Vytvor mi konkretni navrh spoluprace na AI agentovi.'
        : 'Prepneme to do build mode a priprav mi konkretni navrh.'
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
      return (CHATBOT_MODE_META[mode] || CHATBOT_MODE_META.talk).replies;
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

    return normalized.length ? normalized : (CHATBOT_MODE_META[mode] || CHATBOT_MODE_META.talk).replies;
  }

  var chatbotState = {
    messages: [],
    isWidgetOpen: false,
    isHeroVisible: true,
    inactivityTimer: null,
    notificationSent: false,
    isProcessing: false,
    mode: CHATBOT_DEFAULT_MODE,
    workbench: chatbotDefaultWorkbench(CHATBOT_DEFAULT_MODE)
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

  function chatbotEscapeHTML(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function chatbotModeMeta(mode) {
    return CHATBOT_MODE_META[mode] || CHATBOT_MODE_META.talk;
  }

  function chatbotSetMode(mode, syncReplies) {
    if (!CHATBOT_MODE_META[mode]) mode = CHATBOT_DEFAULT_MODE;
    chatbotState.mode = mode;

    chatbotDOM.modeButtons.forEach(function(btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-agent-mode') === mode);
    });

    var meta = chatbotModeMeta(mode);
    if (chatbotDOM.heroModeBadge) chatbotDOM.heroModeBadge.textContent = meta.label + ' / ' + meta.badge;
    if (chatbotDOM.widgetModeBadge) chatbotDOM.widgetModeBadge.textContent = meta.label;

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

  function chatbotShowTyping(container) {
    if (!container) return;
    var existing = container.querySelector('.chatbot-typing');
    if (existing) return;

    var div = document.createElement('div');
    div.className = 'chat-message mb-4 flex gap-2 chatbot-typing';
    div.innerHTML =
      '<div class="message-avatar glass">\u{1F916}</div>' +
      '<div class="glass rounded-xl typing-indicator" aria-live="polite" aria-label="Asistent pise...">' +
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
      btn.setAttribute('aria-label', 'Rychla odpoved: ' + reply.text);
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
      return (m.role === 'user' ? 'Uzivatel' : 'Asistent') + ': ' + m.content;
    }).join('\n\n');

    var formData = new FormData();
    formData.append('_subject', 'Lukas AI transcript (' + chatbotState.messages.length + ' zprav)');
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

  function chatbotSendToAgent(userMessage) {
    if (chatbotState.isProcessing) return Promise.resolve(null);
    chatbotState.isProcessing = true;
    chatbotState.messages.push({ role: 'user', content: userMessage });
    chatbotResetInactivity();

    var payload = {
      mode: chatbotState.mode,
      messages: chatbotState.messages.map(function(message) {
        return { role: message.role, content: message.content };
      })
    };

    return fetch(CHATBOT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(res) {
      if (!res.ok) {
        return res.json().catch(function() { return {}; }).then(function(data) {
          throw new Error(data.error || data.message || 'Chyba serveru (' + res.status + ')');
        });
      }
      return res.json();
    })
    .then(function(data) {
      var mode = CHATBOT_MODE_META[data.mode] ? data.mode : chatbotState.mode;
      var assistantMsg = data.message || 'Promyslim to s tebou a navrhnu dalsi krok.';
      var result = {
        message: assistantMsg,
        action: data.action || null,
        mode: mode,
        workbench: chatbotNormalizeWorkbench(data.workbench, mode, assistantMsg),
        suggestedReplies: chatbotNormalizeReplies(data.suggestedReplies, mode)
      };

      chatbotState.messages.push({ role: 'assistant', content: assistantMsg });
      chatbotState.isProcessing = false;
      return result;
    })
    .catch(function(err) {
      console.error('Chatbot error:', err);
      chatbotState.isProcessing = false;
      var fallbackMessage = 'Ted zrovna nemuzu odpovedet tak, jak bych chtel. Zkus to za chvili nebo mi dej kratke zadani znovu.';
      chatbotState.messages.push({ role: 'assistant', content: fallbackMessage });
      return {
        message: fallbackMessage,
        action: null,
        mode: chatbotState.mode,
        workbench: chatbotNormalizeWorkbench(null, chatbotState.mode, fallbackMessage),
        suggestedReplies: chatbotNormalizeReplies(null, chatbotState.mode)
      };
    });
  }

  function chatbotHandleSend(text) {
    if (!text || !text.trim()) return;
    text = text.trim();

    if (chatbotDOM.heroInput) chatbotDOM.heroInput.value = '';
    if (chatbotDOM.chatInput) chatbotDOM.chatInput.value = '';

    chatbotHideQuickReplies();
    chatbotRenderBubble(chatbotDOM.heroMessages, 'user', text);
    chatbotRenderBubble(chatbotDOM.messages, 'user', text);

    if (chatbotState.isHeroVisible) chatbotShowTyping(chatbotDOM.heroMessages);
    if (chatbotState.isWidgetOpen) chatbotShowTyping(chatbotDOM.messages);

    chatbotSendToAgent(text).then(function(result) {
      if (!result) return;

      chatbotHideTyping(chatbotDOM.heroMessages);
      chatbotHideTyping(chatbotDOM.messages);

      chatbotSetMode(result.mode, false);
      chatbotRenderBubble(chatbotDOM.heroMessages, 'assistant', result.message);
      chatbotRenderBubble(chatbotDOM.messages, 'assistant', result.message);
      chatbotRenderWorkbench(result.workbench);
      chatbotRenderQuickReplies(chatbotDOM.heroQuickReplies, result.suggestedReplies);
      chatbotRenderQuickReplies(chatbotDOM.quickReplies, result.suggestedReplies);

      if (!chatbotState.isWidgetOpen) {
        chatbotUnreadCount++;
        chatbotUpdateUnreadBadge();
      }

      if (result.action) {
        setTimeout(function() {
          var actions = Array.isArray(result.action) ? result.action : [result.action];
          actions.forEach(function(action, index) {
            setTimeout(function() { chatbotExecuteAction(action); }, index * 250);
          });
        }, 700);
      }
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

  function chatbotShowWelcome() {
    chatbotRenderBubble(chatbotDOM.heroMessages, 'assistant', CHATBOT_WELCOME);
    chatbotRenderBubble(chatbotDOM.messages, 'assistant', CHATBOT_WELCOME);
  }

  function chatbotOpenWidget() {
    if (!chatbotDOM.chatWindow) return;
    chatbotDOM.chatWindow.classList.remove('hidden');
    chatbotState.isWidgetOpen = true;
    chatbotUnreadCount = 0;
    chatbotUpdateUnreadBadge();
    chatbotSyncWidgetMessages();

    if (!chatbotState.messages.length && chatbotDOM.messages) {
      chatbotRenderBubble(chatbotDOM.messages, 'assistant', CHATBOT_WELCOME);
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

    if (chatbotDOM.messages) chatbotRenderBubble(chatbotDOM.messages, 'assistant', CHATBOT_WELCOME);
    chatbotRenderQuickReplies(chatbotDOM.quickReplies, chatbotModeMeta(chatbotState.mode).replies);
    chatbotSetMode(chatbotState.mode, false);
    chatbotUpdateUnreadBadge();
  }

  window.addEventListener('beforeunload', function() {
    chatbotSendTranscript();
  });

  function chatbotInit() {
    chatbotInitHero();
    chatbotInitWidget();
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
    reinit: chatbotInit
  };
})();
