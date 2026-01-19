/**
 * Enhanced AI Chatbot module
 * Lazy loaded on chat button click
 */

const storage = window.LD_storage || {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  remove: (k) => { try { localStorage.removeItem(k); } catch {} }
};

class EnhancedChatbot {
  constructor() {
    this.conversationHistory = [];
    this.isChatOpen = false;
    this.userContext = { intent: null, entities: {}, sentiment: 'neutral', lastTopic: null };
    this.knowledgeBase = this.buildKnowledgeBase();
    this.synonyms = this.buildSynonyms();
    this.intents = this.buildIntents();
    this.sentimentWords = {
      positive: ['skv\u011ble', 'super', 'd\u00edky', 'perfektn\u00ed', 'v\u00fdborn\u011b', 'ano'],
      negative: ['probl\u00e9m', 'nefunguje', '\u0161patn\u00e9', 'nel\u00edb\u00ed', 'bohu\u017eel', 'nejde']
    };
    this.faq = [
      { patterns: ['jak dlouho', 'trv\u00e1 focen\u00ed'], answer: 'Portr\u00e9tn\u00ed session 1-2 hodiny, sport dle akce.' },
      { patterns: ['kdy dostanu', 'dod\u00e1n\u00ed fotek'], answer: 'Fotky dod\u00e1v\u00e1m do 7-14 dn\u016f.' },
      { patterns: ['kde fot\u00edte', 'lokalita'], answer: 'S\u00eddl\u00edm v P\u0159erov\u011b, fot\u00edm po cel\u00e9 Morav\u011b.' }
    ];
    this.defaultQuickReplies = [
      { text: '\ud83d\udcf7 Portr\u00e9ty', value: 'D\u011bl\u00e1\u0161 portr\u00e9tn\u00ed focen\u00ed?' },
      { text: '\ud83c\udfdf\ufe0f Sport', value: 'Fot\u00ed\u0161 sportovn\u00ed akce?' },
      { text: '\u2728 Fotograf AI', value: 'Jak funguje Fotograf AI?' },
      { text: '\ud83d\udcb0 Ceny', value: 'Kolik to stoj\u00ed?' }
    ];
  }

  buildKnowledgeBase() {
    return {
      services: {
        photography: {
          portrait: { description: 'Portr\u00e9tn\u00ed fotografie v ateli\u00e9ru i venku', keywords: ['portr\u00e9t', 'portrait', 'lid\u00e9', 'osoba'] },
          sport: { description: 'Sportovn\u00ed a ak\u010dn\u00ed fotografie', keywords: ['sport', 'akce', 'z\u00e1pas', 'tr\u00e9nink'] }
        },
        ai: {
          fotograf_ai: { description: 'Fotograf AI pro rychlou postprodukci', keywords: ['fotograf ai', 'postprodukce', 'retu\u0161'] },
          automation: { description: 'Automatizace workflow', keywords: ['automatizace', 'workflow'] }
        }
      },
      contact: { email: 'lukas.drsticka@gmail.com', location: 'P\u0159erov' }
    };
  }

  buildSynonyms() {
    return {
      greeting: ['ahoj', '\u010dau', 'nazdar', 'dobr\u00fd den', 'hello', 'hi'],
      thanks: ['d\u011bkuji', 'd\u00edk', 'd\u00edky', 'thanks'],
      price_inquiry: ['cena', 'cen\u00edk', 'kolik', 'stoj\u00ed', 'rozpo\u010det'],
      booking: ['term\u00edn', 'rezervace', 'rezervovat', 'domluvit']
    };
  }

  buildIntents() {
    return {
      greeting: {
        patterns: ['ahoj', '\u010dau', 'dobr\u00fd den', 'nazdar', 'hello', 'hi'],
        responses: ['Ahoj! Jsem AI asistent Luk\u00e1\u0161e. Jak ti m\u016f\u017eu pomoct?', 'Zdrav\u00edm! Co t\u011b zaj\u00edm\u00e1?']
      },
      thanks: {
        patterns: ['d\u011bkuji', 'd\u00edk', 'd\u00edky', 'thanks'],
        responses: ['R\u00e1do se stalo!', 'Nen\u00ed za\u010d!']
      },
      capabilities: {
        patterns: ['co um\u00ed\u0161', 'co d\u011bl\u00e1\u0161', 'slu\u017eby'],
        responses: ['Um\u00edm poradit se sportovn\u00ed i portr\u00e9tn\u00ed fotkou, postprodukc\u00ed a AI slu\u017ebami.']
      },
      price_inquiry: {
        patterns: ['kolik', 'cena', 'cen\u00edk', 'stoj\u00ed'],
        responses: ['Ceny jsou individu\u00e1ln\u00ed podle rozsahu. Napi\u0161 stru\u010dn\u011b zad\u00e1n\u00ed: lukas.drsticka@gmail.com']
      },
      booking: {
        patterns: ['term\u00edn', 'rezervace', 'domluvit'],
        responses: ['Jasn\u011b, napi\u0161 datum, m\u00edsto a typ focen\u00ed (sport/portr\u00e9t).']
      },
      contact_request: {
        patterns: ['kontakt', 'email', 'napsat'],
        responses: ['Email: lukas.drsticka@gmail.com - klidn\u011b napi\u0161!']
      },
      fotograf_ai: {
        patterns: ['fotograf ai', 'semiagent', 'ai postprodukce'],
        responses: ['Fotograf AI je moje semiagent aplikace pro rychlou postprodukci.']
      }
    };
  }

  normalizeText(text) {
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  detectIntent(text) {
    const normalized = this.normalizeText(text);
    let bestIntent = null, maxConfidence = 0;

    Object.entries(this.intents).forEach(([intentName, intentData]) => {
      const patterns = [...intentData.patterns, ...(this.synonyms[intentName] || [])];
      patterns.forEach(pattern => {
        const normalizedPattern = this.normalizeText(pattern);
        let score = 0;
        if (normalized === normalizedPattern) score = 1.0;
        else if (normalized.includes(normalizedPattern)) score = 0.9;
        else if (normalizedPattern.includes(normalized)) score = 0.85;
        if (score > maxConfidence) { maxConfidence = score; bestIntent = intentName; }
      });
    });

    return { intent: bestIntent, confidence: maxConfidence };
  }

  extractEntities(text) {
    const entities = { services: [] };
    const normalized = this.normalizeText(text);
    Object.entries(this.knowledgeBase.services).forEach(([category, services]) => {
      Object.entries(services).forEach(([service, data]) => {
        data.keywords.forEach(keyword => {
          if (normalized.includes(this.normalizeText(keyword))) {
            entities.services.push({ category, service, data });
          }
        });
      });
    });
    return entities;
  }

  analyzeSentiment(input) {
    const normalized = this.normalizeText(input);
    let score = 0;
    this.sentimentWords.positive.forEach(w => normalized.includes(this.normalizeText(w)) && score++);
    this.sentimentWords.negative.forEach(w => normalized.includes(this.normalizeText(w)) && score--);
    return score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
  }

  findFaqAnswer(input) {
    const normalized = this.normalizeText(input);
    for (const item of this.faq) {
      if (item.patterns.some(p => normalized.includes(this.normalizeText(p)))) return item.answer;
    }
    return null;
  }

  generateResponse(userMessage) {
    const intentResult = this.detectIntent(userMessage);
    const entities = this.extractEntities(userMessage);

    if (entities.services.length > 0) {
      const service = entities.services[0];
      return { response: `${service.data.description}. Chce\u0161 v\u011bd\u011bt v\u00edc?`, confidence: 0.85, intent: 'service_info' };
    }

    if (intentResult.intent && intentResult.confidence > 0.6) {
      const responses = this.intents[intentResult.intent].responses;
      return { response: responses[Math.floor(Math.random() * responses.length)], confidence: intentResult.confidence, intent: intentResult.intent };
    }

    return { response: 'Zaj\u00edmav\u00e1 ot\u00e1zka! M\u016f\u017eu poradit s focen\u00edm, Fotograf AI nebo cenami.', confidence: 0.3, intent: 'fallback' };
  }

  getContextualQuickReplies() {
    return this.defaultQuickReplies;
  }

  saveSession() {
    storage.set('chatbot_session', JSON.stringify({ history: this.conversationHistory, context: this.userContext, timestamp: Date.now() }));
  }

  loadSession() {
    const saved = JSON.parse(storage.get('chatbot_session') || 'null');
    if (saved && Date.now() - saved.timestamp < 86400000) {
      this.conversationHistory = saved.history || [];
      this.userContext = saved.context || this.userContext;
      return true;
    }
    return false;
  }
}

// Chat UI
const chatbot = new EnhancedChatbot();
const chatWindow = document.getElementById('chatWindow');
const closeChat = document.getElementById('closeChat');
const clearChat = document.getElementById('clearChat');
const messagesEl = document.getElementById('messages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const unreadBadge = document.getElementById('unreadBadge');
const quickReplies = document.getElementById('quickReplies');
const chatBtn = document.getElementById('chatBtn');

let unreadCount = 0;

function addMessage(sender, text, confidence = null, intent = null, isHistory = false) {
  const time = new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  const div = document.createElement('div');
  div.className = `chat-message mb-4 flex gap-2 ${sender === 'user' ? 'flex-row-reverse' : ''}`;
  const avatar = sender === 'user' ? '\ud83d\udc64' : '\ud83e\udd16';
  const avatarBg = sender === 'user' ? 'bg-gradient-to-r from-blue-600 to-purple-600' : 'glass';
  div.innerHTML = `
    <div class="message-avatar ${avatarBg}">${avatar}</div>
    <div class="flex flex-col ${sender === 'user' ? 'items-end' : 'items-start'} max-w-xs">
      <div class="p-3 rounded-xl ${sender === 'user' ? 'bg-gradient-to-r from-blue-600 to-purple-600' : 'glass'}">${text}</div>
      <div class="message-time">${time}</div>
    </div>
  `;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  if (!isHistory && sender === 'bot' && !chatbot.isChatOpen) {
    unreadCount++;
    updateUnreadBadge();
  }
}

function showTypingIndicator() {
  const div = document.createElement('div');
  div.id = 'typingIndicator';
  div.className = 'chat-message mb-4 flex gap-2';
  div.innerHTML = `<div class="message-avatar glass">\ud83e\udd16</div><div class="glass rounded-xl typing-indicator"><span></span><span></span><span></span></div>`;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeTypingIndicator() {
  document.getElementById('typingIndicator')?.remove();
}

function renderQuickReplies() {
  const replies = chatbot.getContextualQuickReplies();
  quickReplies.innerHTML = replies.map(r => `<button class="quick-reply-btn glass px-4 py-2 rounded-full text-sm mr-2 mb-2">${r.text}</button>`).join('');
  quickReplies.classList.remove('hidden');
  quickReplies.querySelectorAll('button').forEach((btn, i) => {
    btn.addEventListener('click', () => { chatInput.value = replies[i].value; sendMessage(); quickReplies.classList.add('hidden'); });
  });
}

function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  quickReplies.classList.add('hidden');
  addMessage('user', text);
  chatInput.value = '';
  chatbot.conversationHistory.push({ role: 'user', message: text, timestamp: Date.now() });
  showTypingIndicator();
  setTimeout(() => {
    removeTypingIndicator();
    const faqAnswer = chatbot.findFaqAnswer(text);
    if (faqAnswer) {
      addMessage('bot', faqAnswer);
      chatbot.conversationHistory.push({ role: 'bot', message: faqAnswer, timestamp: Date.now() });
    } else {
      const responseObj = chatbot.generateResponse(text);
      const sentiment = chatbot.analyzeSentiment(text);
      let responseText = responseObj.response;
      if (sentiment === 'negative') responseText = 'Ch\u00e1pu. ' + responseText;
      addMessage('bot', responseText, responseObj.confidence, responseObj.intent);
      chatbot.conversationHistory.push({ role: 'bot', message: responseText, timestamp: Date.now() });
    }
    renderQuickReplies();
    chatbot.saveSession();
  }, 1000);
}

function updateUnreadBadge() {
  if (unreadCount > 0) { unreadBadge.textContent = unreadCount; unreadBadge.classList.remove('hidden'); }
  else { unreadBadge.classList.add('hidden'); }
}

function openChat() {
  chatWindow.classList.remove('hidden');
  chatbot.isChatOpen = true;
  unreadCount = 0;
  updateUnreadBadge();
  if (messagesEl.children.length === 0) {
    addMessage('bot', 'Ahoj! Tady Luk\u00e1\u0161. M\u00e1m AI asistenta, kter\u00fd ti pom\u016f\u017ee. Na co se chce\u0161 zeptat?', 0.95, 'greeting');
    renderQuickReplies();
  }
}

function closeChatWindow() {
  chatWindow.classList.add('hidden');
  chatbot.isChatOpen = false;
}

// Load session
if (chatbot.loadSession() && chatbot.conversationHistory.length) {
  chatbot.conversationHistory.forEach(entry => addMessage(entry.role, entry.message, null, null, true));
}

// Event listeners
chatBtn?.addEventListener('click', () => chatbot.isChatOpen ? closeChatWindow() : openChat());
closeChat?.addEventListener('click', closeChatWindow);
clearChat?.addEventListener('click', () => {
  if (confirm('Smazat historii?')) {
    messagesEl.innerHTML = '';
    storage.remove('chatbot_session');
    chatbot.conversationHistory = [];
    addMessage('bot', 'Historie smaz\u00e1na. M\u016f\u017eeme za\u010d\u00edt znovu!', 1.0, 'system');
    renderQuickReplies();
  }
});
sendBtn?.addEventListener('click', sendMessage);
chatInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && chatbot.isChatOpen) closeChatWindow(); });

// Auto-open chat
openChat();
