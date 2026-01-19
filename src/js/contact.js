/**
 * Contact form module with AI Writing Assistant
 * Lazy loaded when contact section is visible
 */

class AIWritingAssistant {
  constructor() {
    this.messageInput = document.getElementById('contactMessage');
    this.suggestionsContainer = document.getElementById('aiSuggestions');
    this.lastMessage = '';
    this.debounceTimer = null;
    if (!this.messageInput || !this.suggestionsContainer) return;
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
    const projectTypes = ['fotografie', 'fotka', 'focen\u00ed', 'foto', 'chatbot', 'ai', 'automatizace', 'web', 'aplikace'];
    const hasProjectType = projectTypes.some(type => normalized.includes(type));

    if (message.length < 50) {
      suggestions.push({ type: 'warning', text: '\ud83d\udca1 Zkuste b\u00fdt konkr\u00e9tn\u011bj\u0161\u00ed - AI m\u016f\u017ee pomoci roz\u0161\u00ed\u0159it text.' });
      const expandedText = this.expandShortMessage(message);
      if (expandedText) generatedTexts.push({ type: 'generated', text: expandedText, label: '\u2728 AI n\u00e1vrh roz\u0161\u00ed\u0159en\u00ed:' });
    }

    if (!hasProjectType && message.length > 30) {
      suggestions.push({ type: 'info', text: '\ud83c\udfaf Uve\u010fte typ projektu - AI m\u016f\u017ee doplnit detaily.' });
    }

    const hasDeadline = normalized.includes('term\u00edn') || normalized.includes('kdy') || normalized.includes('datum') || /\d{1,2}\.\d{1,2}/.test(message);
    const hasBudget = normalized.includes('rozpo\u010det') || normalized.includes('budget') || normalized.includes('cena') || normalized.includes('kolik');

    if (!hasDeadline && message.length > 50 && hasProjectType) {
      generatedTexts.push({ type: 'generated', text: this.addDeadlineToText(message), label: '\ud83d\udcc5 Verze s term\u00ednem:' });
    }
    if (!hasBudget && message.length > 50 && hasProjectType) {
      generatedTexts.push({ type: 'generated', text: this.addBudgetToText(message), label: '\ud83d\udcb0 Verze s rozpo\u010dtem:' });
    }
    if (message.length > 100 && hasProjectType && (hasDeadline || hasBudget)) {
      suggestions.push({ type: 'success', text: '\u2705 V\u00fdborn\u011b! Va\u0161e zpr\u00e1va je kompletn\u00ed.' });
    }

    this.renderSuggestions(suggestions, generatedTexts);
  }
  
  expandShortMessage(message) {
    const normalized = message.toLowerCase();
    if (normalized.includes('pot\u0159ebuj') || normalized.includes('chci')) {
      if (normalized.includes('focen') || normalized.includes('foto')) {
        if (normalized.includes('portr\u00e9t')) return `Dobr\u00fd den, pot\u0159ebuji focen\u00ed portr\u00e9t\u016f. Zaj\u00edm\u00e1 m\u011b v\u00e1\u0161 p\u0159\u00edstup k portr\u00e9tn\u00ed fotografii a cenov\u00e1 nab\u00eddka.`;
        if (normalized.includes('sport')) return `Zdrav\u00edm, hled\u00e1m fotografa na sportovn\u00ed akci. Zaj\u00edmala by m\u011b va\u0161e zku\u0161enost se sportovn\u00ed fotografi\u00ed.`;
        return `Dobr\u00fd den, m\u00e1m z\u00e1jem o fotografick\u00e9 slu\u017eby. Cht\u011bl bych se dozv\u011bd\u011bt v\u00edce o portfoliu a cen\u00e1ch.`;
      }
      if (normalized.includes('chatbot') || normalized.includes('ai')) {
        return `Zdrav\u00edm, m\u00e1m z\u00e1jem o vytvo\u0159en\u00ed AI chatbota pro web. Zaj\u00edm\u00e1 m\u011b technick\u00e9 \u0159e\u0161en\u00ed a cenov\u00e1 kalkulace.`;
      }
    }
    return null;
  }
  
  addDeadlineToText(message) {
    return `${message}\n\nP\u0159edpokl\u00e1dan\u00fd term\u00edn realizace: co nejd\u0159\u00edve / do konce m\u011bs\u00edce.`;
  }
  
  addBudgetToText(message) {
    return `${message}\n\nOrienta\u010dn\u00ed rozpo\u010det: 5 000 - 20 000 K\u010d.`;
  }
  
  renderSuggestions(suggestions, generatedTexts) {
    if (suggestions.length === 0 && generatedTexts.length === 0) {
      this.suggestionsContainer.innerHTML = '';
      return;
    }
    let html = suggestions.map(s => `<div class="ai-suggestion ${s.type}">${s.text}</div>`).join('');
    html += generatedTexts.map(g => `
      <div class="ai-generated-text">
        <div class="font-semibold text-purple-400 mb-2">${g.label}</div>
        <div class="text-gray-300 mb-2">${g.text}</div>
        <button class="ai-action-btn use-text-btn" data-text="${this.escapeHtml(g.text)}">\u2713 Pou\u017e\u00edt</button>
      </div>
    `).join('');

    this.suggestionsContainer.innerHTML = html;
    this.suggestionsContainer.querySelectorAll('.use-text-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.messageInput.value = btn.dataset.text;
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
function initContactForm() {
  const contactForm = document.getElementById('contactForm');
  if (!contactForm) return;

  const statusEl = document.getElementById('contactStatus');
  const submitBtn = contactForm.querySelector('button[type="submit"]');
  const fields = [
    { input: document.getElementById('contactName'), errorId: 'contactNameError' },
    { input: document.getElementById('contactEmail'), errorId: 'contactEmailError' },
    { input: document.getElementById('contactService'), errorId: 'contactServiceError' },
    { input: document.getElementById('contactMessage'), errorId: 'contactMessageError' }
  ];

  const setFieldError = (input, errorId, message) => {
    const errorEl = document.getElementById(errorId);
    if (errorEl) { errorEl.textContent = message; errorEl.classList.add('is-visible'); }
    input?.setAttribute('aria-invalid', 'true');
  };

  const clearFieldError = (input, errorId) => {
    const errorEl = document.getElementById(errorId);
    errorEl?.classList.remove('is-visible');
    input?.removeAttribute('aria-invalid');
  };

  const validateForm = () => {
    let isValid = true;
    fields.forEach(({ input, errorId }) => {
      if (!input) return;
      if (!input.value.trim()) {
        setFieldError(input, errorId, 'Toto pole je povinn\u00e9');
        isValid = false;
      } else {
        clearFieldError(input, errorId);
      }
    });
    const emailInput = document.getElementById('contactEmail');
    if (emailInput?.value && emailInput.validity.typeMismatch) {
      setFieldError(emailInput, 'contactEmailError', 'Zadejte platn\u00fd email.');
      isValid = false;
    }
    return isValid;
  };

  fields.forEach(({ input, errorId }) => {
    if (!input) return;
    const eventName = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(eventName, () => clearFieldError(input, errorId));
  });

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!contactForm.action) return;
    if (!validateForm()) {
      if (statusEl) statusEl.textContent = 'Zkontrolujte povinn\u00e1 pole.';
      return;
    }
    if (statusEl) statusEl.textContent = 'Odes\u00edl\u00e1m...';
    if (submitBtn) submitBtn.disabled = true;

    try {
      const response = await fetch(contactForm.action, {
        method: 'POST',
        body: new FormData(contactForm),
        headers: { 'Accept': 'application/json' }
      });
      if (response.ok) {
        if (statusEl) statusEl.textContent = 'D\u011bkuji! Zpr\u00e1va byla odesl\u00e1na.';
        contactForm.reset();
      } else {
        if (statusEl) statusEl.textContent = 'Odesl\u00e1n\u00ed se nezda\u0159ilo.';
      }
    } catch (err) {
      if (statusEl) statusEl.textContent = 'Odesl\u00e1n\u00ed se nezda\u0159ilo.';
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

// Init
new AIWritingAssistant();
initContactForm();
