/**
 * Contact module - lazy loaded on scroll
 * AI Writing Assistant and contact form handling
 */

function getLanguage() {
    return typeof window.ldGetLanguage === 'function' ? window.ldGetLanguage() : 'cs';
}

function t(path, fallback) {
    return typeof window.ldGetText === 'function' ? window.ldGetText(path, fallback) : fallback;
}

class AIWritingAssistant {
    constructor() {
        this.messageInput = document.getElementById('contactMessage');
        this.suggestionsContainer = document.getElementById('aiSuggestions');
        this.lastMessage = '';
        this.debounceTimer = null;
        if (!this.messageInput || !this.suggestionsContainer) {
            return;
        }

        this.messageInput.addEventListener('input', () => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => this.analyze(), 500);
        });
    }

    analyze() {
        const message = this.messageInput.value.trim();

        if (message === this.lastMessage || message.length < 10) {
            this.suggestionsContainer.innerHTML = '';
            return;
        }

        this.lastMessage = message;
        const suggestions = [];
        const generatedTexts = [];

        const normalized = message.toLowerCase();

        // Detekce co uživatel chce a generování textu
        if (message.length < 50) {
            suggestions.push({
                type: 'warning',
                text: '💡 Zkuste být konkrétnější - AI může pomoci rozšířit text.'
            });

            // Nabídnout rozšíření
            const expandedText = this.expandShortMessage(message);
            if (expandedText) {
                generatedTexts.push({
                    type: 'generated',
                    text: expandedText,
                    label: '✨ AI návrh rozšíření:'
                });
            }
        }

        const projectTypes = ['fotografie', 'fotka', 'focení', 'foto', 'chatbot', 'ai', 'automatizace', 'web', 'aplikace'];
        const hasProjectType = projectTypes.some(type => normalized.includes(type));

        if (!hasProjectType && message.length > 30) {
            suggestions.push({
                type: 'info',
                text: '🎯 Uveďte typ projektu - AI může doplnit detaily.'
            });
        }

        const hasDeadline = normalized.includes('termín') || normalized.includes('kdy') ||
                           normalized.includes('datum') || /\d{1,2}\.\d{1,2}/.test(message);

        if (!hasDeadline && message.length > 50 && hasProjectType) {
            const textWithDeadline = this.addDeadlineToText(message);
            generatedTexts.push({
                type: 'generated',
                text: textWithDeadline,
                label: '📅 Verze s termínem:'
            });
        }

        const hasBudget = normalized.includes('rozpočet') || normalized.includes('budget') ||
                         normalized.includes('cena') || normalized.includes('kolik');

        if (!hasBudget && message.length > 50 && hasProjectType) {
            const textWithBudget = this.addBudgetToText(message);
            generatedTexts.push({
                type: 'generated',
                text: textWithBudget,
                label: '💰 Verze s rozpočtem:'
            });
        }

        if (message.length > 100 && hasProjectType && (hasDeadline || hasBudget)) {
            suggestions.push({
                type: 'success',
                text: '✅ Výborně! Vaše zpráva je kompletní.'
            });
        }

        this.renderSuggestions(suggestions, generatedTexts);
    }

    expandShortMessage(message) {
        const normalized = message.toLowerCase();

        if (normalized.includes('potřebuj') || normalized.includes('chci')) {
            if (normalized.includes('focen') || normalized.includes('foto')) {
                if (normalized.includes('portrét')) {
                    return `Dobrý den, potřebuji focení portrétů. Zajímá mě váš přístup k portrétní fotografii a cenová nabídka. Rád bych prodiskutoval možnosti lokace a stylu focení. Děkuji.`;
                }
                if (normalized.includes('sport')) {
                    return `Zdravím, hledám fotografa na sportovní akci. Zajímala by mě vaše zkušenost se sportovní fotografií a dostupnost v následujících měsících. Můžeme si domluvit konzultaci?`;
                }
                if (normalized.includes('produkt')) {
                    return `Dobrý den, potřebuji produktovou fotografii pro e-shop. Zajímá mě váš proces, případné ukázky předchozích prací a orientační cena. Těším se na odpověď.`;
                }
                return `Dobrý den, mám zájem o fotografické služby. Chtěl bych se dozvědět více o vašem portfoliu, cenách a dostupnosti. Můžeme si domluvit úvodní konzultaci? Děkuji.`;
            }

            if (normalized.includes('chatbot') || normalized.includes('ai')) {
                return `Zdravím, mám zájem o vytvoření AI chatbota pro můj web. Zajímá mě technické řešení, možnosti integrace a cenová kalkulace. Můžeme probrat detaily projektu?`;
            }

            if (normalized.includes('automatizace')) {
                return `Dobrý den, hledám řešení pro automatizaci firemních procesů. Zajímala by mě vaše zkušenost s podobnými projekty a možný rozsah spolupráce. Těším se na diskuzi.`;
            }
        }

        return null;
    }

    addDeadlineToText(message) {
        return `${message}\n\nPředpokládaný termín realizace: co nejdříve / do konce měsíce (prosím upřesněte podle vašich potřeb).`;
    }

    addBudgetToText(message) {
        return `${message}\n\nOrientační rozpočet: 5 000 - 20 000 Kč (prosím upřesněte váš rozpočet pro přesnější nabídku).`;
    }

    renderSuggestions(suggestions, generatedTexts) {
        if (suggestions.length === 0 && generatedTexts.length === 0) {
            this.suggestionsContainer.innerHTML = '';
            return;
        }

        let html = '';

        suggestions.forEach(s => {
            html += `<div class="ai-suggestion ${s.type}">${s.text}</div>`;
        });

        generatedTexts.forEach(g => {
            html += `
                <div class="ai-generated-text">
                    <div class="font-semibold text-purple-400 mb-2">${g.label}</div>
                    <div class="text-gray-300 mb-2">${g.text}</div>
                    <button class="ai-action-btn use-text-btn" data-text="${this.escapeHtml(g.text)}">
                        ✓ Použít tento text
                    </button>
                    <button class="ai-action-btn append-text-btn" data-text="${this.escapeHtml(g.text)}">
                        + Přidat k mému textu
                    </button>
                </div>
            `;
        });

        this.suggestionsContainer.innerHTML = html;

        // Event listeners pro tlačítka
        this.suggestionsContainer.querySelectorAll('.use-text-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.messageInput.value = btn.dataset.text;
                this.messageInput.dispatchEvent(new Event('input'));
            });
        });

        this.suggestionsContainer.querySelectorAll('.append-text-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const currentText = this.messageInput.value.trim();
                const newText = btn.dataset.text;
                this.messageInput.value = currentText + '\n\n' + newText;
                this.messageInput.dispatchEvent(new Event('input'));
            });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Contact form handling
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    const statusEl = document.getElementById('contactStatus');
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const contactName = document.getElementById('contactName');
    const contactEmail = document.getElementById('contactEmail');
    const contactService = document.getElementById('contactService');
    const contactMessage = document.getElementById('contactMessage');
    const fieldConfigs = [
        { input: contactName, errorId: 'contactNameError', message: 'Toto pole je povinné' },
        { input: contactEmail, errorId: 'contactEmailError', message: 'Toto pole je povinné' },
        { input: contactService, errorId: 'contactServiceError', message: 'Toto pole je povinné' },
        { input: contactMessage, errorId: 'contactMessageError', message: 'Toto pole je povinné' }
    ];

    const translateContactRuntimeText = (value) => {
        const text = (value || '').trim();
        if (!text) return text;
        const normalized = text
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();

        if (normalized.includes('toto pole je povinn')) return t('contact.requiredField', 'Toto pole je povinne');
        if (normalized.includes('zadejte platn')) return t('contact.invalidEmail', 'Zadejte platny email.');
        if (normalized.includes('zkontrolujte') && normalized.includes('povinn')) return t('contact.checkRequired', 'Zkontrolujte prosim povinna pole.');
        if (normalized.includes('odes') && normalized.includes('m')) return t('contact.sending', 'Odesilam...');
        if (normalized.includes('dekuji') && normalized.includes('odeslan')) return t('contact.sent', 'Dekuji! Zprava byla odeslana.');
        if (normalized.includes('nepodarilo')) return t('contact.failed', 'Odeslani se nepodarilo. Zkuste to prosim znovu.');
        return text;
    };

    const syncContactLocale = () => {
        fieldConfigs.forEach((config) => {
            config.message = t('contact.requiredField', 'Toto pole je povinne');
            const errorEl = document.getElementById(config.errorId);
            if (errorEl && errorEl.textContent.trim()) {
                errorEl.textContent = translateContactRuntimeText(errorEl.textContent);
            }
        });
        if (statusEl && statusEl.textContent.trim()) {
            statusEl.textContent = translateContactRuntimeText(statusEl.textContent);
        }
    };

    syncContactLocale();
    window.addEventListener('ld:languagechange', syncContactLocale);

    [statusEl]
        .concat(fieldConfigs.map(({ errorId }) => document.getElementById(errorId)))
        .filter(Boolean)
        .forEach((node) => {
            new MutationObserver(() => {
                const translated = translateContactRuntimeText(node.textContent);
                if (translated !== node.textContent) {
                    node.textContent = translated;
                }
            }).observe(node, { childList: true, characterData: true, subtree: true });
        });

    const setFieldError = (input, errorId, message) => {
        const errorEl = document.getElementById(errorId);
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add('is-visible');
        }
        if (input) {
            input.setAttribute('aria-invalid', 'true');
        }
    };

    const clearFieldError = (input, errorId) => {
        const errorEl = document.getElementById(errorId);
        if (errorEl) {
            errorEl.classList.remove('is-visible');
        }
        if (input) {
            input.removeAttribute('aria-invalid');
        }
    };

    const validateContactForm = () => {
        let isValid = true;
        fieldConfigs.forEach(({ input, errorId, message }) => {
            if (!input) return;
            const value = (input.value || '').trim();
            if (!value) {
                setFieldError(input, errorId, message);
                isValid = false;
            } else {
                clearFieldError(input, errorId);
            }
        });

        if (contactEmail && contactEmail.value && contactEmail.validity.typeMismatch) {
            setFieldError(contactEmail, 'contactEmailError', 'Zadejte platný email.');
            isValid = false;
        }

        return isValid;
    };

    // Add debounced validation for inputs
    let validationTimeouts = {};

    fieldConfigs.forEach(({ input, errorId }) => {
        if (!input) return;
        const eventName = input.tagName === 'SELECT' ? 'change' : 'input';

        input.addEventListener(eventName, () => {
            clearFieldError(input, errorId);

            // Debounce email validation
            if (input === contactEmail) {
                clearTimeout(validationTimeouts.email);
                validationTimeouts.email = setTimeout(() => {
                    if (input.value && input.validity.typeMismatch) {
                        setFieldError(input, errorId, 'Zadejte platný email.');
                    }
                }, 500);
            }
        });
    });

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!contactForm.action) return;
        if (!validateContactForm()) {
            if (statusEl) statusEl.textContent = 'Zkontrolujte prosím povinná pole.';
            return;
        }

        if (statusEl) statusEl.textContent = 'Odesílám...';
        if (submitBtn) submitBtn.disabled = true;

        try {
            // Netlify Forms vyžadují URL-encoded body a form-name field
            const formData = new FormData(contactForm);
            const params = new URLSearchParams();
            for (const [key, value] of formData.entries()) {
                params.append(key, typeof value === 'string' ? value : String(value));
            }
            if (!params.has('form-name')) params.set('form-name', 'contact');

            const response = await fetch('/', {
                method: 'POST',
                body: params.toString(),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json, text/html;q=0.9'
                }
            });

            // Netlify vrací 200 redirect na thank-you stránku
            if (response.ok || response.status === 200) {
                if (statusEl) statusEl.textContent = 'Děkuji! Zpráva byla odeslána.';
                contactForm.reset();
            } else {
                if (statusEl) statusEl.textContent = 'Odeslání se nepodařilo. Zkuste to prosím znovu.';
            }
        } catch (err) {
            console.error('Contact form submit failed.', err);
            if (statusEl) statusEl.textContent = 'Odeslání se nepodařilo. Zkuste to prosím znovu.';
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

// Initialize AI Writing Assistant
const writingAssistant = new AIWritingAssistant();
