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
      title: 'Fotograf Přerov & AI Developer | Lukáš Drštička',
      description: 'Fotograf Přerov – Lukáš Drštička. Sportovní a portrétní fotografie v Přerově a okolí. AI developer – chatboty, automatizace a webová řešení na míru.',
      nav: ['Hybridní agent', 'Portfolio', 'Služby', 'O mně', 'Spolupráce', 'Kontakt'],
      hero: ['Lukáš Drštička · Fotograf & AI developer · Přerov', 'Fotím sport a portréty. A stavím AI, která pracuje za mě.', 'Domluvit focení', 'Prohlédnout práci'],
      ai: ['Hybridní agent', 'Postavil jsem ho sám. Zeptej se ho na cokoliv.', 'Píše, mluví a rovnou navrhuje další krok — v češtině i angličtině. Stejného agenta můžu postavit i pro váš web. Tohle není demo, běží naostro.', 'Piš mi nebo klikni na Mluvit hlasem', 'Zeptej se česky nebo in English...', 'Mluvit hlasem', 'Odeslat', 'Vaše zpráva pro hybridního AI agenta'],
      portfolio: ['Vybraná práce', 'Vše', 'Fotografie', 'AI Projekty'],
      services: ['Služby',
        'Focení zápasů', 'Celý zápas od rozcvičky po děkovačku. Akce, souboje, emoce, střídačka i fanoušci — jako klubový fotograf 1. FC Viktorie Přerov vím, které momenty klub potřebuje.', 'Galerie nejlepších momentů ve full rozlišení', 'Výběr připravený ke sdílení pro klub, hráče i sociální sítě', 'Online galerie na tomto webu', 'Domluvit termín',
        'Portréty', 'Portrétní focení s atmosférou — venku i v interiéru, s kouřem, světlem a náladou. Postprodukci zrychluje moje vlastní aplikace Fotograf AI, takže výsledky dostanete rychle.', 'Upravené fotografie ve full rozlišení', 'Výběr děláme společně, žádné překvapení', 'Rychlé dodání díky AI postprodukci', 'Domluvit focení',
        'AI & web na míru', 'Hybridní agent, který mluví za váš web — stejný, jako běží na této stránce. Weby, chatboti a automatizace, které si nejdřív postavím a otestuju sám na sobě.', 'Živá ukázka: agent na tomto webu, zeptejte se ho', 'Řešení na míru bez zbytečných služeb a fixních nákladů', 'Předání s dokumentací a zaškolením', 'Vyzkoušet agenta'],
      about: ['O mně', 'Jsem fotograf, který si postavil vlastní AI. Fotím fotbal pro 1. FC Viktorie Přerov a portréty, které mají náladu. Postprodukci mi zrychluje Fotograf AI — aplikace, kterou jsem si napsal sám. A tenhle web včetně agenta, který na něm mluví za mě, je taky moje práce. Kreativita a technologie u mě nejsou dvě profese — jedna pohání druhou.', 'Zápasové galerie', 'Fotek ze zápasů v portfoliu', 'AI projekty v provozu', 'Hybridní agent', 'právě s ním mluvíte'],
      collaboration: ['Spolupráce', 'Spolupracuji s těmito subjekty', 'Klubový fotograf', 'Sportovní fotografie ze zápasů a klubových akcí. Dokumentace týmu a fanouškovských momentů.'],
        contact: ['Kontakt', 'Domluvme focení. Nebo AI, která bude pracovat za vás.', 'Preferujete telefon? Zavolejte mi nebo napište e-mail a ozvu se zpět. Rychlou odpověď dostanete i od hybridního agenta v chatu.', 'Napište mi zprávu', '(s hybridním agentem)', 'Jméno', 'Email', 'Typ služby', 'Zpráva', 'AI vám pomůže', 'Vaše jméno', 'vas@email.cz', 'Popište svůj projekt...', 'Fotografie', 'AI chatbot', 'Automatizace', 'Konzultace', 'Odeslat zprávu', 'Nová zpráva z webu', 'Toto pole je povinné'],
      footer: ['Sportovní a portrétní fotografie. AI agenti a weby, které si nejdřív stavím a testuju sám na sobě.', 'Newsletter', 'Email pro newsletter', 'vas@email.cz', 'Odebírat', 'Odkazy', 'Kontakt', 'Přerov, CZ', '© 2026 Lukáš Drštička. Všechna práva vyhrazena.', 'Vytvořeno s pomocí Claude, Gemini & Codex | Designed with modern web standards'],
      misc: ['Přeskočit na obsah', 'Zpět na úvodní stránku', 'Otevřít mobilní menu', 'Zavřít menu', 'Přepnout režim', 'Napište zprávu...', 'Smazat historii', 'Zavřít chat', 'Galerie', 'Zavřít galerii', 'Předchozí fotka', 'Další fotka', 'Ukončit hovor', 'Zadejte prosím email.', 'Děkuji! Newsletter bude zaslán na:']
    },
    en: {
      title: 'Photographer Prerov & AI Developer | Lukas Drsticka',
      description: 'Photographer in Prerov, Czech Republic – Lukas Drsticka. Sports and portrait photography in Prerov and nearby. AI developer – chatbots, automation and custom web solutions.',
      nav: ['Hybrid agent', 'Portfolio', 'Services', 'About', 'Collaboration', 'Contact'],
      hero: ['Lukas Drsticka · Photographer & AI developer · Prerov, CZ', 'I shoot sports and portraits. And I build AI that works for me.', 'Book a shoot', 'View my work'],
      ai: ['Hybrid agent', 'I built it myself. Ask it anything.', 'It writes, speaks and proposes the next step — in Czech and English. I can build the same agent for your website. This is not a demo, it runs live.', 'Write to me or click Talk by voice', 'Ask in English or switch to Czech...', 'Talk by voice', 'Send', 'Your message for the hybrid AI agent'],
      portfolio: ['Selected work', 'All', 'Photography', 'AI Projects'],
      services: ['Services',
        'Match photography', 'A full match from warm-up to the final whistle. Action, duels, emotions, the bench and the fans — as the club photographer of 1. FC Viktorie Prerov I know which moments a club needs.', 'A gallery of the best moments in full resolution', 'A selection ready to share for the club, players and social media', 'An online gallery on this website', 'Book a date',
        'Portraits', 'Portrait photography with atmosphere — outdoors or indoors, with smoke, light and mood. Post-production is accelerated by my own app Fotograf AI, so you get your results fast.', 'Edited photos in full resolution', 'We pick the selection together, no surprises', 'Fast delivery thanks to AI post-production', 'Book a shoot',
        'Custom AI & web', 'A hybrid agent that speaks for your website — the same one running on this page. Websites, chatbots and automation that I build and test on myself first.', 'Live proof: the agent on this site, go ask it', 'Tailored solutions with no unnecessary services or fixed costs', 'Handover with documentation and training', 'Try the agent'],
      about: ['About', 'I am a photographer who built his own AI. I shoot football for 1. FC Viktorie Prerov and portraits with real mood. My own app Fotograf AI speeds up my post-production. And this website — including the agent speaking on it — is my work too. Creativity and technology are not two separate professions for me; one powers the other.', 'Match galleries', 'Match photos in portfolio', 'AI projects in production', 'Hybrid agent', 'you are talking to it right now'],
      collaboration: ['Collaboration', 'I collaborate with these partners', 'Club photographer', 'Sports photography from matches and club events. Team coverage and fan moments.'],
        contact: ['Contact', 'Let’s book a shoot. Or AI that will work for you.', 'Prefer a phone call? Call me or send an email and I will get back to you. The hybrid agent in the chat can answer quickly too.', 'Send me a message', '(with hybrid agent)', 'Name', 'Email', 'Service type', 'Message', 'AI can help you', 'Your name', 'you@email.com', 'Describe your project...', 'Photography', 'AI chatbot', 'Automation', 'Consultation', 'Send message', 'New website message', 'This field is required'],
      footer: ['Sports and portrait photography. AI agents and websites I always build and test on myself first.', 'Newsletter', 'Newsletter email', 'you@email.com', 'Subscribe', 'Links', 'Contact', 'Prerov, Czech Republic', '© 2026 Lukas Drsticka. All rights reserved.', 'Built with help from Claude, Gemini & Codex | Designed with modern web standards'],
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
    if (themeToggle && !document.getElementById('langToggleDesktop') && !document.getElementById('langToggleDesktopStatic')) {
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
      if (currentUrl.searchParams.has('lang')) {
        currentUrl.searchParams.delete('lang');
        var clean = currentUrl.pathname + (currentUrl.search ? currentUrl.search : '') + currentUrl.hash;
        window.history.replaceState({}, '', clean);
      }
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

    setText(document.querySelector('#hero .hero-eyebrow'), copy.hero[0]);
    setText(document.querySelector('#hero .hero-claim'), copy.hero[1]);
    setText(document.querySelector('#hero .hero-cta-row a[href="#kontakt"]'), copy.hero[2]);
    setText(document.querySelector('#hero .hero-cta-row a[href="#portfolio"]'), copy.hero[3]);

    setText(document.querySelector('#hybridni-agent .chapter-title'), copy.ai[0]);
    setText(document.querySelector('#hybridni-agent .section-sub'), copy.ai[1]);
    setText(document.querySelector('#hybridni-agent .agent-intro-note'), copy.ai[2]);
    setText(document.querySelector('#hero-chat h3'), copy.ai[3]);
    setAttr(document.getElementById('hero-input'), 'placeholder', copy.ai[4]);
    setAttr(document.getElementById('hero-input'), 'aria-label', copy.ai[7]);
    setText(document.querySelector('label[for="hero-input"]'), copy.ai[7]);
    setText(document.querySelector('#voice-call-btn span'), copy.ai[5]);
    setText(document.getElementById('hero-send'), copy.ai[6]);

    setText(document.querySelector('#portfolio .chapter-title'), copy.portfolio[0]);
    setTexts(document.querySelectorAll('#portfolio .filter-btn'), copy.portfolio.slice(1));

    setText(document.querySelector('#sluzby .chapter-title'), copy.services[0]);
    document.querySelectorAll('#sluzby .service-row').forEach(function(row, index) {
      var base = 1 + index * 6;
      setText(row.querySelector('.service-title'), copy.services[base]);
      setText(row.querySelector('.service-desc'), copy.services[base + 1]);
      setTexts(row.querySelectorAll('.service-deliverables li'), copy.services.slice(base + 2, base + 5));
      setText(row.querySelector('.service-cta'), copy.services[base + 5]);
    });

    setText(document.querySelector('#o-mne .chapter-title'), copy.about[0]);
    setText(document.querySelector('#o-mne .about-story'), copy.about[1]);
    setTexts(document.querySelectorAll('#o-mne .fact-row dt'), copy.about.slice(2, 6));
    var factRows = document.querySelectorAll('#o-mne .fact-row');
    if (factRows.length) {
      setText(factRows[factRows.length - 1].querySelector('dd'), copy.about[6]);
    }

    setText(document.querySelector('#spoluprace .chapter-title'), copy.collaboration[0]);
    setText(document.querySelector('#spoluprace .section-sub'), copy.collaboration[1]);
    setTexts(document.querySelectorAll('#spoluprace span.inline-block'), [copy.collaboration[2]]);
    setTexts(document.querySelectorAll('#spoluprace a p.text-gray-400'), [copy.collaboration[3]]);

    setText(document.querySelector('#kontakt .chapter-title'), copy.contact[0]);
    setText(document.querySelector('#kontakt .contact-claim'), copy.contact[1]);
    setText(document.querySelector('#kontakt .contact-intro p.text-gray-400'), copy.contact[2]);
    var contactHeadingSpans = document.querySelectorAll('#kontakt .contact-form-wrap h3 span');
    if (contactHeadingSpans.length >= 2) {
      setText(contactHeadingSpans[0], copy.contact[3]);
      setText(contactHeadingSpans[1], copy.contact[4]);
    }
    var labels = document.querySelectorAll('#kontakt label.block.text-sm');
    if (labels.length >= 4) {
      setText(labels[0], copy.contact[5]);
      setText(labels[1], copy.contact[6]);
      setText(labels[2], copy.contact[7]);
      var messageSpans = labels[3].querySelectorAll('span');
      if (messageSpans.length >= 2) {
        setText(messageSpans[0], copy.contact[8]);
        setText(messageSpans[1], copy.contact[9]);
      }
    }
    setAttr(document.getElementById('contactName'), 'placeholder', copy.contact[10]);
    setAttr(document.getElementById('contactEmail'), 'placeholder', copy.contact[11]);
    setAttr(document.getElementById('contactMessage'), 'placeholder', copy.contact[12]);
    setText(document.getElementById('contactNameError'), copy.contact[19]);
    setText(document.getElementById('contactEmailError'), copy.contact[19]);
    setText(document.getElementById('contactServiceError'), copy.contact[19]);
    setText(document.getElementById('contactMessageError'), copy.contact[19]);
    setTexts(document.querySelectorAll('#contactService option'), copy.contact.slice(13, 17));
    setText(document.querySelector('#contactForm button[type="submit"]'), copy.contact[17]);
    var subject = document.querySelector('#contactForm input[name="_subject"]');
    if (subject) subject.value = copy.contact[18];

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
        'chatbot.typing': currentLanguage === 'en' ? 'Hybrid agent is typing...' : 'Hybridní agent píše...',
        'chatbot.transcriptUser': currentLanguage === 'en' ? 'User' : 'Uživatel',
        'chatbot.transcriptAssistant': currentLanguage === 'en' ? 'Hybrid agent' : 'Hybridní agent',
        'chatbot.transcriptSubject': currentLanguage === 'en' ? 'Lukas AI transcript' : 'Lukáš AI přepis',
        'voice.connecting': currentLanguage === 'en' ? 'Connecting...' : 'Připojuji...',
        'voice.active': currentLanguage === 'en' ? 'Call active' : 'Hovor aktivní',
        'voice.ending': currentLanguage === 'en' ? 'Ending...' : 'Ukončuji...',
        'voice.connectionFailed': currentLanguage === 'en' ? 'Connection failed' : 'Nepodařilo se navázat spojení',
        'voice.userLabel': currentLanguage === 'en' ? 'You' : 'Vy',
        'voice.assistantLabel': currentLanguage === 'en' ? 'Hybrid agent' : 'Hybridní agent',
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
