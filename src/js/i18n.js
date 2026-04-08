/**
 * i18n.js - lightweight CZ/EN switching for the public site
 */

;(function i18nIIFE() {
  'use strict';

  var storage = window.appStorage || {
    get: function(key) {
      try { return window.localStorage.getItem(key); } catch (err) { return null; }
    },
    set: function(key, value) {
      try { window.localStorage.setItem(key, value); } catch (err) {}
    }
  };

  var STORAGE_KEY = 'ld_lang';
  var currentLanguage = 'cs';

    var COPY = {
        cs: {
      title: 'Lukáš Drštička - Fotograf & AI Developer | Portfolio',
      description: 'Portfolio Lukáše Drštičky - fotograf a AI developer z Přerova. Portrétní, sportovní a produktová fotografie, AI chatboty a automatizace na míru.',
      nav: ['Hybridní Agent', 'Portfolio', 'Dovednosti', 'O mně', 'Spolupráce', 'Kontakt'],
      hero: ['Fotografie', 'AI Development', 'Automatizace', 'Fotograf & AI Developer', 'Portfolio', 'Hybridní Agent'],
      ai: ['Hybridní Agent', 'Chatbot, hlasový agent a workbench v jednom. Píše, mluví a rovnou navrhuje další krok. Funguje v češtině i angličtině.', 'Piš mi nebo klikni na Mluvit hlasem', 'Zeptej se česky nebo in English...', 'Mluvit hlasem', 'Odeslat'],
      portfolio: ['Portfolio', 'Vše', 'Fotografie', 'AI Projekty'],
      skills: ['Dovednosti & Technologie', 'Specializuji se na sportovní a portrétní fotografii. Postprodukci zrychluje moje AI aplikace Fotograf AI.', 'Fotografie', 'AI & Tech', 'Nástroje'],
      process: ['Jak pracuji', 'Jednoduchý proces od návrhu po realizaci', '1. Konzultace', 'Probereme vaše představy, cíle a požadavky projektu', '2. Plánování', 'Vytvoříme detailní plán a časový harmonogram', '3. Realizace', 'Fotografie, kód nebo AI řešení podle plánu', '4. Dokončení', 'Finální úpravy a předání hotového projektu'],
      about: ['O mně', 'Fotografuji a vyvíjím AI řešení. Baví mě propojovat kreativitu s technologií a vytvářet věci, které fungují.'],
      collaboration: ['Spolupráce', 'Spolupracuji s těmito subjekty', 'Klubový fotograf', 'Sportovní fotografie ze zápasů a klubových akcí. Dokumentace týmu a fanouškovských momentů.', 'AI specialista', 'Implementace AI řešení, automatizace procesů a technologické poradenství pro kulturní platformu.'],
        contact: ['Kontakt', 'Preferujete telefon? Zavolejte mi nebo napište e-mail a ozvu se zpět.', 'Napište mi zprávu', '(s hybridním agentem)', 'Jméno', 'Email', 'Typ služby', 'Zpráva', 'AI vám pomůže', 'Vaše jméno', 'vas@email.cz', 'Popište svůj projekt...', 'Fotografie', 'AI chatbot', 'Automatizace', 'Konzultace', 'Odeslat zprávu', 'Nová zpráva z webu', 'Toto pole je povinné'],
      footer: ['Profesionální fotografie a AI řešení na míru. Propojuji kreativitu s technologií.', 'Newsletter', 'Email pro newsletter', 'vas@email.cz', 'Odebírat', 'Odkazy', 'Kontakt', 'Přerov, CZ', '© 2026 Lukáš Drštička. Všechna práva vyhrazena.', 'Vytvořeno s pomocí Claude, Gemini & Codex | Designed with modern web standards'],
      misc: ['Přeskočit na obsah', 'Zpět na úvodní stránku', 'Otevřít mobilní menu', 'Zavřít menu', 'Přepnout režim', 'Napište zprávu...', 'Smazat historii', 'Zavřít chat', 'Galerie', 'Zavřít galerii', 'Předchozí fotka', 'Další fotka', 'Ukončit hovor', 'Zadejte prosím email.', 'Děkuji! Newsletter bude zaslán na:']
    },
    en: {
      title: 'Lukas Drsticka - Photographer & AI Developer | Portfolio',
      description: 'Portfolio of Lukas Drsticka - photographer and AI developer from Prerov, Czech Republic. Portrait, sports and product photography, AI chatbots and custom automation.',
      nav: ['Hybrid Agent', 'Portfolio', 'Skills', 'About', 'Collaboration', 'Contact'],
      hero: ['Photography', 'AI Development', 'Automation', 'Photographer & AI Developer', 'View portfolio', 'Hybrid Agent'],
      ai: ['Hybrid Agent', 'A chatbot, a voice agent and a workbench in one. Writes, speaks and instantly proposes the next step. Works in Czech and English.', 'Write to me or click Talk by voice', 'Ask in English or switch to Czech...', 'Talk by voice', 'Send'],
      portfolio: ['Portfolio', 'All', 'Photography', 'AI Projects'],
      skills: ['Skills & Technology', 'I focus on sports and portrait photography. My Fotograf AI app speeds up post-production and practical AI delivery.', 'Photography', 'AI & Tech', 'Tools'],
      process: ['How I work', 'A simple process from concept to delivery', '1. Consultation', 'We go through your goals, expectations and project requirements.', '2. Planning', 'We prepare a clear plan and realistic timeline.', '3. Delivery', 'Photography, code or AI solution delivered according to plan.', '4. Final handoff', 'Final polish and delivery of the finished project.'],
      about: ['About', 'I work across photography and AI solutions. I enjoy connecting creativity with technology and building things that are actually useful.'],
      collaboration: ['Collaboration', 'I collaborate with these partners', 'Club photographer', 'Sports photography from matches and club events. Team coverage and fan moments.', 'AI specialist', 'AI implementation, process automation and technology consulting for a cultural platform.'],
        contact: ['Contact', 'Prefer a phone call? Call me or send an email and I will get back to you.', 'Send me a message', '(with hybrid agent)', 'Name', 'Email', 'Service type', 'Message', 'AI can help you', 'Your name', 'you@email.com', 'Describe your project...', 'Photography', 'AI chatbot', 'Automation', 'Consultation', 'Send message', 'New website message', 'This field is required'],
      footer: ['Professional photography and tailor-made AI solutions. I connect creativity with technology.', 'Newsletter', 'Newsletter email', 'you@email.com', 'Subscribe', 'Links', 'Contact', 'Prerov, Czech Republic', '© 2026 Lukas Drsticka. All rights reserved.', 'Built with help from Claude, Gemini & Codex | Designed with modern web standards'],
      misc: ['Skip to content', 'Back to home page', 'Open mobile menu', 'Close menu', 'Toggle theme', 'Type a message...', 'Clear history', 'Close chat', 'Gallery', 'Close gallery', 'Previous photo', 'Next photo', 'End call', 'Please enter your email.', 'Thanks! The newsletter will be sent to:']
    }
  };

  function setText(node, value) {
    if (node && typeof value === 'string') node.textContent = value;
  }

  function setTexts(nodeList, values) {
    Array.prototype.slice.call(nodeList || []).forEach(function(node, index) {
      if (values[index] !== undefined) setText(node, values[index]);
    });
  }

  function setAttr(node, name, value) {
    if (node && typeof value === 'string') node.setAttribute(name, value);
  }

  function ensureSwitchers() {
    var themeToggle = document.getElementById('themeToggle');
    if (themeToggle && !document.getElementById('langToggleDesktop')) {
      var desktop = document.createElement('div');
      desktop.id = 'langToggleDesktop';
      desktop.className = 'flex items-center gap-1 glass rounded-full p-1';
      desktop.innerHTML = '<button type="button" class="lang-switch-btn px-3 py-1.5 rounded-full text-xs font-semibold transition" data-lang-option="cs">CZ</button><button type="button" class="lang-switch-btn px-3 py-1.5 rounded-full text-xs font-semibold transition" data-lang-option="en">EN</button>';
      themeToggle.parentNode.insertBefore(desktop, themeToggle);
    }

    var mobileNav = document.querySelector('#mobileMenu nav');
    if (mobileNav && !document.getElementById('langToggleMobile') && !document.getElementById('langToggleMobileStatic')) {
      var mobile = document.createElement('div');
      mobile.id = 'langToggleMobile';
      mobile.className = 'mt-4 flex items-center gap-2 glass rounded-full p-2';
      mobile.innerHTML = '<button type="button" class="lang-switch-btn px-4 py-2 rounded-full text-sm font-semibold transition" data-lang-option="cs">CZ</button><button type="button" class="lang-switch-btn px-4 py-2 rounded-full text-sm font-semibold transition" data-lang-option="en">EN</button>';
      mobileNav.appendChild(mobile);
    }

    document.querySelectorAll('.lang-switch-btn').forEach(function(button) {
      if (button.dataset.langBound === 'true') return;
      button.dataset.langBound = 'true';
      button.addEventListener('click', function() {
        applyLanguage(button.getAttribute('data-lang-option') || 'cs');
      });
    });
  }

  function updateSwitcherState() {
    document.querySelectorAll('.lang-switch-btn').forEach(function(button) {
      var active = button.getAttribute('data-lang-option') === currentLanguage;
      button.classList.toggle('bg-white', active);
      button.classList.toggle('text-slate-900', active);
      button.classList.toggle('text-white', !active);
      button.classList.toggle('text-white/70', !active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function applyLanguage(lang) {
    currentLanguage = lang === 'en' ? 'en' : 'cs';
    storage.set(STORAGE_KEY, currentLanguage);
    try {
      var currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('lang', currentLanguage);
      window.history.replaceState({}, '', currentUrl.toString());
    } catch (err) {}

    var copy = COPY[currentLanguage];
    document.documentElement.lang = currentLanguage;
    document.title = copy.title;
    setAttr(document.querySelector('meta[name="description"]'), 'content', copy.description);
    setAttr(document.querySelector('meta[property="og:title"]'), 'content', copy.title.replace(' | Portfolio', ''));
    setAttr(document.querySelector('meta[property="og:description"]'), 'content', copy.description);
    setAttr(document.querySelector('meta[name="twitter:title"]'), 'content', copy.title.replace(' | Portfolio', ''));
    setAttr(document.querySelector('meta[name="twitter:description"]'), 'content', copy.description);

    setText(document.querySelector('.skip-link'), copy.misc[0]);
    setAttr(document.querySelector('header a[href="#"]'), 'aria-label', copy.misc[1]);
    setTexts(document.querySelectorAll('header nav a.nav-link'), copy.nav);
    setTexts(document.querySelectorAll('#mobileMenu a.mobile-menu-link'), copy.nav);
    setAttr(document.getElementById('mobileMenuBtn'), 'aria-label', copy.misc[2]);
    setAttr(document.getElementById('mobileMenuClose'), 'aria-label', copy.misc[3]);
    setAttr(document.getElementById('themeToggle'), 'aria-label', copy.misc[4]);

    setTexts(document.querySelectorAll('#hero .mb-6 .chip'), copy.hero.slice(0, 3));
    setText(document.querySelector('#hero h1'), copy.hero[3]);
    setText(document.querySelector('#hero .text-center a[href="#portfolio"]'), copy.hero[4]);
    setText(document.querySelector('#hero .text-center a[href="#ai-asistent"]'), copy.hero[5]);

    setText(document.querySelector('#ai-asistent > div > h2'), copy.ai[0]);
    setText(document.querySelector('#ai-asistent > div > p'), copy.ai[1]);
    setText(document.querySelector('#hero-chat h3'), copy.ai[2]);
    setAttr(document.getElementById('hero-input'), 'placeholder', copy.ai[3]);
    setText(document.querySelector('#voice-call-btn span'), copy.ai[4]);
    setText(document.getElementById('hero-send'), copy.ai[5]);

    setText(document.querySelector('#portfolio > div > h2'), copy.portfolio[0]);
    setTexts(document.querySelectorAll('#portfolio .filter-btn'), copy.portfolio.slice(1));

    setText(document.querySelector('#skills > div > h2'), copy.skills[0]);
    setText(document.querySelector('#skills > div > p'), copy.skills[1]);
    setTexts(document.querySelectorAll('#skills .grid > div > h3'), copy.skills.slice(2));

    var sections = document.querySelectorAll('main > section');
    var process = sections[4];
    if (process) {
      setText(process.querySelector('h2'), copy.process[0]);
      setText(process.querySelector('p.text-center'), copy.process[1]);
      var processTitles = process.querySelectorAll('h3');
      var processBodies = process.querySelectorAll('.glass.card p');
      setText(processTitles[0], copy.process[2]); setText(processBodies[0], copy.process[3]);
      setText(processTitles[1], copy.process[4]); setText(processBodies[1], copy.process[5]);
      setText(processTitles[2], copy.process[6]); setText(processBodies[2], copy.process[7]);
      setText(processTitles[3], copy.process[8]); setText(processBodies[3], copy.process[9]);
    }

    setText(document.querySelector('#o-mne h2'), copy.about[0]);
    setText(document.querySelector('#o-mne p'), copy.about[1]);

    setText(document.querySelector('#spoluprace h2'), copy.collaboration[0]);
    setText(document.querySelector('#spoluprace p.text-center'), copy.collaboration[1]);
    setTexts(document.querySelectorAll('#spoluprace span.inline-block'), [copy.collaboration[2], copy.collaboration[4]]);
    setTexts(document.querySelectorAll('#spoluprace a p.text-gray-400'), [copy.collaboration[3], copy.collaboration[5]]);

    setText(document.querySelector('#kontakt h2'), copy.contact[0]);
    setText(document.querySelector('#kontakt .mb-8 p.text-gray-400'), copy.contact[1]);
    var contactHeadingSpans = document.querySelectorAll('#kontakt .mt-12 h3 span');
    if (contactHeadingSpans.length >= 3) {
      setText(contactHeadingSpans[1], copy.contact[2]);
      setText(contactHeadingSpans[2], copy.contact[3]);
    }
    var labels = document.querySelectorAll('#kontakt label.block.text-sm');
    if (labels.length >= 4) {
      setText(labels[0], copy.contact[4]);
      setText(labels[1], copy.contact[5]);
      setText(labels[2], copy.contact[6]);
      var messageSpans = labels[3].querySelectorAll('span');
      if (messageSpans.length >= 2) {
        setText(messageSpans[0], copy.contact[7]);
        setText(messageSpans[1], copy.contact[8]);
      }
    }
    setAttr(document.getElementById('contactName'), 'placeholder', copy.contact[9]);
    setAttr(document.getElementById('contactEmail'), 'placeholder', copy.contact[10]);
    setAttr(document.getElementById('contactMessage'), 'placeholder', copy.contact[11]);
    setText(document.getElementById('contactNameError'), copy.contact[18]);
    setText(document.getElementById('contactEmailError'), copy.contact[18]);
    setText(document.getElementById('contactServiceError'), copy.contact[18]);
    setText(document.getElementById('contactMessageError'), copy.contact[18]);
    setTexts(document.querySelectorAll('#contactService option'), copy.contact.slice(12, 16));
    setText(document.querySelector('#contactForm button[type="submit"]'), copy.contact[16]);
    var subject = document.querySelector('#contactForm input[name="_subject"]');
    if (subject) subject.value = copy.contact[17];

    setText(document.querySelector('footer .md\\:col-span-2 p.text-gray-400'), copy.footer[0]);
    setText(document.querySelector('footer h4.font-semibold.mb-3'), copy.footer[1]);
    setText(document.querySelector('label[for="newsletterEmail"]'), copy.footer[2]);
    setAttr(document.getElementById('newsletterEmail'), 'placeholder', copy.footer[3]);
    setText(document.querySelector('#newsletterForm button[type="submit"]'), copy.footer[4]);
    setText(document.querySelector('footer div:nth-child(2) > h4'), copy.footer[5]);
    setText(document.querySelector('footer div:nth-child(3) > h4'), copy.footer[6]);
    setText(document.querySelector('footer div:nth-child(3) ul li:nth-child(2)'), copy.footer[7]);
    var footerBottom = document.querySelectorAll('footer .border-t p');
    if (footerBottom.length >= 2) {
      setText(footerBottom[0], copy.footer[8]);
      setText(footerBottom[1], copy.footer[9]);
    }

    setAttr(document.getElementById('chatInput'), 'placeholder', copy.misc[5]);
    setAttr(document.getElementById('clearChat'), 'title', copy.misc[6]);
    setAttr(document.getElementById('clearChat'), 'aria-label', copy.misc[6]);
    setAttr(document.getElementById('closeChat'), 'aria-label', copy.misc[7]);
    setAttr(document.getElementById('lightbox'), 'aria-label', copy.misc[8]);
    setAttr(document.getElementById('closeLightbox'), 'aria-label', copy.misc[9]);
    setAttr(document.getElementById('lightboxPrev'), 'aria-label', copy.misc[10]);
    setAttr(document.getElementById('lightboxNext'), 'aria-label', copy.misc[11]);
    setAttr(document.getElementById('voice-hangup'), 'aria-label', copy.misc[12]);

    updateSwitcherState();

    window.ldGetLanguage = function() { return currentLanguage; };
    window.ldGetText = function(path, fallback) {
      var map = {
        'newsletter.enterEmail': copy.misc[13],
        'newsletter.successPrefix': copy.misc[14],
        'contact.requiredField': currentLanguage === 'en' ? 'This field is required' : 'Toto pole je povinné',
        'contact.invalidEmail': currentLanguage === 'en' ? 'Please enter a valid email.' : 'Zadejte platný email.',
        'contact.checkRequired': currentLanguage === 'en' ? 'Please check the required fields.' : 'Zkontrolujte prosím povinná pole.',
        'contact.sending': currentLanguage === 'en' ? 'Sending...' : 'Odesílám...',
        'contact.sent': currentLanguage === 'en' ? 'Thank you! Your message has been sent.' : 'Děkuji! Zpráva byla odeslána.',
        'contact.failed': currentLanguage === 'en' ? 'Sending failed. Please try again.' : 'Odeslání se nepodařilo. Zkuste to prosím znovu.',
        'chatbot.quickReplyLabel': currentLanguage === 'en' ? 'Quick reply' : 'Rychlá odpověď',
        'chatbot.serverError': currentLanguage === 'en' ? 'Server error' : 'Chyba serveru',
        'chatbot.fallback': currentLanguage === 'en' ? "I can't answer properly right now. Try again in a moment or send me a shorter prompt." : 'Teď zrovna nemůžu odpovědět tak, jak bych chtěl. Zkus to za chvíli nebo mi dej krátké zadání znovu.',
        'chatbot.typing': currentLanguage === 'en' ? 'Assistant is typing...' : 'Asistent píše...',
        'chatbot.transcriptUser': currentLanguage === 'en' ? 'User' : 'Uživatel',
        'chatbot.transcriptAssistant': currentLanguage === 'en' ? 'Assistant' : 'Asistent',
        'chatbot.transcriptSubject': currentLanguage === 'en' ? 'Lukas AI transcript' : 'Lukáš AI přepis',
        'voice.connecting': currentLanguage === 'en' ? 'Connecting...' : 'Připojuji...',
        'voice.active': currentLanguage === 'en' ? 'Call active' : 'Hovor aktivní',
        'voice.ending': currentLanguage === 'en' ? 'Ending...' : 'Ukončuji...',
        'voice.connectionFailed': currentLanguage === 'en' ? 'Connection failed' : 'Nepodařilo se navázat spojení',
        'voice.userLabel': currentLanguage === 'en' ? 'You' : 'Vy',
        'voice.assistantLabel': currentLanguage === 'en' ? 'AI' : 'AI',
        'accessibility.sectionVisiblePrefix': currentLanguage === 'en' ? 'Visible section' : 'Zobrazená sekce'
      };
      return Object.prototype.hasOwnProperty.call(map, path) ? map[path] : fallback;
    };

    window.dispatchEvent(new CustomEvent('ld:languagechange', {
      detail: { lang: currentLanguage, copy: copy }
    }));
  }

  function init() {
    ensureSwitchers();
    var url = new URL(window.location.href);
    var lang = url.searchParams.get('lang');
    if (lang !== 'cs' && lang !== 'en') {
      lang = storage.get(STORAGE_KEY) || 'cs';
    }
    applyLanguage(lang);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.ldI18n = {
    init: init,
    applyLanguage: applyLanguage
  };
})();
