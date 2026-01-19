/**
 * Core module - loads immediately
 * Handles: theme, scroll effects, mobile menu, reveal animations, lazy loading
 */

// Storage helper
const storage = {
  get(key) {
    try { return localStorage.getItem(key); }
    catch (e) { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (e) { return false; }
  },
  remove(key) {
    try { localStorage.removeItem(key); }
    catch (e) {}
  }
};

window.LD_storage = storage;

// Theme toggle
function initTheme() {
  const themeToggle = document.getElementById('themeToggle');
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  function applyTheme(theme) {
    const useLight = theme === 'light';
    document.documentElement.classList.toggle('theme-light', useLight);
    storage.set('ld_theme', useLight ? 'light' : 'dark');
    if (themeToggle) themeToggle.textContent = useLight ? '\u{1F319}' : '\u{2600}\u{FE0F}';
  }

  const savedTheme = storage.get('ld_theme');
  applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));

  themeToggle?.addEventListener('click', () => {
    const nextTheme = document.documentElement.classList.contains('theme-light') ? 'dark' : 'light';
    applyTheme(nextTheme);
  });
}

// Scroll progress & header
function initScrollEffects() {
  const scrollProgress = document.getElementById('scrollProgress');
  const headerEl = document.querySelector('header');
  let scrollTicking = false;

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
    updateScrollUI();
    window.addEventListener('scroll', () => {
      if (!scrollTicking) {
        scrollTicking = true;
        requestAnimationFrame(updateScrollUI);
      }
    }, { passive: true });
  }
}

// Cursor spotlight
function initCursorSpotlight() {
  const cursorSpotlight = document.getElementById('cursorSpotlight');
  const heroAmbient = document.querySelector('.hero-ambient');
  if (!cursorSpotlight && !heroAmbient) return;

  let mouseX = 0, mouseY = 0, mouseTicking = false;

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

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!mouseTicking) {
      mouseTicking = true;
      requestAnimationFrame(updateMouseEffects);
    }
  }, { passive: true });
}

// Reveal animations
function initRevealAnimations() {
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

// Typing effect
function initTypingEffect() {
  const typingText = document.getElementById('typingText');
  if (!typingText) return;

  const texts = ['Fotograf & AI Developer', 'Kreativn\u00ed Vizion\u00e1\u0159', 'Tech Enthusiast'];
  let textIndex = 0, charIndex = 0, isDeleting = false;

  function typeText() {
    const currentText = texts[textIndex];
    typingText.textContent = isDeleting
      ? currentText.substring(0, --charIndex)
      : currentText.substring(0, ++charIndex);

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

// Skill bars animation
function initSkillBars() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.target.classList.contains('skill-bar')) {
        const width = entry.target.getAttribute('data-width');
        entry.target.style.width = width + '%';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.skill-bar').forEach(el => observer.observe(el));
}

// Mobile menu
function initMobileMenu() {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileMenuClose = document.getElementById('mobileMenuClose');
  if (!mobileMenuBtn || !mobileMenu) return;

  const closeMenu = () => {
    mobileMenuBtn.classList.remove('active');
    mobileMenu.classList.remove('active');
    document.body.style.overflow = '';
  };

  mobileMenuBtn.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('active');
    mobileMenuBtn.classList.toggle('active', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  mobileMenuClose?.addEventListener('click', closeMenu);
  mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  mobileMenu.addEventListener('click', (e) => e.target === mobileMenu && closeMenu());

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('active')) closeMenu();
  });
}

// Announcer for accessibility
function initAnnouncer() {
  const announcer = document.getElementById('announcer');
  if (!announcer) return;

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', () => {
      const label = link.textContent.trim() || 'sekce';
      announcer.textContent = '';
      setTimeout(() => announcer.textContent = `Zobrazena sekce ${label}`, 50);
    });
  });
}

// Newsletter form
function initNewsletter() {
  const form = document.getElementById('newsletterForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('newsletterStatus');
    const emailInput = form.querySelector('input[type="email"]');
    const email = emailInput?.value.trim();
    if (!email) {
      if (statusEl) statusEl.textContent = 'Zadejte pros\u00edm email.';
      return;
    }
    if (statusEl) statusEl.textContent = `D\u011bkuji! Newsletter bude zasl\u00e1n na: ${email}`;
    form.reset();
  });
}

// Lazy load modules
function initLazyModules() {
  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  };

  // Chatbot - load on button click
  const chatBtn = document.getElementById('chatBtn');
  if (chatBtn) {
    chatBtn.addEventListener('click', async function handler() {
      chatBtn.removeEventListener('click', handler);
      try {
        await loadScript('/dist/js/chatbot.min.js');
      } catch (e) {
        // Fallback to original
        await loadScript('/assets/main.js');
      }
    }, { once: true });
  }

  // Neural network - load after 2s or on scroll
  const neuralCanvas = document.getElementById('neuralCanvas');
  if (neuralCanvas) {
    const loadNeural = async () => {
      try {
        await loadScript('/dist/js/neural.min.js');
      } catch (e) { console.warn('Neural module not loaded'); }
    };
    setTimeout(loadNeural, 2000);
  }

  // Portfolio - load when section visible
  const portfolioSection = document.getElementById('portfolio');
  if (portfolioSection) {
    const observer = new IntersectionObserver(async (entries) => {
      if (entries[0].isIntersecting) {
        observer.disconnect();
        try {
          await loadScript('/dist/js/portfolio.min.js');
        } catch (e) { console.warn('Portfolio module not loaded'); }
      }
    }, { rootMargin: '200px' });
    observer.observe(portfolioSection);
  }

  // Contact - load when section visible
  const contactSection = document.getElementById('kontakt');
  if (contactSection) {
    const observer = new IntersectionObserver(async (entries) => {
      if (entries[0].isIntersecting) {
        observer.disconnect();
        try {
          await loadScript('/dist/js/contact.min.js');
        } catch (e) { console.warn('Contact module not loaded'); }
      }
    }, { rootMargin: '200px' });
    observer.observe(contactSection);
  }
}

// Service Worker
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('SW registered'))
        .catch(err => console.log('SW failed:', err));
    });
  }
}

// Initialize all
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initScrollEffects();
  initCursorSpotlight();
  initRevealAnimations();
  initTypingEffect();
  initSkillBars();
  initMobileMenu();
  initAnnouncer();
  initNewsletter();
  initLazyModules();
  initServiceWorker();
});
