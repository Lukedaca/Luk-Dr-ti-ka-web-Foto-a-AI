/**
 * Core module - loads immediately
 * Contains essential functionality for initial page render
 */

window.ldCachePurgePromise = Promise.resolve();

// The legacy service worker is intentionally purged but not re-registered.
// sw.js is pass-through, so registering it only adds startup work.

// Storage helper with error handling
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

// Make storage globally available for other modules
window.appStorage = storage;

function initCore() {
    if (window.ldCoreReady || window.ldCoreInitializing) return;
    window.ldCoreInitializing = true;

    const runWhenIdle = (callback, timeout = 1200) => {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(() => callback(), { timeout });
            return;
        }
        window.setTimeout(callback, 1);
    };

    const runAfterFirstPointer = (callback) => {
        let didRun = false;
        const run = () => {
            if (didRun) return;
            didRun = true;
            callback();
        };
        ['pointermove', 'pointerdown'].forEach((eventName) => {
            window.addEventListener(eventName, run, { once: true, passive: true });
        });
        window.addEventListener('focusin', run, { once: true });
    };

    const attachImageFallbacks = (root = document) => {
        const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
        scope.querySelectorAll('img[data-fallback-src]').forEach((img) => {
            if (img.dataset.fallbackBound === 'true') return;
            img.dataset.fallbackBound = 'true';
            img.addEventListener('error', () => {
                const fallbackSrc = img.getAttribute('data-fallback-src');
                if (!fallbackSrc || img.getAttribute('src') === fallbackSrc) return;
                const picture = img.parentElement && img.parentElement.tagName === 'PICTURE' ? img.parentElement : null;
                if (picture) {
                    picture.querySelectorAll('source').forEach((source) => source.remove());
                }
                img.removeAttribute('srcset');
                img.src = fallbackSrc;
            }, { once: true });
        });
    };

    window.ldAttachImageFallbacks = attachImageFallbacks;
    attachImageFallbacks(document);

    const setupDeferredHeroVideo = () => {
        const video = document.querySelector('.hero-video[data-src]');
        if (!video) return;

        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const canUseMotionMedia =
            window.matchMedia('(min-width: 768px)').matches &&
            !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
            !(connection && connection.saveData);

        if (!canUseMotionMedia) {
            video.removeAttribute('src');
            return;
        }

        const loadVideo = () => {
            if (video.dataset.videoLoaded === 'true') return;
            const src = video.getAttribute('data-src');
            if (!src) return;

            video.dataset.videoLoaded = 'true';
            video.src = src;
            video.preload = 'metadata';
            video.autoplay = true;

            const playPromise = video.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {});
            }
        };

        const bindIntentLoad = () => {
            const options = { once: true, passive: true };
            ['pointermove', 'pointerdown', 'keydown', 'scroll'].forEach((eventName) => {
                window.addEventListener(eventName, loadVideo, options);
            });
        };

        if (document.readyState === 'complete') {
            runWhenIdle(bindIntentLoad, 2600);
        } else {
            window.addEventListener('load', () => runWhenIdle(bindIntentLoad, 2600), { once: true });
        }
    };

    setupDeferredHeroVideo();

    // Clean conflict markers (safety feature)
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
            if (changed) node.nodeValue = text;
        };

        const textWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        while (textWalker.nextNode()) cleanTextNode(textWalker.currentNode);

        const commentWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT, null);
        const commentsToRemove = [];
        while (commentWalker.nextNode()) {
            const node = commentWalker.currentNode;
            if (markers.some(m => node.nodeValue.includes(m))) commentsToRemove.push(node);
        }
        commentsToRemove.forEach(node => node.parentNode?.removeChild(node));
    }
    if (window.location.search.includes('debugCleanup=1')) {
        runWhenIdle(cleanConflictMarkers, 3000);
    }

    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    const themeToggleMobile = document.getElementById('themeToggleMobile');

    function applyTheme(theme, persist = true) {
        const useLight = theme === 'light';
        if (document.documentElement.classList.contains('theme-light') !== useLight) {
            document.documentElement.classList.toggle('theme-light', useLight);
        }
        if (persist) storage.set('ld_theme', useLight ? 'light' : 'dark');
        const icon = useLight ? '🌙' : '☀️';
        if (themeToggle) themeToggle.textContent = icon;
        if (themeToggleMobile) themeToggleMobile.textContent = icon;
    }

    const savedTheme = storage.get('ld_theme');
    applyTheme(savedTheme ? savedTheme : (prefersDark ? 'dark' : 'light'), false);

    function toggleTheme() {
        const nextTheme = document.documentElement.classList.contains('theme-light') ? 'dark' : 'light';
        applyTheme(nextTheme);
    }

    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    if (themeToggleMobile) themeToggleMobile.addEventListener('click', toggleTheme);

    const setupLanguageLoader = () => {
        const buttons = document.querySelectorAll('.lang-switch-btn');
        if (!buttons.length) return;

        const getPreferredLang = () => {
            try {
                const lang = new URL(window.location.href).searchParams.get('lang');
                if (lang === 'en' || lang === 'cs') return lang;
            } catch (e) {}
            return storage.get('ld_lang') === 'en' ? 'en' : 'cs';
        };

        let selectedLang = getPreferredLang();
        let i18nLoading = false;

        const setSwitcherState = (lang) => {
            buttons.forEach((button) => {
                const active = button.getAttribute('data-lang-option') === lang;
                button.classList.toggle('bg-white', active);
                button.classList.toggle('text-slate-900', active);
                button.classList.toggle('text-white', !active);
                button.classList.toggle('text-white/70', !active);
                button.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
        };

        const loadI18nFor = (lang) => {
            selectedLang = lang === 'en' ? 'en' : 'cs';
            storage.set('ld_lang', selectedLang);
            setSwitcherState(selectedLang);

            if (window.ldI18n && typeof window.ldI18n.applyLanguage === 'function') {
                window.ldI18n.applyLanguage(selectedLang);
                return;
            }
            if (i18nLoading) return;

            i18nLoading = true;
            loadModule('/dist/js/i18n.min.js?v=14', () => {
                i18nLoading = false;
                if (window.ldI18n && typeof window.ldI18n.applyLanguage === 'function') {
                    window.ldI18n.applyLanguage(selectedLang);
                }
            }, () => {
                i18nLoading = false;
            });
        };

        setSwitcherState(selectedLang);
        buttons.forEach((button) => {
            if (button.dataset.langCoreBound === 'true') return;
            button.dataset.langCoreBound = 'true';
            button.addEventListener('click', () => {
                loadI18nFor(button.getAttribute('data-lang-option') || 'cs');
            });
        });

        if (selectedLang === 'en') {
            runWhenIdle(() => loadI18nFor('en'), 2200);
        }
    };

    setupLanguageLoader();

    // Scroll progress, header effects + Shutter Line leitmotiv
    const scrollProgress = document.getElementById('scrollProgress');
    const shutterLine = document.querySelector('.shutter-line');
    const headerEl = document.querySelector('header');
    let scrollTicking = false;

    const setupScrollUI = () => {
        const updateScrollUI = () => {
            const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const ratio = windowHeight > 0 ? Math.max(0, Math.min(1, window.scrollY / windowHeight)) : 0;
            if (scrollProgress) scrollProgress.style.width = (ratio * 100) + '%';
            if (shutterLine) shutterLine.style.setProperty('--shutter-progress', ratio.toFixed(4));
            if (headerEl) headerEl.classList.toggle('is-scrolled', window.scrollY > 12);
            scrollTicking = false;
        };

        if (scrollProgress || shutterLine || headerEl) {
            updateScrollUI();
            window.addEventListener('scroll', () => {
                if (!scrollTicking) {
                    scrollTicking = true;
                    requestAnimationFrame(updateScrollUI);
                }
            }, { passive: true });
        }
    };

    runWhenIdle(setupScrollUI, 1500);

    // 3D tilt + Magnetic CTA + radial mouse-follow glow na .glass kartách
    const setupMicroInteractions = () => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        if (window.matchMedia('(hover: none)').matches) return;

        const tiltCards = document.querySelectorAll('.glass:not(.no-tilt), .card:not(.no-tilt)');
        tiltCards.forEach((el) => {
            el.classList.add('tilt');
            let raf = 0;
            const handleMove = (e) => {
                if (raf) return;
                raf = requestAnimationFrame(() => {
                    const rect = el.getBoundingClientRect();
                    const px = (e.clientX - rect.left) / rect.width;
                    const py = (e.clientY - rect.top) / rect.height;
                    const rx = (0.5 - py) * 4;
                    const ry = (px - 0.5) * 4;
                    el.style.setProperty('--tx', ry.toFixed(2) + 'deg');
                    el.style.setProperty('--ty', rx.toFixed(2) + 'deg');
                    el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
                    el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
                    raf = 0;
                });
            };
            const reset = () => {
                el.style.setProperty('--tx', '0deg');
                el.style.setProperty('--ty', '0deg');
            };
            el.addEventListener('pointermove', handleMove, { passive: true });
            el.addEventListener('pointerleave', reset);
        });

        const magnetic = document.querySelectorAll(
            '.btn-primary, .btn-secondary, #voice-call-btn, #hero-send, .agent-cta-btn'
        );
        magnetic.forEach((el) => {
            el.classList.add('magnetic');
            let raf = 0;
            const handleMove = (e) => {
                if (raf) return;
                raf = requestAnimationFrame(() => {
                    const rect = el.getBoundingClientRect();
                    const cx = rect.left + rect.width / 2;
                    const cy = rect.top + rect.height / 2;
                    const dx = (e.clientX - cx) * 0.18;
                    const dy = (e.clientY - cy) * 0.18;
                    el.style.setProperty('--mx-cta', dx.toFixed(1) + 'px');
                    el.style.setProperty('--my-cta', dy.toFixed(1) + 'px');
                    raf = 0;
                });
            };
            const reset = () => {
                el.style.setProperty('--mx-cta', '0px');
                el.style.setProperty('--my-cta', '0px');
            };
            el.addEventListener('pointermove', handleMove, { passive: true });
            el.addEventListener('pointerleave', reset);
        });
    };


    // Logo intro — 1× za session, ne při SW reload, respektuje reduced-motion
    const setupLogoIntro = () => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        if (window.ldCachePurgeReloading) return;
        try {
            if (sessionStorage.getItem('ld_logo_intro_v2')) return;
            sessionStorage.setItem('ld_logo_intro_v2', '1');
        } catch (e) { /* private mode — pokračuj jednorázově */ }
        document.body.classList.add('logo-intro-active');
        setTimeout(() => {
            document.body.classList.remove('logo-intro-active');
        }, 1450);
    };

    if (window.location.search.includes('intro=1')) {
        setupLogoIntro();
    }

    // Cursor spotlight, hero ambient + dot-grid spotlight reveal
    const cursorSpotlight = document.getElementById('cursorSpotlight');
    const heroAmbient = document.querySelector('.hero-ambient');
    const gridBg = document.querySelector('.grid-bg');
    const root = document.documentElement;
    let mouseX = 0, mouseY = 0, mouseTicking = false;

    const setupMouseEffects = () => {
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
            if (gridBg) {
                gridBg.style.setProperty('--mx', mouseX + 'px');
                gridBg.style.setProperty('--my', mouseY + 'px');
            }
            // Globální --mx/--my pro .beam radial highlight (page-wide)
            root.style.setProperty('--mx', mouseX + 'px');
            root.style.setProperty('--my', mouseY + 'px');
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
    };

    const canUseDesktopPointerEffects = window.matchMedia
        && window.matchMedia('(hover: hover) and (pointer: fine)').matches
        && window.innerWidth >= 768;

    if (canUseDesktopPointerEffects) {
        runAfterFirstPointer(() => {
            setupMouseEffects();
            setupMicroInteractions();
        });
    }

    // Reveal animations
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
    runWhenIdle(setupRevealAnimations, 800);


    // Counter and skill bar animations
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

    const animationObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (entry.target.hasAttribute('data-count')) {
                    animateCounter(entry.target);
                    animationObserver.unobserve(entry.target);
                }
                if (entry.target.classList.contains('skill-bar')) {
                    const width = entry.target.getAttribute('data-width');
                    entry.target.style.width = width + '%';
                    animationObserver.unobserve(entry.target);
                }
            }
        });
    }, { threshold: 0.5 });

    runWhenIdle(() => {
        document.querySelectorAll('[data-count]').forEach(el => animationObserver.observe(el));
        document.querySelectorAll('.skill-bar').forEach(el => animationObserver.observe(el));
    }, 1000);

    // Testimonials slider
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

        runWhenIdle(() => {
            prevTestimonial.addEventListener('click', () => showTestimonial(currentTestimonial - 1));
            nextTestimonial.addEventListener('click', () => showTestimonial(currentTestimonial + 1));
            testimonialDots.forEach((dot, index) => {
                dot.addEventListener('click', () => showTestimonial(index));
            });
            setInterval(() => showTestimonial(currentTestimonial + 1), 5000);
        }, 1200);
    }

    // Newsletter form
    const newsletterForm = document.getElementById('newsletterForm');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const statusEl = document.getElementById('newsletterStatus');
            const emailInput = e.target.querySelector('input[type="email"]');
            const email = emailInput ? emailInput.value.trim() : '';
            if (!email) {
                if (statusEl) statusEl.textContent = 'Zadejte prosím email.';
                return;
            }
            if (statusEl) statusEl.textContent = `Děkuji! Newsletter bude zaslán na: ${email}`;
            e.target.reset();
        });
    }

    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            const statusEl = document.getElementById('newsletterStatus');
            const emailInput = e.target.querySelector('input[type="email"]');
            const email = emailInput ? emailInput.value.trim() : '';
            if (!statusEl || typeof window.ldGetText !== 'function') return;
            if (!email) {
                statusEl.textContent = window.ldGetText('newsletter.enterEmail', 'Zadejte prosim email.');
                return;
            }
            statusEl.textContent = `${window.ldGetText('newsletter.successPrefix', 'Dekuji! Newsletter bude zaslan na:')} ${email}`;
        }, true);
    }

    // Mobile Menu
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuClose = document.getElementById('mobileMenuClose');

    if (mobileMenuBtn && mobileMenu) {
        const setMobileMenuState = (open) => {
            mobileMenuBtn.classList.toggle('active', open);
            mobileMenu.classList.toggle('active', open);
            mobileMenuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
            document.body.style.overflow = open ? 'hidden' : '';
        };

        window.ldSetMobileMenuState = setMobileMenuState;
        window.ldToggleMobileMenu = () => setMobileMenuState(!mobileMenu.classList.contains('active'));
        window.ldCloseMobileMenu = () => setMobileMenuState(false);

        if (mobileMenuBtn.dataset.menuBound !== 'true') {
            mobileMenuBtn.dataset.menuBound = 'true';

            mobileMenuBtn.addEventListener('click', (event) => {
                event.preventDefault();
                window.ldToggleMobileMenu();
            }, { passive: false });

            if (mobileMenuClose) {
                mobileMenuClose.addEventListener('click', () => {
                    window.ldCloseMobileMenu();
                });
            }

            mobileMenu.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    window.ldCloseMobileMenu();
                });
            });

            mobileMenu.addEventListener('click', (e) => {
                if (e.target === mobileMenu) {
                    window.ldCloseMobileMenu();
                }
            });
        }
    }

    // Accessibility announcer
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

    // Escape key handler
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (mobileMenu && mobileMenu.classList.contains('active')) {
                if (typeof window.ldCloseMobileMenu === 'function') {
                    window.ldCloseMobileMenu();
                } else {
                    if (mobileMenuBtn) mobileMenuBtn.classList.remove('active');
                    mobileMenu.classList.remove('active');
                    document.body.style.overflow = '';
                }
            }
            if (window.chatbot && window.chatbot.isChatOpen) {
                window.chatbot.closeChat();
            }
        }
    });

    lazyLoadModules();

    window.ldCoreReady = true;
    window.ldCoreInitializing = false;
    window.dispatchEvent(new CustomEvent('ld:core-ready'));
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCore, { once: true });
} else {
    initCore();
}

// Lazy loading logic for other modules
function lazyLoadModules() {
    // Hero canvas particles are a progressive enhancement. Keep them off the
    // critical path, but restore them for real desktop sessions.
    const heroHeadline = document.querySelector('.hero-headline');
    if (heroHeadline &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
        !window.matchMedia('(hover: none)').matches &&
        window.innerWidth >= 768) {
        let particlesRequested = false;
        const startParticles = () => loadModule('/dist/js/hero-particles.min.js?v=29');
        const scheduleParticles = () => {
            if (particlesRequested) return;
            particlesRequested = true;
            if ('requestIdleCallback' in window) {
                requestIdleCallback(startParticles, { timeout: 2000 });
            } else {
                setTimeout(startParticles, 600);
            }
        };
        heroHeadline.addEventListener('pointerenter', scheduleParticles, { once: true, passive: true });
        heroHeadline.addEventListener('click', scheduleParticles, { once: true, passive: true });
        heroHeadline.addEventListener('focusin', scheduleParticles, { once: true });

        const scheduleInitialParticles = () => {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(scheduleParticles, { timeout: 3500 });
            } else {
                setTimeout(scheduleParticles, 1800);
            }
        };
        if (document.readyState === 'complete') {
            scheduleInitialParticles();
        } else {
            window.addEventListener('load', scheduleInitialParticles, { once: true });
        }
    }

    // Load portfolio module when portfolio section is visible
    const portfolioSection = document.getElementById('portfolio');
    if (portfolioSection) {
        const portfolioObserver = new IntersectionObserver((entries, obs) => {
            if (entries[0].isIntersecting) {
                loadModule('/dist/js/portfolio.min.js?v=11', () => {
                    console.log('Portfolio module loaded');
                });
                obs.disconnect();
            }
        }, { rootMargin: '200px' });
        portfolioObserver.observe(portfolioSection);
    }

    // Load contact module when contact section is visible
    const contactSection = document.getElementById('kontakt');
    if (contactSection) {
        const contactObserver = new IntersectionObserver((entries, obs) => {
            if (entries[0].isIntersecting) {
                loadModule('/dist/js/contact.min.js?v=10', () => {
                    console.log('Contact module loaded');
                });
                obs.disconnect();
            }
        }, { rootMargin: '200px' });
        contactObserver.observe(contactSection);
    }

    setupChatbotLoader();
}

let chatbotLoadPromise = null;

function loadChatbotStack() {
    if (window.aiChat) return Promise.resolve(window.aiChat);
    if (chatbotLoadPromise) return chatbotLoadPromise;

    chatbotLoadPromise = new Promise((resolve) => {
        const finish = () => {
            loadModule('/dist/js/chatbot.min.js?v=15', () => {
                console.log('Chatbot module loaded');
                loadModule('/dist/js/voice.min.js?v=10', () => {
                    console.log('Voice module loaded');
                });
                resolve(window.aiChat || null);
            }, () => resolve(window.aiChat || null));
        };

        loadModule('/dist/js/turnstile.min.js?v=9', () => {
            console.log('Turnstile module loaded');
            finish();
        }, finish);
    });

    return chatbotLoadPromise;
}

function setupChatbotLoader() {
    const chatBtn = document.getElementById('chatBtn');
    if (chatBtn) {
        chatBtn.addEventListener('click', (event) => {
            if (window.aiChat) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            loadChatbotStack().then((chat) => {
                if (chat && typeof chat.openWidget === 'function') {
                    chat.openWidget();
                }
            });
        }, true);
    }

    const aiSection = document.getElementById('hybridni-agent');
    if (aiSection && 'IntersectionObserver' in window) {
        const chatbotObserver = new IntersectionObserver((entries, obs) => {
            if (entries[0].isIntersecting) {
                loadChatbotStack();
                obs.disconnect();
            }
        }, { rootMargin: '0px', threshold: 0.45 });
        chatbotObserver.observe(aiSection);
    }
}

// Helper function to load scripts dynamically
function loadModule(src, callback, errorCallback) {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = callback;
    script.onerror = () => {
        console.error(`Failed to load module: ${src}`);
        if (typeof errorCallback === 'function') errorCallback();
    };
    document.body.appendChild(script);
}
