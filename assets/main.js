// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    function cleanConflictMarkers() {
        const markers = ['<<<<<<<', '=======', '>>>>>>>'];

        const cleanTextNode = (node) => {
            let text = node.nodeValue;
            let changed = false;

            markers.forEach(marker => {
                if (text.includes(marker)) {
                    text = text.split(marker).join('');
                    changed = true;
                }
            });

            if (changed) {
                node.nodeValue = text;
            }
        };

        const textWalker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null
        );

        while (textWalker.nextNode()) {
            cleanTextNode(textWalker.currentNode);
        }

        const commentWalker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_COMMENT,
            null
        );

        const commentsToRemove = [];
        while (commentWalker.nextNode()) {
            const commentNode = commentWalker.currentNode;
            if (markers.some(marker => commentNode.nodeValue.includes(marker))) {
                commentsToRemove.push(commentNode);
            }
        }

        commentsToRemove.forEach(node => node.parentNode?.removeChild(node));
    }

    cleanConflictMarkers();
    const storage = {
        get(key) {
            try {
                return localStorage.getItem(key);
            } catch (e) {
                console.warn('LocalStorage read failed.', e);
                return null;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (e) {
                console.warn('LocalStorage write failed.', e);
                return false;
            }
        },
        remove(key) {
            try {
                localStorage.removeItem(key);
            } catch (e) {
                console.warn('LocalStorage remove failed.', e);
            }
        }
    };

    const themeToggle = document.getElementById('themeToggle');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    function applyTheme(theme) {
        const useLight = theme === 'light';
        document.documentElement.classList.toggle('theme-light', useLight);
        storage.set('ld_theme', useLight ? 'light' : 'dark');
        if (themeToggle) {
            themeToggle.textContent = useLight ? '\ud83c\udf19' : '\u2600\ufe0f';
        }
    }

    const savedTheme = storage.get('ld_theme');
    applyTheme(savedTheme ? savedTheme : (prefersDark ? 'dark' : 'light'));

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const nextTheme = document.documentElement.classList.contains('theme-light') ? 'dark' : 'light';
            applyTheme(nextTheme);
        });
    }
    const scrollProgress = document.getElementById('scrollProgress');
    const headerEl = document.querySelector('header');
    let scrollTicking = false;

    const updateScrollUI = () => {
        if (scrollProgress) {
            const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrolled = windowHeight > 0 ? (window.scrollY / windowHeight) * 100 : 0;
            scrollProgress.style.width = scrolled + '%';
        }
        if (headerEl) {
            headerEl.classList.toggle('is-scrolled', window.scrollY > 12);
        }
        scrollTicking = false;
    };

    if (scrollProgress || headerEl) {
        updateScrollUI();
        window.addEventListener('scroll', () => {
            if (!scrollTicking) {
                scrollTicking = true;
                requestAnimationFrame(updateScrollUI);
            }
        }, { passive: true });
    }

    const cursorSpotlight = document.getElementById('cursorSpotlight');
    const heroAmbient = document.querySelector('.hero-ambient');
    let mouseX = 0;
    let mouseY = 0;
    let mouseTicking = false;

    const updateMouseEffects = () => {
        if (cursorSpotlight) {
            cursorSpotlight.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
            cursorSpotlight.style.opacity = '1';
        }
        if (heroAmbient) {
            const x = (mouseX / window.innerWidth - 0.5) * 20;
            const y = (mouseY / window.innerHeight - 0.5) * 20;
            heroAmbient.style.setProperty('--hero-x', `${x}px`);
            heroAmbient.style.setProperty('--hero-y', `${y}px`);
        }
        mouseTicking = false;
    };

    if (cursorSpotlight || heroAmbient) {
        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            if (!mouseTicking) {
                mouseTicking = true;
                requestAnimationFrame(updateMouseEffects);
            }
        }, { passive: true });
    }
    function setupRevealAnimations() {
        const revealElements = document.querySelectorAll('.reveal');
        if (!revealElements.length) return;

        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });

        revealElements.forEach(el => observer.observe(el));
    }

    setupRevealAnimations();

const typingText = document.getElementById('typingText');
if (typingText) {
    const texts = ['Fotograf & AI Developer', 'Kreativn\u00ed Vizion\u00e1\u0159', 'Tech Enthusiast'];
    let textIndex = 0, charIndex = 0, isDeleting = false;
    function typeText() {
        const currentText = texts[textIndex];
        if (isDeleting) {
            typingText.textContent = currentText.substring(0, charIndex - 1);
            charIndex--;
        } else {
            typingText.textContent = currentText.substring(0, charIndex + 1);
            charIndex++;
        }
        if (!isDeleting && charIndex === currentText.length) {
            setTimeout(() => isDeleting = true, 2000);
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            textIndex = (textIndex + 1) % texts.length;
        }
        setTimeout(typeText, isDeleting ? 50 : 100);
    }
    typeText();
}

function animateCounter(element) {
    const target = parseInt(element.getAttribute('data-count'));
    const duration = 2000;
    const step = target / (duration / 16);
    let current = 0;
    const timer = setInterval(() => {
        current += step;
        if (current >= target) {
            element.textContent = target + '+';
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 16);
}
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            if (entry.target.hasAttribute('data-count')) {
                animateCounter(entry.target);
                observer.unobserve(entry.target);
            }
            if (entry.target.classList.contains('skill-bar')) {
                const width = entry.target.getAttribute('data-width');
                entry.target.style.width = width + '%';
                observer.unobserve(entry.target);
            }
        }
    });
}, { threshold: 0.5 });
document.querySelectorAll('[data-count]').forEach(el => observer.observe(el));
document.querySelectorAll('.skill-bar').forEach(el => observer.observe(el));

const testimonialsSlider = document.getElementById('testimonialsSlider');
const prevTestimonial = document.getElementById('prevTestimonial');
const nextTestimonial = document.getElementById('nextTestimonial');
const testimonialDots = document.querySelectorAll('.testimonial-dot');
let currentTestimonial = 0;
const totalTestimonials = 3;

if (testimonialsSlider && prevTestimonial && nextTestimonial && testimonialDots.length) {
    function showTestimonial(index) {
        currentTestimonial = (index + totalTestimonials) % totalTestimonials;
        testimonialsSlider.style.transform = `translateX(-${currentTestimonial * 100}%)`;
        testimonialDots.forEach((dot, i) => {
            if (i === currentTestimonial) {
                dot.classList.remove('bg-gray-600');
                dot.classList.add('bg-blue-500');
            } else {
                dot.classList.remove('bg-blue-500');
                dot.classList.add('bg-gray-600');
            }
        });
    }

    prevTestimonial.addEventListener('click', () => showTestimonial(currentTestimonial - 1));
    nextTestimonial.addEventListener('click', () => showTestimonial(currentTestimonial + 1));
    testimonialDots.forEach((dot, index) => {
        dot.addEventListener('click', () => showTestimonial(index));
    });
    setInterval(() => showTestimonial(currentTestimonial + 1), 5000);
}

const newsletterForm = document.getElementById('newsletterForm');
if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const statusEl = document.getElementById('newsletterStatus');
        const emailInput = e.target.querySelector('input[type="email"]');
        const email = emailInput ? emailInput.value.trim() : '';
        if (!email) {
            if (statusEl) statusEl.textContent = 'Zadejte prosim email.';
            return;
        }
        if (statusEl) statusEl.textContent = `Dekuji! Newsletter bude zaslan na: ${email}`;
        e.target.reset();
    });
}
const isLowPowerDevice = () => {
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;
    const connection = navigator.connection;
    const saveData = connection && connection.saveData;
    const effectiveType = connection && connection.effectiveType;
    return Boolean(
        saveData ||
        memory <= 4 ||
        cores <= 4 ||
        (effectiveType && effectiveType.includes('2g'))
    );
};

class NeuralNetworkVisualization {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.neurons = [];
        this.connections = [];
        this.mouse = { x: 0, y: 0 };
        this.pointer = { x: 0, y: 0 };
        this.pointerDirty = false;
        this.activityLevel = 0;
        this.lastFrameTime = 0;
        this.frameInterval = 1000 / 24;
        this.lowPower = isLowPowerDevice();
        this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.isPaused = false;
        this.width = 0;
        this.height = 0;

        if (this.lowPower) {
            this.frameInterval = 1000 / 12;
        }
        
        this.resize();
        this.animate();

        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.resize(), 150);
        });
        document.addEventListener('mousemove', (e) => {
            this.pointer.x = e.clientX;
            this.pointer.y = e.clientY;
            this.pointerDirty = true;
        }, { passive: true });
        
        document.addEventListener('visibilitychange', () => {
            this.isPaused = document.hidden;
            if (!this.isPaused) {
                this.lastFrameTime = 0;
                this.animate();
            }
        });
        
        document.addEventListener('click', () => {
            this.activityLevel = Math.min(this.activityLevel + 0.5, 1);
        });
    }
    
    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        const scale = Math.min(window.devicePixelRatio || 1, 1.25);
        this.canvas.width = Math.floor(this.width * scale);
        this.canvas.height = Math.floor(this.height * scale);
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
        this.ctx.setTransform(scale, 0, 0, scale, 0, 0);

        this.neurons = [];
        this.connections = [];
        this.init();
    }

    init() {
        const layers = this.lowPower ? [4, 6, 4] : [5, 8, 6, 5];
        const spacing = this.width / (layers.length + 1);
        
        layers.forEach((count, layerIndex) => {
            const layerHeight = this.height / (count + 1);
            
            for (let i = 0; i < count; i++) {
                this.neurons.push({
                    x: spacing * (layerIndex + 1),
                    y: layerHeight * (i + 1),
                    layer: layerIndex,
                    index: i,
                    activation: Math.random(),
                    pulsePhase: Math.random() * Math.PI * 2
                });
            }
        });
        
        for (let i = 0; i < this.neurons.length; i++) {
            const neuron = this.neurons[i];
            
            for (let j = 0; j < this.neurons.length; j++) {
                const target = this.neurons[j];
                
                if (target.layer === neuron.layer + 1) {
                    this.connections.push({
                        from: neuron,
                        to: target,
                        weight: Math.random() * 2 - 1
                    });
                }
            }
        }
    }
    
    animate(timestamp = 0) {
        if (this.reduceMotion || this.isPaused) return;

        if (this.pointerDirty) {
            this.mouse.x = this.pointer.x;
            this.mouse.y = this.pointer.y;
            this.pointerDirty = false;
        }

        if (!this.lastFrameTime) {
            this.lastFrameTime = timestamp;
        }

        const delta = timestamp - this.lastFrameTime;
        if (delta < this.frameInterval) {
            requestAnimationFrame((next) => this.animate(next));
            return;
        }

        this.lastFrameTime = timestamp;
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        this.activityLevel *= 0.95;
        
        this.neurons.forEach(neuron => {
            neuron.pulsePhase += 0.02;
            
            const dx = neuron.x - this.mouse.x;
            const dy = neuron.y - this.mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 150) {
                neuron.activation = Math.min(1, neuron.activation + 0.1);
            } else {
                neuron.activation *= 0.98;
            }
            
            neuron.activation += this.activityLevel * 0.1;
            neuron.activation = Math.max(0.1, Math.min(1, neuron.activation));
        });
        
        this.connections.forEach(conn => {
            const alpha = (conn.from.activation + conn.to.activation) / 2;

            this.ctx.beginPath();
            this.ctx.moveTo(conn.from.x, conn.from.y);
            this.ctx.lineTo(conn.to.x, conn.to.y);
            
            const gradient = this.ctx.createLinearGradient(
                conn.from.x, conn.from.y,
                conn.to.x, conn.to.y
            );
            
            gradient.addColorStop(0, `rgba(59, 130, 246, ${alpha * 0.45})`);
            gradient.addColorStop(1, `rgba(168, 85, 247, ${alpha * 0.45})`);
            
            this.ctx.strokeStyle = gradient;
            this.ctx.lineWidth = Math.abs(conn.weight) * 2;
            this.ctx.stroke();
        });
        
        this.neurons.forEach(neuron => {
            const pulse = Math.sin(neuron.pulsePhase) * 0.3 + 0.7;
            const radius = 4 + neuron.activation * 4 * pulse;
            
            const gradient = this.ctx.createRadialGradient(
                neuron.x, neuron.y, 0,
                neuron.x, neuron.y, radius * 3
            );
            
            gradient.addColorStop(0, `rgba(59, 130, 246, ${neuron.activation * 0.8})`);
            gradient.addColorStop(0.5, `rgba(168, 85, 247, ${neuron.activation * 0.4})`);
            gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(neuron.x, neuron.y, radius * 3, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = `rgba(255, 255, 255, ${neuron.activation})`;
            this.ctx.beginPath();
            this.ctx.arc(neuron.x, neuron.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        requestAnimationFrame((next) => this.animate(next));
    }
}

const neuralCanvas = document.getElementById('neuralCanvas');
let neuralViz = null;
if (neuralCanvas) {
    setTimeout(() => {
        neuralViz = new NeuralNetworkVisualization(neuralCanvas);
    }, 1000);
}

// AI WRITING ASSISTANT
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
        
        // Detekce co u\u017eivatel chce a generov\u00e1n\u00ed textu
        if (message.length < 50) {
            suggestions.push({
                type: 'warning',
                text: '\ud83d\udca1 Zkuste b\u00fdt konkr\u00e9tn\u011bj\u0161\u00ed - AI m\u016f\u017ee pomoci roz\u0161\u00ed\u0159it text.'
            });
            
            // Nab\u00eddnout roz\u0161\u00ed\u0159en\u00ed
            const expandedText = this.expandShortMessage(message);
            if (expandedText) {
                generatedTexts.push({
                    type: 'generated',
                    text: expandedText,
                    label: '\u2728 AI n\u00e1vrh roz\u0161\u00ed\u0159en\u00ed:'
                });
            }
        }
        
        const projectTypes = ['fotografie', 'fotka', 'focen\u00ed', 'foto', 'chatbot', 'ai', 'automatizace', 'web', 'aplikace'];
        const hasProjectType = projectTypes.some(type => normalized.includes(type));
        
        if (!hasProjectType && message.length > 30) {
            suggestions.push({
                type: 'info',
                text: '\ud83c\udfaf Uve\u010fte typ projektu - AI m\u016f\u017ee doplnit detaily.'
            });
        }
        
        const hasDeadline = normalized.includes('term\u00edn') || normalized.includes('kdy') || 
                           normalized.includes('datum') || /\d{1,2}\.\d{1,2}/.test(message);
        
        if (!hasDeadline && message.length > 50 && hasProjectType) {
            const textWithDeadline = this.addDeadlineToText(message);
            generatedTexts.push({
                type: 'generated',
                text: textWithDeadline,
                label: '\ud83d\udcc5 Verze s term\u00ednem:'
            });
        }
        
        const hasBudget = normalized.includes('rozpo\u010det') || normalized.includes('budget') || 
                         normalized.includes('cena') || normalized.includes('kolik');
        
        if (!hasBudget && message.length > 50 && hasProjectType) {
            const textWithBudget = this.addBudgetToText(message);
            generatedTexts.push({
                type: 'generated',
                text: textWithBudget,
                label: '\ud83d\udcb0 Verze s rozpo\u010dtem:'
            });
        }
        
        if (message.length > 100 && hasProjectType && (hasDeadline || hasBudget)) {
            suggestions.push({
                type: 'success',
                text: '\u2705 V\u00fdborn\u011b! Va\u0161e zpr\u00e1va je kompletn\u00ed.'
            });
        }
        
        this.renderSuggestions(suggestions, generatedTexts);
    }
    
    expandShortMessage(message) {
        const normalized = message.toLowerCase();
        
        if (normalized.includes('pot\u0159ebuj') || normalized.includes('chci')) {
            if (normalized.includes('focen') || normalized.includes('foto')) {
                if (normalized.includes('portr\u00e9t')) {
                    return `Dobr\u00fd den, pot\u0159ebuji focen\u00ed portr\u00e9t\u016f. Zaj\u00edm\u00e1 m\u011b v\u00e1\u0161 p\u0159\u00edstup k portr\u00e9tn\u00ed fotografii a cenov\u00e1 nab\u00eddka. R\u00e1d bych prodiskutoval mo\u017enosti lokace a stylu focen\u00ed. D\u011bkuji.`;
                }
                if (normalized.includes('sport')) {
                    return `Zdrav\u00edm, hled\u00e1m fotografa na sportovn\u00ed akci. Zaj\u00edmala by m\u011b va\u0161e zku\u0161enost se sportovn\u00ed fotografi\u00ed a dostupnost v n\u00e1sleduj\u00edc\u00edch m\u011bs\u00edc\u00edch. M\u016f\u017eeme si domluvit konzultaci?`;
                }
                if (normalized.includes('produkt')) {
                    return `Dobr\u00fd den, pot\u0159ebuji produktovou fotografii pro e-shop. Zaj\u00edm\u00e1 m\u011b v\u00e1\u0161 proces, p\u0159\u00edpadn\u00e9 uk\u00e1zky p\u0159edchoz\u00edch prac\u00ed a orienta\u010dn\u00ed cena. T\u011b\u0161\u00edm se na odpov\u011b\u010f.`;
                }
                return `Dobr\u00fd den, m\u00e1m z\u00e1jem o fotografick\u00e9 slu\u017eby. Cht\u011bl bych se dozv\u011bd\u011bt v\u00edce o va\u0161em portfoliu, cen\u00e1ch a dostupnosti. M\u016f\u017eeme si domluvit \u00favodn\u00ed konzultaci? D\u011bkuji.`;
            }
            
            if (normalized.includes('chatbot') || normalized.includes('ai')) {
                return `Zdrav\u00edm, m\u00e1m z\u00e1jem o vytvo\u0159en\u00ed AI chatbota pro m\u016fj web. Zaj\u00edm\u00e1 m\u011b technick\u00e9 \u0159e\u0161en\u00ed, mo\u017enosti integrace a cenov\u00e1 kalkulace. M\u016f\u017eeme probrat detaily projektu?`;
            }
            
            if (normalized.includes('automatizace')) {
                return `Dobr\u00fd den, hled\u00e1m \u0159e\u0161en\u00ed pro automatizaci firemn\u00edch proces\u016f. Zaj\u00edmala by m\u011b va\u0161e zku\u0161enost s podobn\u00fdmi projekty a mo\u017en\u00fd rozsah spolupr\u00e1ce. T\u011b\u0161\u00edm se na diskuzi.`;
            }
        }
        
        return null;
    }
    
    addDeadlineToText(message) {
        return `${message}\n\nP\u0159edpokl\u00e1dan\u00fd term\u00edn realizace: co nejd\u0159\u00edve / do konce m\u011bs\u00edce (pros\u00edm up\u0159esn\u011bte podle va\u0161ich pot\u0159eb).`;
    }
    
    addBudgetToText(message) {
        return `${message}\n\nOrienta\u010dn\u00ed rozpo\u010det: 5 000 - 20 000 K\u010d (pros\u00edm up\u0159esn\u011bte v\u00e1\u0161 rozpo\u010det pro p\u0159esn\u011bj\u0161\u00ed nab\u00eddku).`;
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
                        \u2713 Pou\u017e\u00edt tento text
                    </button>
                    <button class="ai-action-btn append-text-btn" data-text="${this.escapeHtml(g.text)}">
                        + P\u0159idat k m\u00e9mu textu
                    </button>
                </div>
            `;
        });
        
        this.suggestionsContainer.innerHTML = html;
        
        // Event listeners pro tla\u010d\u00edtka
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

const writingAssistant = new AIWritingAssistant();
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    const statusEl = document.getElementById('contactStatus');
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const contactName = document.getElementById('contactName');
    const contactEmail = document.getElementById('contactEmail');
    const contactService = document.getElementById('contactService');
    const contactMessage = document.getElementById('contactMessage');
    const fieldConfigs = [
        { input: contactName, errorId: 'contactNameError', message: 'Toto pole je povinn\u00e9' },
        { input: contactEmail, errorId: 'contactEmailError', message: 'Toto pole je povinn\u00e9' },
        { input: contactService, errorId: 'contactServiceError', message: 'Toto pole je povinn\u00e9' },
        { input: contactMessage, errorId: 'contactMessageError', message: 'Toto pole je povinn\u00e9' }
    ];

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
            setFieldError(contactEmail, 'contactEmailError', 'Zadejte platn\u00fd email.');
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
            if (statusEl) statusEl.textContent = 'Zkontrolujte pros\u00edm povinn\u00e1 pole.';
            return;
        }

        if (statusEl) statusEl.textContent = 'Odesilam...';
        if (submitBtn) submitBtn.disabled = true;

        try {
            const formData = new FormData(contactForm);
            const response = await fetch(contactForm.action, {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                if (statusEl) statusEl.textContent = 'Dekuji! Zprava byla odeslana.';
                contactForm.reset();
            } else {
                if (statusEl) statusEl.textContent = 'Odeslani se nepodarilo. Zkuste to prosim znovu.';
            }
        } catch (err) {
            console.error('Contact form submit failed.', err);
            if (statusEl) statusEl.textContent = 'Odeslani se nepodarilo. Zkuste to prosim znovu.';
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

// ENHANCED AI CHATBOT
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
            positive: ['skv\u011ble', 'super', 'd\u00edky', 'perfektn\u00ed', 'v\u00fdborn\u011b', 'ano'],
            negative: ['probl\u00e9m', 'nefunguje', '\u0161patn\u00e9', 'nel\u00edb\u00ed', 'bohu\u017eel', 'nejde']
        };
        this.faq = [
            { patterns: ['jak dlouho', 'trv\u00e1 focen\u00ed'], answer: 'Portr\u00e9tn\u00ed session 1-2 hodiny, sport dle akce.' },
            { patterns: ['kdy dostanu', 'dod\u00e1n\u00ed fotek'], answer: 'Fotky dod\u00e1v\u00e1m do 7-14 dn\u016f.' },
            { patterns: ['kde fot\u00edte', 'lokalita'], answer: 'S\u00eddl\u00edm v P\u0159erov\u011b, fot\u00edm po cel\u00e9 Morav\u011b.' },
            { patterns: ['co je fotograf ai'], answer: 'Moje autorsk\u00e1 aplikace pro AI postprodukci fotek.' },
            { patterns: ['form\u00e1t', 'raw', 'jpg'], answer: 'Standardn\u011b JPEG, RAW na vy\u017e\u00e1d\u00e1n\u00ed.' }
        ];
        this.defaultQuickReplies = [
            { text: '\ud83d\udcf7 Portr\u00e9ty', value: 'D\u011bl\u00e1\u0161 portr\u00e9tn\u00ed focen\u00ed?' },
            { text: '\ud83c\udfdf\ufe0f Sport', value: 'Fot\u00ed\u0161 sportovn\u00ed akce?' },
            { text: '\u2728 Fotograf AI', value: 'Jak funguje Fotograf AI?' },
            { text: '\ud83d\udcb0 Ceny', value: 'Kolik to stoj\u00ed?' }
        ];

        this.init();
    }

    buildKnowledgeBase() {
        return {
            services: {
                photography: {
                    portrait: {
                        description: 'Portr\u00e9tn\u00ed fotografie v ateli\u00e9ru i venku s d\u016frazem na v\u00fdraz a sv\u011btlo',
                        keywords: ['portr\u00e9t', 'portrait', 'lid\u00e9', 'osoba', 'portr\u00e9tn\u00ed']
                    },
                    sport: {
                        description: 'Sportovn\u00ed a ak\u010dn\u00ed fotografie s d\u016frazem na timing',
                        keywords: ['sport', 'akce', 'ak\u010dn\u00ed', 'z\u00e1pas', 'tr\u00e9nink']
                    },
                    action: {
                        description: 'Ak\u010dn\u00ed sekvence a s\u00e9rie sn\u00edmk\u016f pro dynamick\u00fd p\u0159\u00edb\u011bh',
                        keywords: ['sekvence', 's\u00e9rie', 'pohyb', 'dynamika']
                    }
                },
                ai: {
                    fotograf_ai: {
                        description: 'Fotograf AI (semiagent) pro rychlou postprodukci a konzistentn\u00ed styl',
                        keywords: ['fotograf ai', 'fotograf', 'ai postprodukce', 'postprodukce', 'retu\u0161']
                    },
                    vibecoding: {
                        description: 'Vibecoding a prototypov\u00e1n\u00ed s Claude, Gemini, ChatGPT a Codex',
                        keywords: ['vibecoding', 'claude', 'gemini', 'chatgpt', 'codex']
                    },
                    agent_coding: {
                        description: 'Agentn\u00ed k\u00f3dov\u00e1n\u00ed pro rychl\u00e9 iterace a automatizaci workflow',
                        keywords: ['agentn\u00ed', 'agent', 'agentn\u00ed k\u00f3dov\u00e1n\u00ed']
                    },
                    automation: {
                        description: 'Automatizace workflow a proces\u016f',
                        keywords: ['automatizace', 'automatick\u00fd', 'proces', 'workflow']
                    }
                }
            },
            contact: {
                email: 'lukas.drsticka@gmail.com',
                location: 'P\u0159erov'
            }
        };
    }

    buildSynonyms() {
        return {
            greeting: ['ahoj', '\u010dau', 'nazdar', 'dobr\u00fd den', 'hello', 'hi', 'hej'],
            thanks: ['d\u011bkuji', 'd\u00edk', 'd\u00edky', 'thanks'],
            price_inquiry: ['cena', 'cen\u00edk', 'kolik', 'stoj\u00ed', 'rozpo\u010det'],
            contact_request: ['kontakt', 'napsat', 'email', 'telefon'],
            booking: ['term\u00edn', 'rezervace', 'rezervovat', 'domluvit', 'sch\u016fzka'],
            availability: ['dostupnost', 'voln\u00fd', 'kdy m\u016f\u017ee\u0161', 'kdy m\u00e1\u0161'],
            delivery_time: ['dod\u00e1n\u00ed', 'term\u00edn dod\u00e1n\u00ed', 'kdy budou', 'jak dlouho'],
            portrait: ['portr\u00e9t', 'portr\u00e9tn\u00ed', 'portrait', 'lid\u00e9'],
            sport: ['sport', 'z\u00e1pas', 'tr\u00e9nink', 'akce'],
            postproduction: ['postprodukce', 'retu\u0161', '\u00fapravy'],
            fotograf_ai: ['fotograf ai', 'ai postprodukce', 'semiagent'],
            ai_stack: ['chatgpt', 'codex', 'claude', 'gemini', 'vibecoding', 'agentn\u00ed'],
            portfolio: ['portfolio', 'uk\u00e1zka', 'reference', 'pr\u00e1ce']
        };
    }

    buildIntents() {
        return {
            greeting: {
                patterns: ['ahoj', '\u010dau', 'dobr\u00fd den', 'nazdar', 'hej', 'hello', 'hi'],
                responses: [
                    'Ahoj! Jsem AI asistent Luk\u00e1\u0161e. Jak ti m\u016f\u017eu pomoct?',
                    'Zdrav\u00edm! Co t\u011b zaj\u00edm\u00e1 - sportovn\u00ed, portr\u00e9tn\u00ed focen\u00ed nebo AI/automatizace?'
                ]
            },
            thanks: {
                patterns: ['d\u011bkuji', 'd\u00edk', 'd\u00edky', 'thanks'],
                responses: [
                    'R\u00e1do se stalo! Pokud chce\u0161, napi\u0161 p\u00e1r detail\u016f (term\u00edn, m\u00edsto, o\u010dek\u00e1v\u00e1n\u00ed).',
                    'Nen\u00ed za\u010d! M\u016f\u017eeme rovnou domluvit term\u00edn nebo proj\u00edt portfolio.'
                ]
            },
            capabilities: {
                patterns: ['co um\u00ed\u0161', 'co d\u011bl\u00e1\u0161', 'co nab\u00edz\u00ed\u0161', 'slu\u017eby', 'schopnosti', 'co zvl\u00e1d\u00e1\u0161', 'jak mi pom\u016f\u017ee\u0161'],
                responses: [
                    'Um\u00edm poradit se sportovn\u00ed i portr\u00e9tn\u00ed fotkou, postprodukc\u00ed (Fotograf AI) a AI/automatizacemi. Co je pro tebe priorita?',
                    'Jsem tady pro info o focen\u00ed, cen\u00e1ch, term\u00ednech, dod\u00e1n\u00ed a AI slu\u017eb\u00e1ch. Na co se chce\u0161 zeptat?',
                    'Pom\u016f\u017eu s v\u00fdb\u011brem slu\u017eby, domluvou term\u00ednu i vysv\u011btlen\u00edm, co je Fotograf AI. Co t\u011b zaj\u00edm\u00e1?'
                ]
            },
            assistant_info: {
                patterns: ['co um\u00ed\u0161 jako asistent', 'co um\u00ed asistent', 'jak um\u00ed\u0161 pomoct', 'co je tv\u016fj \u00fa\u010del', 'kdo jsi', 'jsi chatbot', 'jsi asistent'],
                responses: [
                    'Jsem offline asistent na tomto webu. Um\u00edm poradit s focen\u00edm, cenami, term\u00edny, dod\u00e1n\u00edm a AI slu\u017ebami.',
                    'Jako asistent odpov\u00edd\u00e1m na dotazy o slu\u017eb\u00e1ch, uk\u00e1zk\u00e1ch a kontaktu. M\u016f\u017eu i pomoci s domluvou term\u00ednu.',
                    'Jsem tu, abych rychle nasm\u011broval k informac\u00edm o focen\u00ed, postprodukci a AI projektech. Co pot\u0159ebuje\u0161?'
                ]
            },
            portfolio: {
                patterns: ['portfolio', 'uk\u00e1zky', 'uk\u00e1zka', 'reference', 'pr\u00e1ce'],
                responses: [
                    'Portfolio najde\u0161 p\u0159\u00edmo na str\u00e1nce. Chce\u0161 sportovn\u00ed nebo portr\u00e9tn\u00ed uk\u00e1zky?',
                    'R\u00e1d po\u0161lu konkr\u00e9tn\u00ed uk\u00e1zky \u2013 napi\u0161, jestli \u0159e\u0161\u00ed\u0161 sport nebo portr\u00e9t.'
                ]
            },
            price_inquiry: {
                patterns: ['kolik', 'cena', 'cen\u00edk', 'stoj\u00ed', 'price'],
                responses: [
                    'Ceny jsou individu\u00e1ln\u00ed podle rozsahu, term\u00ednu a lokality. Napi\u0161 stru\u010dn\u011b zad\u00e1n\u00ed a ozvu se: lukas.drsticka@gmail.com'
                ]
            },
            booking: {
                patterns: ['term\u00edn', 'rezervace', 'rezervovat', 'domluvit', 'sch\u016fzka'],
                responses: [
                    'Jasn\u011b, napi\u0161 pros\u00edm datum, m\u00edsto a typ focen\u00ed (sport/portr\u00e9t).',
                    'Po\u0161li term\u00edn, lokaci a o\u010dek\u00e1v\u00e1n\u00ed \u2013 p\u0159iprav\u00edm n\u00e1vrh.'
                ]
            },
            availability: {
                patterns: ['dostupnost', 'voln\u00fd', 'kdy m\u016f\u017ee\u0161', 'kdy m\u00e1\u0161'],
                responses: [
                    'Dostupnost \u0159e\u0161\u00edm individu\u00e1ln\u011b. Po\u0161li pros\u00edm term\u00edn a m\u00edsto.',
                    'Napi\u0161, kdy a kde pot\u0159ebuje\u0161 fotit, a ozvu se s potvrzen\u00edm.'
                ]
            },
            delivery_time: {
                patterns: ['dod\u00e1n\u00ed', 'term\u00edn dod\u00e1n\u00ed', 'kdy budou', 'jak dlouho'],
                responses: [
                    'Dod\u00e1n\u00ed se li\u0161\u00ed podle rozsahu. Orienta\u010dn\u011b to up\u0159esn\u00edm po zad\u00e1n\u00ed.',
                    'Jakmile zn\u00e1m rozsah, \u0159eknu ti p\u0159esn\u00fd term\u00edn dod\u00e1n\u00ed.'
                ]
            },
            contact_request: {
                patterns: ['kontakt', 'email', 'napsat', 'oslovit'],
                responses: [
                    'Email: lukas.drsticka@gmail.com - klidn\u011b napi\u0161!'
                ]
            },
            postproduction: {
                patterns: ['postprodukce', 'retu\u0161', '\u00fapravy', 'ai postprodukce'],
                responses: [
                    'Postprodukci \u0159e\u0161\u00edm p\u0159es Fotograf AI (semiagent), tak\u017ee dod\u00e1n\u00ed je rychl\u00e9 a konzistentn\u00ed.',
                    'Fotograf AI mi dr\u017e\u00ed styl nap\u0159\u00ed\u010d s\u00e9ri\u00ed a urychluje retu\u0161.'
                ]
            },
            fotograf_ai: {
                patterns: ['fotograf ai', 'semiagent', 'ai postprodukce'],
                responses: [
                    'Fotograf AI je moje semiagent aplikace pro rychlou postprodukci a jednotn\u00fd look.',
                    'Fotograf AI v\u00fdrazn\u011b zkracuje \u010das postprodukce bez ztr\u00e1ty kvality.'
                ]
            },
            ai_stack: {
                patterns: ['vibecoding', 'claude', 'gemini', 'chatgpt', 'codex', 'agentn\u00ed'],
                responses: [
                    'Tech stack: vibecoding s Claude, Gemini, ChatGPT a Codex. K tomu agentn\u00ed workflow pro automatizace.',
                    'Pou\u017e\u00edv\u00e1m Claude/Gemini/ChatGPT/Codex a agentn\u00ed k\u00f3dov\u00e1n\u00ed pro rychl\u00e9 iterace.'
                ]
            }
        };
    }

    init() {
        this.initScrollTriggers();
        this.initExitIntent();
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
                { text: ' \u23f0 Term\u00edny', value: 'Jak\u00e9 m\u00e1te term\u00edny?' },
                { text: ' \ud83d\udccd Kde fot\u00edte?', value: 'Kde fot\u00edte?' }
            ];
        }
        if (lastIntent === 'ai_services') {
            return [
                { text: ' \u2728 Fotograf AI', value: 'Co je Fotograf AI?' },
                { text: ' \ud83e\udd16 Chatboty', value: 'D\u011bl\u00e1te chatboty?' }
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
            console.debug('[Chatbot] Intent: service_info, Confidence: 0.85');
            return {
                response: `${service.data.description}. Chce\u0161 v\u011bd\u011bt v\u00edc o cen\u00e1ch nebo kontaktu?`,
                confidence: 0.85,
                intent: 'service_info'
            };
        }

        if (intentResult.intent && intentResult.confidence > 0.6) {
            const responses = this.intents[intentResult.intent].responses;
            this.userContext.intent = intentResult.intent;
            console.debug(`[Chatbot] Intent: ${intentResult.intent}, Confidence: ${intentResult.confidence}`);
            return {
                response: responses[Math.floor(Math.random() * responses.length)],
                confidence: intentResult.confidence,
                intent: intentResult.intent
            };
        }

        console.debug(`[Chatbot] Intent: fallback, Confidence: 0.3`);
        return {
            response: 'Zaj\u00edmav\u00e1 ot\u00e1zka! M\u016f\u017eu poradit se sportovn\u00ed/portr\u00e9tn\u00ed fotkou, Fotograf AI nebo cenami. Co z toho je pro tebe nejd\u016fle\u017eit\u011bj\u0161\u00ed?',
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
            'portfolio': 'L\u00edb\u00ed se v\u00e1m n\u011bco z portfolia? R\u00e1d zodpov\u00edm dotazy!',
            'kontakt': 'Pot\u0159ebujete pomoct s kontaktn\u00edm formul\u00e1\u0159em?',
            'skills': 'Zaj\u00edm\u00e1 v\u00e1s n\u011bkter\u00e1 z m\u00fdch dovednost\u00ed v\u00edce?'
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

    initExitIntent() {
        // Odstraněno - příliš agresivní pro portfolio web
    }

    saveSession() {
        localStorage.setItem('chatbot_session', JSON.stringify({
            history: this.conversationHistory,
            context: this.userContext,
            timestamp: Date.now()
        }));
    }

    loadSession() {
        const saved = JSON.parse(localStorage.getItem('chatbot_session'));
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
            'St\u00e1le jsem tu, kdybyste n\u011bco pot\u0159ebovali!',
            'Tip: Zeptejte se m\u011b na focen\u00ed nebo AI slu\u017eby.'
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
            if (sentiment === 'negative') responseText = 'Ch\u00e1pu. ' + responseText;
            addMessage('bot', responseText, responseObj.confidence, responseObj.intent);
            this.addBotMessage(responseText, responseObj.confidence, responseObj.intent);
        }

        renderQuickReplies();
        this.saveSession();
    }
}

const CHAT_STORAGE_KEY = 'chatHistory';
let chatbot = new EnhancedChatbot();
let unreadCount = 0;

const filterBtns = document.querySelectorAll('.filter-btn');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const closeLightboxBtn = document.getElementById('closeLightbox');
const lightboxControls = document.getElementById('lightboxControls');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');
let activeFilter = 'all';
let galleryKeyHandler = null;

function getPortfolioItems() {
    return Array.from(document.querySelectorAll('.portfolio-item'));
}

function setLightboxControls(visible) {
    if (!lightboxControls) return;
    lightboxControls.classList.toggle('hidden', !visible);
}

function closeLightboxModal() {
    if (!lightbox) return;
    lightbox.classList.remove('active');
    setLightboxControls(false);
    if (galleryKeyHandler) {
        document.removeEventListener('keydown', galleryKeyHandler);
        galleryKeyHandler = null;
    }
}

function setLightboxImage(src, altText) {
    if (!lightboxImg) return;
    lightboxImg.src = src;
    lightboxImg.alt = altText || 'Fotografie';
}

function openSingleLightbox(src, altText) {
    if (!(lightbox && lightboxImg)) return;
    if (galleryKeyHandler) {
        document.removeEventListener('keydown', galleryKeyHandler);
        galleryKeyHandler = null;
    }
    setLightboxImage(src, altText);
    lightbox.classList.add('active');
    setLightboxControls(false);
}

if (closeLightboxBtn) {
    closeLightboxBtn.addEventListener('click', closeLightboxModal);
}
if (lightbox) {
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightboxModal();
    });
}

function applyPortfolioFilter(filter) {
    getPortfolioItems().forEach(item => {
        item.style.display = (filter === 'all' || item.dataset.category === filter) ? 'block' : 'none';
    });
}

if (filterBtns.length) {
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.dataset.filter;
            applyPortfolioFilter(activeFilter);
        });
    });
}
const initialActiveFilter = document.querySelector('.filter-btn.active');
if (initialActiveFilter) {
    activeFilter = initialActiveFilter.dataset.filter;
}

const chatBtn = document.getElementById('chatBtn');
const chatWindow = document.getElementById('chatWindow');
const closeChat = document.getElementById('closeChat');
const clearChat = document.getElementById('clearChat');
const messages = document.getElementById('messages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const unreadBadge = document.getElementById('unreadBadge');
const quickReplies = document.getElementById('quickReplies');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu = document.getElementById('mobileMenu');

function safeInitChatbot() {
    if (!(chatBtn && chatWindow && closeChat && clearChat && messages && chatInput && sendBtn && unreadBadge && quickReplies)) {
        console.warn('Chatbot UI prvky nebyly nalezeny, inicializace p\u0159esko\u010dena.');
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
                addMessage('bot', 'Ahoj! Tady Luk\u00e1\u0161. M\u00e1m AI asistenta, kter\u00fd ti pom\u016f\u017ee. Na co se chce\u0161 zeptat?', 0.95, 'greeting');
                renderQuickReplies();
            }
        }
    });

    closeChat.addEventListener('click', () => {
        chatbot.closeChat();
    });

    clearChat.addEventListener('click', () => {
        if (confirm('Smazat celou historii?')) {
            messages.innerHTML = '';
            storage.remove(CHAT_STORAGE_KEY);
            localStorage.removeItem('chatbot_session');
            chatbot = new EnhancedChatbot();
            addMessage('bot', 'Historie smaz\u00e1na. M\u016f\u017eeme za\u010d\u00edt znovu!', 1.0, 'system');
            renderQuickReplies();
        }
    });

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Pro jistotu resetujeme badge p\u0159i na\u010dten\u00ed
    updateUnreadBadge();
    chatbot.isChatOpen = false;
}

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
        <div class="message-avatar glass">\ud83e\udd16</div>
        <div class="glass rounded-xl typing-indicator" aria-live="polite" aria-label="Asistent p\u00ed\u0161e...">
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
        `<button class="quick-reply-btn glass px-4 py-2 rounded-full text-sm mr-2 mb-2" aria-label="Rychl\u00e1 odpov\u011b\u010f: ${r.text}">${r.text}</button>`
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
safeInitChatbot();

// Mobile Menu
const mobileMenuClose = document.getElementById('mobileMenuClose');

if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
        mobileMenuBtn.classList.toggle('active');
        mobileMenu.classList.toggle('active');
        document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
    });

    // Close button
    if (mobileMenuClose) {
        mobileMenuClose.addEventListener('click', () => {
            mobileMenuBtn.classList.remove('active');
            mobileMenu.classList.remove('active');
            document.body.style.overflow = '';
        });
    }

    // Zav\u0159\u00edt menu po kliknut\u00ed na odkaz
    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenuBtn.classList.remove('active');
            mobileMenu.classList.remove('active');
            document.body.style.overflow = '';
        });
    });

    // Zav\u0159\u00edt menu p\u0159i kliknut\u00ed na overlay
    mobileMenu.addEventListener('click', (e) => {
        if (e.target === mobileMenu) {
            mobileMenuBtn.classList.remove('active');
            mobileMenu.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Zav\u0159\u00edt mobiln\u00ed menu
        if (mobileMenu && mobileMenu.classList.contains('active')) {
            if (mobileMenuBtn) mobileMenuBtn.classList.remove('active');
            mobileMenu.classList.remove('active');
            document.body.style.overflow = '';
        }
        // Zav\u0159\u00edt chat
        if (chatbot.isChatOpen) {
            chatbot.closeChat();
        }
    }
});

const announcer = document.getElementById('announcer');
const announceSection = (label) => {
    if (!announcer) return;
    announcer.textContent = '';
    window.setTimeout(() => {
        announcer.textContent = `Zobrazena sekce ${label}`;
    }, 50);
};
document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', () => {
        const target = link.getAttribute('href') || '';
        const targetId = target.replace('#', '');
        const label = link.textContent.trim() || targetId || 'sekce';
        announceSection(label);
    });
});

const PORTFOLIO_DATA_URL = 'data/portfolio.json';
const PORTFOLIO_FALLBACK_IMAGE = 'assets/fallback.jpg';
const PORTFOLIO_ALT_TEXTS = {
    'portret-1': 'Portr\u00e9tn\u00ed fotografie v p\u0159irozen\u00e9m sv\u011btle',
    'sport-1': 'Sportovn\u00ed fotografie - ak\u010dn\u00ed z\u00e1b\u011br',
    'ai-chatbot': 'AI chatbot rozhran\u00ed',
    'produkt-1': 'Produktov\u00e1 fotografie v ateli\u00e9ru',
    'automatizace': 'Automatizace procesu s AI',
    'portret-2': 'Portr\u00e9tn\u00ed fotografie s dramatick\u00fdm sv\u011btlem'
};
let portfolioProjects = [];

async function loadPortfolioData() {
    try {
        const response = await fetch(PORTFOLIO_DATA_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        portfolioProjects = Array.isArray(data) ? data : [];
    } catch (err) {
        console.warn('Nepodarilo se nacist portfolio data.', err);
        portfolioProjects = [];
    }
    renderPortfolio();
}

function renderPortfolio() {
    const portfolioGrid = document.getElementById('portfolioGrid');
    if (!portfolioGrid) return;

    const projects = Array.isArray(portfolioProjects) ? portfolioProjects : [];

    if (projects.length === 0) {
        attachPortfolioEvents();
        applyPortfolioFilter(activeFilter);
        return;
    }

    portfolioGrid.innerHTML = projects.map((project, index) => {
        const images = Array.isArray(project.images) ? project.images : [];
        const mainIndex = Number.isInteger(project.mainImageIndex) ? project.mainImageIndex : 0;
        const mainImage = images[mainIndex] || images[0] || PORTFOLIO_FALLBACK_IMAGE;
        const category = project.category === 'ai' ? 'ai' : 'foto';
        const categoryLabel = category === 'ai' ? 'AI Projekt' : 'Fotografie';
        const type = project.type === 'gallery' ? 'gallery' : 'single';
        const metaText = type === 'gallery'
            ? `${categoryLabel} | ${images.length} fotek`
            : categoryLabel;
        const projectId = project.id ? String(project.id) : `portfolio-${index}`;
        const altText = PORTFOLIO_ALT_TEXTS[projectId] || project.name || 'Portfolio';

        return `
            <div class="portfolio-item rounded-xl overflow-hidden" data-category="${category}" data-project-id="${projectId}" data-project-index="${index}">
                <img src="${mainImage}" alt="${altText}" class="w-full h-80 object-cover" loading="lazy" onerror="this.onerror=null;this.src='${PORTFOLIO_FALLBACK_IMAGE}';">
                <div class="portfolio-overlay">
                    <div class="text-center">
                        <div class="portfolio-title">${project.name || 'Projekt'}</div>
                        <div class="portfolio-meta">${metaText}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    attachPortfolioEvents();
    applyPortfolioFilter(activeFilter);
}

function attachPortfolioEvents() {
    getPortfolioItems().forEach(item => {
        if (item.dataset.lightboxBound === 'true') return;
        item.dataset.lightboxBound = 'true';
        item.addEventListener('click', () => {
            const fallbackTitle = item.querySelector('.portfolio-title')?.textContent?.trim() || 'Portfolio';
            const projectId = item.getAttribute('data-project-id');
            const projectIndex = parseInt(item.getAttribute('data-project-index') || '-1', 10);
            let project = null;

            if (projectId) {
                project = portfolioProjects.find(p => String(p.id) === projectId);
            }
            if (!project && projectIndex >= 0) {
                project = portfolioProjects[projectIndex];
            }

            if (project && Array.isArray(project.images) && project.images.length) {
                const projectTitle = project.name || fallbackTitle;
                const projectAlt = PORTFOLIO_ALT_TEXTS[String(project.id || '')] || projectTitle;
                if (project.type === 'gallery') {
                    openGalleryLightbox(project.images, 0, projectAlt);
                } else {
                    const mainImage = project.images[project.mainImageIndex] || project.images[0];
                    openSingleLightbox(mainImage, projectAlt);
                }
                return;
            }

            const galleryData = item.getAttribute('data-gallery');
            if (galleryData) {
                try {
                    const images = JSON.parse(galleryData);
                    openGalleryLightbox(images, 0, fallbackTitle);
                    return;
                } catch (e) {
                    console.warn('Neplatna galerie v atributu.', e);
                }
            }

            const img = item.querySelector('img');
            if (img) openSingleLightbox(img.src, img.alt || fallbackTitle);
        });
    });
}


function openGalleryLightbox(images, startIndex, altText) {
    if (!(lightbox && lightboxImg) || !images.length) return;
    let currentIndex = startIndex;
    const baseAlt = altText || 'Galerie';
    const setImage = () => {
        setLightboxImage(
            images[currentIndex],
            images.length > 1 ? `${baseAlt} (${currentIndex + 1}/${images.length})` : baseAlt
        );
    };
    const updateControls = () => {
        if (!lightboxPrev || !lightboxNext) return;
        lightboxPrev.classList.toggle('opacity-40', currentIndex === 0);
        lightboxPrev.classList.toggle('pointer-events-none', currentIndex === 0);
        lightboxNext.classList.toggle('opacity-40', currentIndex === images.length - 1);
        lightboxNext.classList.toggle('pointer-events-none', currentIndex === images.length - 1);
    };

    const handleKeyboard = (e) => {
        if (e.key === 'ArrowLeft' && currentIndex > 0) {
            currentIndex--;
            setImage();
            updateControls();
        } else if (e.key === 'ArrowRight' && currentIndex < images.length - 1) {
            currentIndex++;
            setImage();
            updateControls();
        }
    };

    if (galleryKeyHandler) {
        document.removeEventListener('keydown', galleryKeyHandler);
    }
    galleryKeyHandler = handleKeyboard;
    document.addEventListener('keydown', handleKeyboard);
    if (lightboxPrev && lightboxNext) {
        lightboxPrev.onclick = () => {
            if (currentIndex > 0) {
                currentIndex--;
                setImage();
                updateControls();
            }
        };
        lightboxNext.onclick = () => {
            if (currentIndex < images.length - 1) {
                currentIndex++;
                setImage();
                updateControls();
            }
        };
    }
    // Swipe gestures for mobile
    let touchStartX = 0;
    let touchEndX = 0;
    
    lightbox.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    lightbox.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        
        if (Math.abs(diff) > 50) {
            if (diff > 0 && currentIndex < images.length - 1) {
                currentIndex++;
                setImage();
                updateControls();
            } else if (diff < 0 && currentIndex > 0) {
                currentIndex--;
                setImage();
                updateControls();
            }
        }
    }, { passive: true });
    setImage();
    lightbox.classList.add('active');
    setLightboxControls(images.length > 1);
    updateControls();
}

loadPortfolioData();
});
