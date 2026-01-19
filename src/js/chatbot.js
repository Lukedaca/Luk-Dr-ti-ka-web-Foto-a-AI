/**
 * Chatbot module - lazy loaded on first chat button click
 * Contains EnhancedChatbot class and chat UI
 */

const storage = window.appStorage || {
    get: (k) => { try { return localStorage.getItem(k); } catch(e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch(e) {} },
    remove: (k) => { try { localStorage.removeItem(k); } catch(e) {} }
};

class EnhancedChatbot {
    constructor() {
        this.conversationHistory = [];
        this.isChatOpen = false;
        this.userContext = {
            intent: null,
            entities: {},
            sentiment: 'neutral',
            lastTopic: null
        };
        this.onOpenChat = null;
        this.onCloseChat = null;

        this.knowledgeBase = this.buildKnowledgeBase();
        this.synonyms = this.buildSynonyms();
        this.intents = this.buildIntents();
        this.sentimentWords = {
            positive: ['skvěle', 'super', 'díky', 'perfektní', 'výborně', 'ano'],
            negative: ['problém', 'nefunguje', 'špatné', 'nelíbí', 'bohužel', 'nejde']
        };
        this.faq = [
            { patterns: ['jak dlouho', 'trvá focení'], answer: 'Portrétní session 1-2 hodiny, sport dle akce.' },
            { patterns: ['kdy dostanu', 'dodání fotek'], answer: 'Fotky dodávám do 7-14 dnů.' },
            { patterns: ['kde fotíte', 'lokalita'], answer: 'Sídlím v Přerově, fotím po celé Moravě.' },
            { patterns: ['co je fotograf ai'], answer: 'Moje autorská aplikace pro AI postprodukci fotek.' },
            { patterns: ['formát', 'raw', 'jpg'], answer: 'Standardně JPEG, RAW na vyžádání.' }
        ];
        this.defaultQuickReplies = [
            { text: '📷 Portréty', value: 'Děláš portrétní focení?' },
            { text: '🏟️ Sport', value: 'Fotíš sportovní akce?' },
            { text: '✨ Fotograf AI', value: 'Jak funguje Fotograf AI?' },
            { text: '💰 Ceny', value: 'Kolik to stojí?' }
        ];

        this.init();
    }

    buildKnowledgeBase() {
        return {
            services: {
                photography: {
                    portrait: {
                        description: 'Portrétní fotografie v ateliéru i venku s důrazem na výraz a světlo',
                        keywords: ['portrét', 'portrait', 'lidé', 'osoba', 'portrétní']
                    },
                    sport: {
                        description: 'Sportovní a akční fotografie s důrazem na timing',
                        keywords: ['sport', 'akce', 'akční', 'zápas', 'trénink']
                    },
                    action: {
                        description: 'Akční sekvence a série snímků pro dynamický příběh',
                        keywords: ['sekvence', 'série', 'pohyb', 'dynamika']
                    }
                },
                ai: {
                    fotograf_ai: {
                        description: 'Fotograf AI (semiagent) pro rychlou postprodukci a konzistentní styl',
                        keywords: ['fotograf ai', 'fotograf', 'ai postprodukce', 'postprodukce', 'retuš']
                    },
                    vibecoding: {
                        description: 'Vibecoding a prototypování s Claude, Gemini, ChatGPT a Codex',
                        keywords: ['vibecoding', 'claude', 'gemini', 'chatgpt', 'codex']
                    },
                    agent_coding: {
                        description: 'Agentní kódování pro rychlé iterace a automatizaci workflow',
                        keywords: ['agentní', 'agent', 'agentní kódování']
                    },
                    automation: {
                        description: 'Automatizace workflow a procesů',
                        keywords: ['automatizace', 'automatický', 'proces', 'workflow']
                    }
                }
            },
            contact: {
                email: 'lukas.drsticka@gmail.com',
                location: 'Přerov'
            }
        };
    }

    buildSynonyms() {
        return {
            greeting: ['ahoj', 'čau', 'nazdar', 'dobrý den', 'hello', 'hi', 'hej'],
            thanks: ['děkuji', 'dík', 'díky', 'thanks'],
            price_inquiry: ['cena', 'ceník', 'kolik', 'stojí', 'rozpočet'],
            contact_request: ['kontakt', 'napsat', 'email', 'telefon'],
            booking: ['termín', 'rezervace', 'rezervovat', 'domluvit', 'schůzka'],
            availability: ['dostupnost', 'volný', 'kdy můžeš', 'kdy máš'],
            delivery_time: ['dodání', 'termín dodání', 'kdy budou', 'jak dlouho'],
            portrait: ['portrét', 'portrétní', 'portrait', 'lidé'],
            sport: ['sport', 'zápas', 'trénink', 'akce'],
            postproduction: ['postprodukce', 'retuš', 'úpravy'],
            fotograf_ai: ['fotograf ai', 'ai postprodukce', 'semiagent'],
            ai_stack: ['chatgpt', 'codex', 'claude', 'gemini', 'vibecoding', 'agentní'],
            portfolio: ['portfolio', 'ukázka', 'reference', 'práce']
        };
    }

    buildIntents() {
        return {
            greeting: {
                patterns: ['ahoj', 'čau', 'dobrý den', 'nazdar', 'hej', 'hello', 'hi'],
                responses: [
                    'Ahoj! Jsem AI asistent Lukáše. Jak ti můžu pomoct?',
                    'Zdravím! Co tě zajímá - sportovní, portrétní focení nebo AI/automatizace?'
                ]
            },
            thanks: {
                patterns: ['děkuji', 'dík', 'díky', 'thanks'],
                responses: [
                    'Rádo se stalo! Pokud chceš, napiš pár detailů (termín, místo, očekávání).',
                    'Není zač! Můžeme rovnou domluvit termín nebo projít portfolio.'
                ]
            },
            capabilities: {
                patterns: ['co umíš', 'co děláš', 'co nabízíš', 'služby', 'schopnosti', 'co zvládáš', 'jak mi pomůžeš'],
                responses: [
                    'Umím poradit se sportovní i portrétní fotkou, postprodukcí (Fotograf AI) a AI/automatizacemi. Co je pro tebe priorita?',
                    'Jsem tady pro info o focení, cenách, termínech, dodání a AI službách. Na co se chceš zeptat?',
                    'Pomůžu s výběrem služby, domluvou termínu i vysvětlením, co je Fotograf AI. Co tě zajímá?'
                ]
            },
            assistant_info: {
                patterns: ['co umíš jako asistent', 'co umí asistent', 'jak umíš pomoct', 'co je tvůj účel', 'kdo jsi', 'jsi chatbot', 'jsi asistent'],
                responses: [
                    'Jsem offline asistent na tomto webu. Umím poradit s focením, cenami, termíny, dodáním a AI službami.',
                    'Jako asistent odpovídám na dotazy o službách, ukázkách a kontaktu. Můžu i pomoci s domluvou termínu.',
                    'Jsem tu, abych rychle nasměroval k informacím o focení, postprodukci a AI projektech. Co potřebuješ?'
                ]
            },
            portfolio: {
                patterns: ['portfolio', 'ukázky', 'ukázka', 'reference', 'práce'],
                responses: [
                    'Portfolio najdeš přímo na stránce. Chceš sportovní nebo portrétní ukázky?',
                    'Rád pošlu konkrétní ukázky – napiš, jestli řešíš sport nebo portrét.'
                ]
            },
            price_inquiry: {
                patterns: ['kolik', 'cena', 'ceník', 'stojí', 'price'],
                responses: [
                    'Ceny jsou individuální podle rozsahu, termínu a lokality. Napiš stručně zadání a ozvu se: lukas.drsticka@gmail.com'
                ]
            },
            booking: {
                patterns: ['termín', 'rezervace', 'rezervovat', 'domluvit', 'schůzka'],
                responses: [
                    'Jasně, napiš prosím datum, místo a typ focení (sport/portrét).',
                    'Pošli termín, lokaci a očekávání – připravím návrh.'
                ]
            },
            availability: {
                patterns: ['dostupnost', 'volný', 'kdy můžeš', 'kdy máš'],
                responses: [
                    'Dostupnost řeším individuálně. Pošli prosím termín a místo.',
                    'Napiš, kdy a kde potřebuješ fotit, a ozvu se s potvrzením.'
                ]
            },
            delivery_time: {
                patterns: ['dodání', 'termín dodání', 'kdy budou', 'jak dlouho'],
                responses: [
                    'Dodání se liší podle rozsahu. Orientačně to upřesním po zadání.',
                    'Jakmile znám rozsah, řeknu ti přesný termín dodání.'
                ]
            },
            contact_request: {
                patterns: ['kontakt', 'email', 'napsat', 'oslovit'],
                responses: [
                    'Email: lukas.drsticka@gmail.com - klidně napiš!'
                ]
            },
            postproduction: {
                patterns: ['postprodukce', 'retuš', 'úpravy', 'ai postprodukce'],
                responses: [
                    'Postprodukci řeším přes Fotograf AI (semiagent), takže dodání je rychlé a konzistentní.',
                    'Fotograf AI mi drží styl napříč sérií a urychluje retuš.'
                ]
            },
            fotograf_ai: {
                patterns: ['fotograf ai', 'semiagent', 'ai postprodukce'],
                responses: [
                    'Fotograf AI je moje semiagent aplikace pro rychlou postprodukci a jednotný look.',
                    'Fotograf AI výrazně zkracuje čas postprodukce bez ztráty kvality.'
                ]
            },
            ai_stack: {
                patterns: ['vibecoding', 'claude', 'gemini', 'chatgpt', 'codex', 'agentní'],
                responses: [
                    'Tech stack: vibecoding s Claude, Gemini, ChatGPT a Codex. K tomu agentní workflow pro automatizace.',
                    'Používám Claude/Gemini/ChatGPT/Codex a agentní kódování pro rychlé iterace.'
                ]
            }
        };
    }

    init() {
        this.initScrollTriggers();
        this.initIdlePrompt();
    }

    setChatHandlers(openHandler, closeHandler) {
        this.onOpenChat = openHandler;
        this.onCloseChat = closeHandler;
    }

    openChat() {
        if (this.onOpenChat) this.onOpenChat();
        this.isChatOpen = true;
        if (this.resetIdleTimer) this.resetIdleTimer();
    }

    closeChat() {
        if (this.onCloseChat) this.onCloseChat();
        this.isChatOpen = false;
    }

    normalizeText(text) {
        return text.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }

    levenshteinDistance(str1, str2) {
        const m = str1.length, n = str2.length;
        const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                dp[i][j] = str1[i - 1] === str2[j - 1]
                    ? dp[i - 1][j - 1]
                    : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
        return dp[m][n];
    }

    wordSimilarity(word1, word2) {
        const distance = this.levenshteinDistance(word1.toLowerCase(), word2.toLowerCase());
        return 1 - distance / Math.max(word1.length, word2.length);
    }

    detectIntent(text) {
        const normalized = this.normalizeText(text);
        const normalizedWords = normalized.split(/\s+/).filter(Boolean);
        let bestIntent = null;
        let maxConfidence = 0;

        Object.entries(this.intents).forEach(([intentName, intentData]) => {
            let maxScore = 0;

            const patterns = [
                ...intentData.patterns,
                ...(this.synonyms[intentName] || [])
            ];

            patterns.forEach(pattern => {
                const normalizedPattern = this.normalizeText(pattern);
                let score = 0;

                if (normalized === normalizedPattern) {
                    score = 1.0;
                } else if (normalized.includes(normalizedPattern)) {
                    score = 0.9;
                } else if (normalizedPattern.includes(normalized)) {
                    score = 0.85;
                } else {
                    const words = normalizedPattern.split(' ').filter(Boolean);
                    const hits = words.filter(word => normalized.includes(word));
                    if (words.length && hits.length === words.length) {
                        score = 0.75;
                    }
                }

                normalizedWords.forEach(word => {
                    if (this.wordSimilarity(word, normalizedPattern) > 0.75) {
                        score += 0.8;
                    }
                });

                if (score > maxScore) maxScore = score;
            });

            if (maxScore > maxConfidence) {
                maxConfidence = maxScore;
                bestIntent = intentName;
            }
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
                        entities.services.push({category, service, data});
                    }
                });
            });
        });

        return entities;
    }

    getConversationContext() {
        const recent = this.conversationHistory.slice(-5);
        const lastWithIntent = [...recent].reverse().find(m => m.intent);
        return {
            lastIntent: lastWithIntent?.intent,
            mentionedServices: recent
                .filter(m => m.entities?.services)
                .flatMap(m => m.entities.services),
            messageCount: recent.length
        };
    }

    analyzeSentiment(input) {
        const normalized = this.normalizeText(input);
        let score = 0;
        this.sentimentWords.positive.forEach(w => normalized.includes(this.normalizeText(w)) && score++);
        this.sentimentWords.negative.forEach(w => normalized.includes(this.normalizeText(w)) && score--);
        return score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
    }

    getContextualQuickReplies() {
        const ctx = this.getConversationContext();
        const lastIntent = ctx.lastIntent || this.userContext.intent;
        if (lastIntent === 'photography') {
            return [
                { text: ' ⏰ Termíny', value: 'Jaké máte termíny?' },
                { text: ' 📍 Kde fotíte?', value: 'Kde fotíte?' }
            ];
        }
        if (lastIntent === 'ai_services') {
            return [
                { text: ' ✨ Fotograf AI', value: 'Co je Fotograf AI?' },
                { text: ' 🤖 Chatboty', value: 'Děláte chatboty?' }
            ];
        }
        return this.defaultQuickReplies;
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
            this.userContext.lastTopic = service.service;
            return {
                response: `${service.data.description}. Chceš vědět víc o cenách nebo kontaktu?`,
                confidence: 0.85,
                intent: 'service_info'
            };
        }

        if (intentResult.intent && intentResult.confidence > 0.6) {
            const responses = this.intents[intentResult.intent].responses;
            this.userContext.intent = intentResult.intent;
            return {
                response: responses[Math.floor(Math.random() * responses.length)],
                confidence: intentResult.confidence,
                intent: intentResult.intent
            };
        }

        return {
            response: 'Zajímavá otázka! Můžu poradit se sportovní/portrétní fotkou, Fotograf AI nebo cenami. Co z toho je pro tebe nejdůležitější?',
            confidence: 0.3,
            intent: 'fallback'
        };
    }

    addUserMessage(message, entities = {}) {
        this.conversationHistory.push({
            role: 'user',
            message,
            entities,
            timestamp: Date.now()
        });
    }

    addBotMessage(message, confidence, intent) {
        this.conversationHistory.push({
            role: 'bot',
            message, confidence, intent,
            timestamp: Date.now()
        });

        if (intent === 'proactive' && this.isChatOpen) {
            addMessage('bot', message, confidence, intent);
        }
    }

    initScrollTriggers() {
        const triggers = {
            'portfolio': 'Líbí se vám něco z portfolia? Rád zodpovím dotazy!',
            'kontakt': 'Potřebujete pomoct s kontaktním formulářem?',
            'skills': 'Zajímá vás některá z mých dovedností více?'
        };
        const shown = {};

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const id = entry.target.id;
                if (entry.isIntersecting && !shown[id] && triggers[id] && this.isChatOpen) {
                    shown[id] = true;
                    setTimeout(() => {
                        this.addBotMessage(triggers[id], 0.9, 'proactive');
                    }, 2000);
                }
            });
        }, { threshold: 0.5 });

        Object.keys(triggers).forEach(id => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });
    }

    saveSession() {
        storage.set('chatbot_session', JSON.stringify({
            history: this.conversationHistory,
            context: this.userContext,
            timestamp: Date.now()
        }));
    }

    loadSession() {
        const saved = JSON.parse(storage.get('chatbot_session'));
        if (saved && Date.now() - saved.timestamp < 86400000) {
            this.conversationHistory = saved.history || [];
            this.userContext = saved.context || this.userContext;
            return true;
        }
        return false;
    }

    initIdlePrompt() {
        let timer;
        let idleCount = 0;
        const messages = [
            'Stále jsem tu, kdybyste něco potřebovali!',
            'Tip: Zeptejte se mě na focení nebo AI služby.'
        ];

        this.resetIdleTimer = () => {
            clearTimeout(timer);
            if (this.isChatOpen) {
                timer = setTimeout(() => {
                    if (this.isChatOpen && idleCount < 2) {
                        this.addBotMessage(messages[idleCount], 0.8, 'proactive');
                        idleCount++;
                    }
                }, 45000);
            }
        };

        this.resetIdleCount = () => { idleCount = 0; };
    }

    processMessage(input, entitiesOverride = null) {
        const sentiment = this.analyzeSentiment(input);
        const entities = entitiesOverride || this.extractEntities(input);
        const faqAnswer = this.findFaqAnswer(input);
        this.userContext.sentiment = sentiment;
        if (entities.services.length) {
            const categories = entities.services.map(s => s.category);
            if (categories.includes('photography')) this.userContext.intent = 'photography';
            if (categories.includes('ai')) this.userContext.intent = 'ai_services';
        }

        if (faqAnswer) {
            addMessage('bot', faqAnswer);
            this.addBotMessage(faqAnswer, 0.9, 'faq');
        } else {
            let responseObj = this.generateResponse(input);
            let responseText = responseObj.response;
            if (sentiment === 'negative') responseText = 'Chápu. ' + responseText;
            addMessage('bot', responseText, responseObj.confidence, responseObj.intent);
            this.addBotMessage(responseText, responseObj.confidence, responseObj.intent);
        }

        renderQuickReplies();
        this.saveSession();
    }
}

// Chat UI
const CHAT_STORAGE_KEY = 'chatHistory';
let chatbot = new EnhancedChatbot();
let unreadCount = 0;

const chatBtn = document.getElementById('chatBtn');
const chatWindow = document.getElementById('chatWindow');
const closeChat = document.getElementById('closeChat');
const clearChat = document.getElementById('clearChat');
const messages = document.getElementById('messages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const unreadBadge = document.getElementById('unreadBadge');
const quickReplies = document.getElementById('quickReplies');

function safeInitChatbot() {
    if (!(chatBtn && chatWindow && closeChat && clearChat && messages && chatInput && sendBtn && unreadBadge && quickReplies)) {
        console.warn('Chatbot UI prvky nebyly nalezeny, inicializace přeskočena.');
        return;
    }

    if (chatbot.loadSession() && chatbot.conversationHistory.length) {
        chatbot.conversationHistory.forEach((entry) => {
            addMessage(entry.role, entry.message, entry.confidence, entry.intent, true);
        });
    }

    chatbot.setChatHandlers(
        () => {
            chatWindow.classList.remove('hidden');
            chatbot.isChatOpen = true;
        },
        () => {
            chatWindow.classList.add('hidden');
            chatbot.isChatOpen = false;
        }
    );

    chatBtn.addEventListener('click', () => {
        const nextOpen = chatWindow.classList.contains('hidden');
        if (nextOpen) {
            chatbot.openChat();
        } else {
            chatbot.closeChat();
        }
        if (chatbot.isChatOpen) {
            unreadCount = 0;
            updateUnreadBadge();
            if (messages.children.length === 0) {
                addMessage('bot', 'Ahoj! Tady Lukáš. Mám AI asistenta, který ti pomůže. Na co se chceš zeptat?', 0.95, 'greeting');
                renderQuickReplies();
            }
        }
    });

    closeChat.addEventListener('click', () => chatbot.closeChat());

    clearChat.addEventListener('click', () => {
        if (confirm('Smazat celou historii?')) {
            messages.innerHTML = '';
            storage.remove(CHAT_STORAGE_KEY);
            localStorage.removeItem('chatbot_session');
            chatbot = new EnhancedChatbot();
            addMessage('bot', 'Historie smazána. Můžeme začít znovu!', 1.0, 'system');
            renderQuickReplies();
        }
    });

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    updateUnreadBadge();
    chatbot.isChatOpen = false;
}

function addMessage(sender, text, confidence = null, intent = null, isHistory = false) {
    const time = new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
    const div = document.createElement('div');
    div.className = `chat-message mb-4 flex gap-2 ${sender === 'user' ? 'flex-row-reverse' : ''}`;

    const avatar = sender === 'user' ? '👤' : '🤖';
    const avatarBg = sender === 'user' ? 'bg-gradient-to-r from-blue-600 to-purple-600' : 'glass';

    div.innerHTML = `
        <div class="message-avatar ${avatarBg}">${avatar}</div>
        <div class="flex flex-col ${sender === 'user' ? 'items-end' : 'items-start'} max-w-xs">
            <div class="p-3 rounded-xl ${sender === 'user' ? 'bg-gradient-to-r from-blue-600 to-purple-600' : 'glass'}">${text}</div>
            <div class="message-time">${time}</div>
        </div>
    `;

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;

    if (!isHistory && sender === 'bot' && !chatbot.isChatOpen) {
        unreadCount++;
        updateUnreadBadge();
    }
}

function showTypingIndicator() {
    const div = document.createElement('div');
    div.id = 'typingIndicator';
    div.className = 'chat-message mb-4 flex gap-2';
    div.innerHTML = `
        <div class="message-avatar glass">🤖</div>
        <div class="glass rounded-xl typing-indicator" aria-live="polite" aria-label="Asistent píše...">
            <span></span><span></span><span></span>
        </div>
    `;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function removeTypingIndicator() {
    document.getElementById('typingIndicator')?.remove();
}

function renderQuickReplies() {
    const replies = chatbot.getContextualQuickReplies();

    quickReplies.innerHTML = replies.map(r =>
        `<button class="quick-reply-btn glass px-4 py-2 rounded-full text-sm mr-2 mb-2" aria-label="Rychlá odpověď: ${r.text}">${r.text}</button>`
    ).join('');
    quickReplies.classList.remove('hidden');

    quickReplies.querySelectorAll('button').forEach((btn, i) => {
        btn.addEventListener('click', () => {
            chatInput.value = replies[i].value;
            sendMessage();
            quickReplies.classList.add('hidden');
        });
    });
}

function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    if (chatbot.resetIdleCount) chatbot.resetIdleCount();
    if (chatbot.resetIdleTimer) chatbot.resetIdleTimer();

    quickReplies.classList.add('hidden');
    addMessage('user', text);
    chatInput.value = '';
    const entities = chatbot.extractEntities(text);
    chatbot.addUserMessage(text, entities);

    showTypingIndicator();

    setTimeout(() => {
        removeTypingIndicator();
        chatbot.processMessage(text, entities);
    }, 1000);
}

function updateUnreadBadge() {
    if (unreadCount > 0) {
        unreadBadge.textContent = unreadCount;
        unreadBadge.classList.remove('hidden');
    } else {
        unreadBadge.classList.add('hidden');
    }
}

// Initialize and expose globally
safeInitChatbot();
window.chatbot = chatbot;
