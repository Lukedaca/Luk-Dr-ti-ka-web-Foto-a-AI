/**
 * Core module - loads immediately
 * Contains essential functionality for initial page render
 */

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

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

document.addEventListener('DOMContentLoaded', () => {
    const runWhenIdle = (callback, timeout = 1200) => {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(() => callback(), { timeout });
            return;
        }
        window.setTimeout(callback, 1);
    };

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
    runWhenIdle(cleanConflictMarkers, 2000);

    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    const themeToggleMobile = document.getElementById('themeToggleMobile');

    function applyTheme(theme) {
        const useLight = theme === 'light';
        document.documentElement.classList.toggle('theme-light', useLight);
        storage.set('ld_theme', useLight ? 'light' : 'dark');
        const icon = useLight ? '🌙' : '☀️';
        if (themeToggle) themeToggle.textContent = icon;
        if (themeToggleMobile) themeToggleMobile.textContent = icon;
    }

    const savedTheme = storage.get('ld_theme');
    applyTheme(savedTheme ? savedTheme : (prefersDark ? 'dark' : 'light'));

    function toggleTheme() {
        const nextTheme = document.documentElement.classList.contains('theme-light') ? 'dark' : 'light';
        applyTheme(nextTheme);
    }

    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    if (themeToggleMobile) themeToggleMobile.addEventListener('click', toggleTheme);

    // Scroll progress and header effects
    const scrollProgress = document.getElementById('scrollProgress');
    const headerEl = document.querySelector('header');
    let scrollTicking = false;

    const setupScrollUI = () => {
        const updateScrollUI = () => {
            if (scrollProgress) {
                const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
                const scrolled = windowHeight > 0 ? (window.scrollY / windowHeight) * 100 : 0;
                scrollProgress.style.width = scrolled + '%';
            }
            if (headerEl) headerEl.classList.toggle('is-scrolled', window.scrollY > 12);
            scrollTicking = false;
        };

        if (scrollProgress || headerEl) {
            window.addEventListener('scroll', () => {
                if (!scrollTicking) {
                    scrollTicking = true;
                    requestAnimationFrame(updateScrollUI);
                }
            }, { passive: true });
        }
    };

    runWhenIdle(setupScrollUI, 1500);

    // Cursor spotlight and hero ambient effects
    const cursorSpotlight = document.getElementById('cursorSpotlight');
    const heroAmbient = document.querySelector('.hero-ambient');
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
        runWhenIdle(setupMouseEffects, 2000);
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

    // Lazy load other modules
    lazyLoadModules();
});

// Lazy loading logic for other modules
function lazyLoadModules() {
    loadModule('/dist/js/i18n.min.js', () => {
        console.log('I18n module loaded');
    });

    // Load neural network visualization after 2 seconds (deferred, not critical)
    const neuralCanvas = document.getElementById('neuralCanvas');
    if (neuralCanvas) {
        setTimeout(() => {
            loadModule('/dist/js/neural.min.js', () => {
                console.log('Neural module loaded');
            });
        }, 2000);
    }

    // Load portfolio module when portfolio section is visible
    const portfolioSection = document.getElementById('portfolio');
    if (portfolioSection) {
        const portfolioObserver = new IntersectionObserver((entries, obs) => {
            if (entries[0].isIntersecting) {
                loadModule('/dist/js/portfolio.min.js', () => {
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
                loadModule('/dist/js/contact.min.js', () => {
                    console.log('Contact module loaded');
                });
                obs.disconnect();
            }
        }, { rootMargin: '200px' });
        contactObserver.observe(contactSection);
    }

    // Load chatbot immediately (hero AI chatbox needs it on page load)
    loadModule('/dist/js/chatbot.min.js', () => {
        console.log('Chatbot module loaded');
        loadModule('/dist/js/voice.min.js', () => {
            console.log('Voice module loaded');
        });
    });
}

// Helper function to load scripts dynamically
function loadModule(src, callback) {
    const script = document.createElement('script');
    script.src = src;
    script.onload = callback;
    script.onerror = () => console.error(`Failed to load module: ${src}`);
    document.body.appendChild(script);
}
