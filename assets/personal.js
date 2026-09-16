/* Explicit translation targets keep copy independent of layout and section order. */
(() => {
    'use strict';
    const textNodes = Array.from(document.querySelectorAll('[data-en]')).map(node => ({ node, cs: node.innerHTML, en: node.dataset.en }));
    const placeholders = Array.from(document.querySelectorAll('[data-en-placeholder]')).map(node => ({ node, cs: node.getAttribute('placeholder'), en: node.dataset.enPlaceholder }));
    let language = 'cs';
    const runtime = {
        'contact.requiredField': ['Toto pole je povinné', 'This field is required'],
        'contact.invalidEmail': ['Zadejte platný email.', 'Please enter a valid email.'],
        'contact.checkRequired': ['Zkontrolujte prosím povinná pole.', 'Please check the required fields.'],
        'contact.sending': ['Odesílám...', 'Sending...'],
        'contact.sent': ['Děkuji! Zpráva byla odeslána.', 'Thank you! Your message has been sent.'],
        'contact.failed': ['Odeslání se nepodařilo. Zkuste to prosím znovu.', 'Sending failed. Please try again.'],
        'chatbot.typing': ['Hybridní agent píše...', 'Hybrid agent is typing...'],
        'voice.connecting': ['Připojuji...', 'Connecting...'],
        'voice.active': ['Hovor aktivní', 'Call active'],
        'voice.ending': ['Ukončuji...', 'Ending...'],
        'voice.connectionFailed': ['Nepodařilo se navázat spojení', 'Connection failed']
    };
    function applyLanguage(value) {
        language = value === 'en' ? 'en' : 'cs';
        document.documentElement.lang = language;
        textNodes.forEach(({ node, cs, en }) => { if (language === 'en') node.textContent = en; else node.innerHTML = cs; });
        placeholders.forEach(({ node, cs, en }) => node.setAttribute('placeholder', language === 'en' ? en : cs));
        document.querySelectorAll('[data-lang-option]').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.langOption === language)));
        document.title = language === 'en' ? 'Lukáš Drštička — photography, websites & AI' : 'Lukáš Drštička — fotografie, weby a AI';
        const description = language === 'en' ? 'Lukáš Drštička, Přerov. Sports and portrait photography, websites and AI projects. Browse photographs and match galleries.' : 'Lukáš Drštička, Přerov. Sportovní a portrétní fotografie, vlastní webové a AI projekty. Prohlédněte si fotografie a galerie zápasů.';
        document.querySelector('meta[name="description"]').content = description;
        ['meta[property="og:title"]', 'meta[name="twitter:title"]'].forEach(selector => document.querySelector(selector).content = document.title);
        ['meta[property="og:description"]', 'meta[name="twitter:description"]'].forEach(selector => document.querySelector(selector).content = description);
        try { localStorage.setItem('ld_lang', language); } catch (_) {}
        window.dispatchEvent(new CustomEvent('ld:languagechange', { detail: { lang: language } }));
    }
    window.ldGetLanguage = () => language;
    window.ldGetText = (key, fallback) => runtime[key] ? runtime[key][language === 'en' ? 1 : 0] : fallback;
    window.ldI18n = { applyLanguage };
    document.querySelectorAll('[data-lang-option]').forEach(node => {
        node.dataset.langCoreBound = 'true';
        node.addEventListener('click', () => applyLanguage(node.dataset.langOption));
    });
    let preferred = new URL(location.href).searchParams.get('lang');
    if (!preferred) { try { preferred = localStorage.getItem('ld_lang'); } catch (_) {} }
    applyLanguage(preferred);
    const dialog = document.getElementById('photo-dialog');
    if (dialog && typeof dialog.showModal === 'function') {
        document.querySelectorAll('[data-photo]').forEach(link => link.addEventListener('click', event => {
            event.preventDefault();
            dialog.querySelector('img').src = link.href;
            dialog.querySelector('img').alt = link.querySelector('img').alt;
            dialog.querySelector('p').textContent = link.querySelector('span').textContent;
            dialog.showModal();
        }));
        dialog.querySelector('[data-close-photo]').addEventListener('click', () => dialog.close());
        dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    }
})();
