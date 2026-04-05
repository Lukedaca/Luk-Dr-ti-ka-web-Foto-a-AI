/**
 * chatbot.js — Gemma 4 AI chatbot
 * Shared state (window.aiChat) pro Hero chat i floating Widget.
 * Vsechny API requesty jdou pres /.netlify/functions/chat
 */
;(function chatbotIIFE() {
  'use strict';

  // ── Formspree ────────────────────────────────────────────────────────────
  var CHATBOT_FORMSPREE_URL = 'https://formspree.io/f/movlrlzj';
  var CHATBOT_INACTIVITY_MS = 180000; // 3 min

  // ── API endpoint ─────────────────────────────────────────────────────────
  var CHATBOT_API_URL = '/.netlify/functions/chat';

  // ── Default quick replies ────────────────────────────────────────────────
  var CHATBOT_DEFAULT_REPLIES = [
    { text: 'Portréty', value: 'Děláš portrétní focení?' },
    { text: 'Sport',    value: 'Fotíš sportovní akce?' },
    { text: 'Fotograf AI', value: 'Jak funguje Fotograf AI?' },
    { text: 'Ceny',     value: 'Kolik to stojí?' }
  ];

  // ── Welcome message ──────────────────────────────────────────────────────
  var CHATBOT_WELCOME = 'Ahoj! Jsem AI asistent Lukáše. Zeptej se mě na focení, ceny, Fotograf AI nebo cokoliv dalšího.';

  // ── Shared state ─────────────────────────────────────────────────────────
  var chatbotState = {
    messages: [],           // {role:'user'|'assistant', content:string}
    isWidgetOpen: false,
    isHeroVisible: true,
    inactivityTimer: null,
    notificationSent: false,
    isProcessing: false
  };

  // ── DOM cache (populated in init) ────────────────────────────────────────
  var chatbotDOM = {
    // Widget
    chatBtn: null, chatWindow: null, chatInput: null, sendBtn: null,
    closeChat: null, clearChat: null, messages: null, quickReplies: null,
    unreadBadge: null,
    // Hero
    heroInput: null, heroSend: null, heroMessages: null, heroQuickReplies: null
  };

  var chatbotUnreadCount = 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // API COMMUNICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Send user message to Gemma 4 via Netlify function.
   * Returns {message:string, action:object|null}
   */
  function chatbotSendToGemma(userMessage) {
    if (chatbotState.isProcessing) return Promise.resolve(null);
    chatbotState.isProcessing = true;

    // Push user message to shared state
    chatbotState.messages.push({ role: 'user', content: userMessage });

    // Reset inactivity timer
    chatbotResetInactivity();

    // Build request payload — full conversation history
    var payload = {
      messages: chatbotState.messages.map(function(m) {
        return { role: m.role, content: m.content };
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
      var assistantMsg = data.message || 'Omlouvám se, něco se pokazilo.';
      var action = data.action || null;

      // Push assistant message to shared state
      chatbotState.messages.push({ role: 'assistant', content: assistantMsg });
      chatbotState.isProcessing = false;

      return { message: assistantMsg, action: action };
    })
    .catch(function(err) {
      console.error('Chatbot error:', err);
      var errorMsg = 'Omlouvám se, momentálně nemohu odpovědět. Zkus to za chvíli.';
      chatbotState.messages.push({ role: 'assistant', content: errorMsg });
      chatbotState.isProcessing = false;

      return { message: errorMsg, action: null };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function chatbotExecuteAction(action) {
    if (!action || !action.type) return;

    switch (action.type) {
      case 'scroll':
        var scrollTarget = document.getElementById(action.target);
        if (scrollTarget) {
          scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        break;

      case 'filter':
        var filterBtn = document.querySelector('[data-filter="' + action.target + '"]');
        if (filterBtn) {
          filterBtn.click();
        }
        break;

      case 'highlight':
        var highlightTarget = document.getElementById(action.target);
        if (highlightTarget) {
          highlightTarget.classList.add('ai-highlight');
          setTimeout(function() {
            highlightTarget.classList.remove('ai-highlight');
          }, 3000);
        }
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORMSPREE NOTIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  function chatbotSendTranscript() {
    if (chatbotState.notificationSent) return;
    if (chatbotState.messages.length < 2) return;

    chatbotState.notificationSent = true;

    var transcript = chatbotState.messages.map(function(m) {
      var label = m.role === 'user' ? 'Uzivatel' : 'Asistent';
      return label + ': ' + m.content;
    }).join('\n\n');

    var msgCount = chatbotState.messages.length;

    var formData = new FormData();
    formData.append('_subject', 'AI Chat prepis (' + msgCount + ' zprav)');
    formData.append('message', transcript);

    fetch(CHATBOT_FORMSPREE_URL, {
      method: 'POST',
      body: formData,
      headers: { 'Accept': 'application/json' }
    }).catch(function() {
      // Silent fail — non-critical
    });
  }

  function chatbotResetInactivity() {
    if (chatbotState.inactivityTimer) {
      clearTimeout(chatbotState.inactivityTimer);
    }
    chatbotState.inactivityTimer = setTimeout(function() {
      chatbotSendTranscript();
    }, CHATBOT_INACTIVITY_MS);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  function chatbotRenderBubble(container, role, text) {
    if (!container) return;

    var time = new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
    var div = document.createElement('div');
    var isUser = role === 'user';

    div.className = 'chat-message mb-4 flex gap-2' + (isUser ? ' flex-row-reverse' : '');

    var avatarBg = isUser ? 'bg-gradient-to-r from-blue-600 to-purple-600' : 'glass';
    var bubbleBg = isUser ? 'bg-gradient-to-r from-blue-600 to-purple-600' : 'glass';
    var avatar = isUser ? '\u{1F464}' : '\u{1F916}';
    var align = isUser ? 'items-end' : 'items-start';

    div.innerHTML =
      '<div class="message-avatar ' + avatarBg + '">' + avatar + '</div>' +
      '<div class="flex flex-col ' + align + ' max-w-xs">' +
        '<div class="p-3 rounded-xl ' + bubbleBg + '">' + chatbotEscapeHTML(text) + '</div>' +
        '<div class="message-time">' + time + '</div>' +
      '</div>';

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function chatbotShowTyping(container) {
    if (!container) return;

    var existing = container.querySelector('.chatbot-typing');
    if (existing) return; // already showing

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

    replies.forEach(function(r) {
      var btn = document.createElement('button');
      btn.className = 'quick-reply-btn glass px-4 py-2 rounded-full text-sm mr-2 mb-2';
      btn.setAttribute('data-value', r.value);
      btn.setAttribute('aria-label', 'Rychla odpoved: ' + r.text);
      btn.textContent = r.text;
      btn.addEventListener('click', function() {
        chatbotHandleSend(r.value);
      });
      container.appendChild(btn);
    });
  }

  function chatbotEscapeHTML(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UNIFIED SEND HANDLER
  // ═══════════════════════════════════════════════════════════════════════════

  function chatbotHandleSend(text) {
    if (!text || !text.trim()) return;
    text = text.trim();

    // Clear inputs
    if (chatbotDOM.heroInput) chatbotDOM.heroInput.value = '';
    if (chatbotDOM.chatInput) chatbotDOM.chatInput.value = '';

    // Hide quick replies in both containers
    chatbotHideQuickReplies();

    // Render user bubble in both containers
    chatbotRenderBubble(chatbotDOM.heroMessages, 'user', text);
    chatbotRenderBubble(chatbotDOM.messages, 'user', text);

    // Show typing in active container(s)
    if (chatbotState.isHeroVisible && chatbotDOM.heroMessages) {
      chatbotShowTyping(chatbotDOM.heroMessages);
    }
    if (chatbotState.isWidgetOpen && chatbotDOM.messages) {
      chatbotShowTyping(chatbotDOM.messages);
    }

    // Send to Gemma
    chatbotSendToGemma(text).then(function(result) {
      if (!result) return;

      // Hide typing
      chatbotHideTyping(chatbotDOM.heroMessages);
      chatbotHideTyping(chatbotDOM.messages);

      // Render assistant bubble in both containers
      chatbotRenderBubble(chatbotDOM.heroMessages, 'assistant', result.message);
      chatbotRenderBubble(chatbotDOM.messages, 'assistant', result.message);

      // Update unread if widget is closed
      if (!chatbotState.isWidgetOpen) {
        chatbotUnreadCount++;
        chatbotUpdateUnreadBadge();
      }

      // Execute page action(s) with slight delay so user sees the message first
      if (result.action) {
        setTimeout(function() {
          var actions = Array.isArray(result.action) ? result.action : [result.action];
          actions.forEach(function(act, i) {
            setTimeout(function() { chatbotExecuteAction(act); }, i * 300);
          });
        }, 800);
      }
    });
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

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNC WIDGET — copy state messages into widget container
  // ═══════════════════════════════════════════════════════════════════════════

  function chatbotSyncWidgetMessages() {
    if (!chatbotDOM.messages) return;
    chatbotDOM.messages.innerHTML = '';

    chatbotState.messages.forEach(function(m) {
      chatbotRenderBubble(chatbotDOM.messages, m.role, m.content);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEAR / RESET
  // ═══════════════════════════════════════════════════════════════════════════

  function chatbotClearState() {
    chatbotState.messages = [];
    chatbotState.notificationSent = false;
    chatbotState.isProcessing = false;
    if (chatbotState.inactivityTimer) {
      clearTimeout(chatbotState.inactivityTimer);
      chatbotState.inactivityTimer = null;
    }

    // Clear both containers
    if (chatbotDOM.heroMessages) chatbotDOM.heroMessages.innerHTML = '';
    if (chatbotDOM.messages) chatbotDOM.messages.innerHTML = '';

    // Show welcome + quick replies
    chatbotShowWelcome();
  }

  function chatbotShowWelcome() {
    chatbotRenderBubble(chatbotDOM.heroMessages, 'assistant', CHATBOT_WELCOME);
    chatbotRenderBubble(chatbotDOM.messages, 'assistant', CHATBOT_WELCOME);
    chatbotRenderQuickReplies(chatbotDOM.heroQuickReplies, CHATBOT_DEFAULT_REPLIES);
    chatbotRenderQuickReplies(chatbotDOM.quickReplies, CHATBOT_DEFAULT_REPLIES);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HERO CHAT INIT
  // ═══════════════════════════════════════════════════════════════════════════

  function chatbotInitHero() {
    chatbotDOM.heroInput = document.getElementById('hero-input');
    chatbotDOM.heroSend = document.getElementById('hero-send');
    chatbotDOM.heroMessages = document.getElementById('hero-messages');
    chatbotDOM.heroQuickReplies = document.getElementById('hero-quick-replies');

    if (!chatbotDOM.heroMessages) return; // Hero HTML not yet in DOM

    // Enter key sends
    if (chatbotDOM.heroInput) {
      chatbotDOM.heroInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          chatbotHandleSend(chatbotDOM.heroInput.value);
        }
      });
    }

    // Send button
    if (chatbotDOM.heroSend) {
      chatbotDOM.heroSend.addEventListener('click', function() {
        chatbotHandleSend(chatbotDOM.heroInput ? chatbotDOM.heroInput.value : '');
      });
    }

    // IntersectionObserver for hero visibility
    var heroSection = document.getElementById('hero') || document.getElementById('hero-chat');
    if (heroSection) {
      var chatbotHeroObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          chatbotState.isHeroVisible = entry.isIntersecting;
        });
      }, { threshold: 0.1 });
      chatbotHeroObserver.observe(heroSection);
    }

    // Render welcome + quick replies in hero
    chatbotRenderBubble(chatbotDOM.heroMessages, 'assistant', CHATBOT_WELCOME);
    chatbotRenderQuickReplies(chatbotDOM.heroQuickReplies, CHATBOT_DEFAULT_REPLIES);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WIDGET CHAT INIT
  // ═══════════════════════════════════════════════════════════════════════════

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

    if (!chatbotDOM.chatBtn) return; // Widget HTML not in DOM

    // Toggle open/close
    chatbotDOM.chatBtn.addEventListener('click', function() {
      if (chatbotState.isWidgetOpen) {
        chatbotCloseWidget();
      } else {
        chatbotOpenWidget();
      }
    });

    // Close button
    if (chatbotDOM.closeChat) {
      chatbotDOM.closeChat.addEventListener('click', function() {
        chatbotCloseWidget();
      });
    }

    // Clear button
    if (chatbotDOM.clearChat) {
      chatbotDOM.clearChat.addEventListener('click', function() {
        chatbotClearState();
      });
    }

    // Send button
    if (chatbotDOM.sendBtn) {
      chatbotDOM.sendBtn.addEventListener('click', function() {
        chatbotHandleSend(chatbotDOM.chatInput ? chatbotDOM.chatInput.value : '');
      });
    }

    // Enter key
    if (chatbotDOM.chatInput) {
      chatbotDOM.chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          chatbotHandleSend(chatbotDOM.chatInput.value);
        }
      });
    }

    // Render welcome + quick replies in widget
    if (chatbotDOM.messages) {
      chatbotRenderBubble(chatbotDOM.messages, 'assistant', CHATBOT_WELCOME);
    }
    chatbotRenderQuickReplies(chatbotDOM.quickReplies, CHATBOT_DEFAULT_REPLIES);

    chatbotUpdateUnreadBadge();
  }

  function chatbotOpenWidget() {
    if (!chatbotDOM.chatWindow) return;
    chatbotDOM.chatWindow.classList.remove('hidden');
    chatbotState.isWidgetOpen = true;
    chatbotUnreadCount = 0;
    chatbotUpdateUnreadBadge();

    // Sync messages from shared state into widget container
    chatbotSyncWidgetMessages();

    // If no messages yet (only welcome was shown before clear), show welcome
    if (chatbotState.messages.length === 0 && chatbotDOM.messages) {
      chatbotRenderBubble(chatbotDOM.messages, 'assistant', CHATBOT_WELCOME);
      chatbotRenderQuickReplies(chatbotDOM.quickReplies, CHATBOT_DEFAULT_REPLIES);
    }
  }

  function chatbotCloseWidget() {
    if (!chatbotDOM.chatWindow) return;
    chatbotDOM.chatWindow.classList.add('hidden');
    chatbotState.isWidgetOpen = false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BEFOREUNLOAD — send transcript if conversation exists
  // ═══════════════════════════════════════════════════════════════════════════

  window.addEventListener('beforeunload', function() {
    chatbotSendTranscript();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  function chatbotInit() {
    chatbotInitHero();
    chatbotInitWidget();
  }

  // Run init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', chatbotInit);
  } else {
    chatbotInit();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API — window.aiChat
  // ═══════════════════════════════════════════════════════════════════════════

  window.aiChat = {
    state: chatbotState,
    send: chatbotHandleSend,
    clear: chatbotClearState,
    openWidget: chatbotOpenWidget,
    closeWidget: chatbotCloseWidget,
    reinit: chatbotInit
  };

})();
