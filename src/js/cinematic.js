/**
 * Cinematic scroll layer — Lenis smooth scroll + split-text reveals +
 * scroll-velocity marquee + clip-path scene reveals.
 *
 * Vanilla, self-hosted (lenis + split-type bundled by esbuild → CSP 'self').
 * Progressive enhancement: respects prefers-reduced-motion and coarse pointers.
 */
import Lenis from 'lenis';
import SplitType from 'split-type';

(function () {
  'use strict';

  if (window.ldCinematicReady) return;
  window.ldCinematicReady = true;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(hover: none)').matches;

  /* ---------------------------------------------------------------------- */
  /* Smooth scroll (Lenis)                                                   */
  /* ---------------------------------------------------------------------- */
  let lenis = null;

  function initLenis() {
    if (reduceMotion) return;
    lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // Touch keeps native scroll — Lenis touch easing fights momentum on mobile.
      syncTouch: false,
    });

    document.documentElement.classList.add('lenis-on');

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Smooth anchor jumps through Lenis instead of native instant jump.
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      link.addEventListener('click', (e) => {
        const target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -72, duration: 1.2 });
        if (history.replaceState) history.replaceState(null, '', href);
      });
    });

    window.ldLenis = lenis;
  }

  /* ---------------------------------------------------------------------- */
  /* Split-text character reveals                                           */
  /* ---------------------------------------------------------------------- */
  function initSplitText() {
    // .section-title is intentionally excluded — it uses gradient background-clip
    // text, which splitting into per-char spans would break.
    const targets = document.querySelectorAll('[data-cine-split], .hero-name');
    if (!targets.length) return;

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('cine-in');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.35, rootMargin: '0px 0px -8% 0px' });

    targets.forEach((el) => {
      if (reduceMotion) { el.classList.add('cine-in'); return; }
      const split = new SplitType(el, { types: 'chars,words', tagName: 'span' });
      (split.chars || []).forEach((char, i) => {
        char.style.setProperty('--ci', i);
      });
      el.classList.add('cine-split-ready');
      io.observe(el);
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Clip-path scene reveals (IO-triggered, CSS does the motion)            */
  /* ---------------------------------------------------------------------- */
  function initClipReveals() {
    const targets = document.querySelectorAll(
      '[data-cine-reveal], .portfolio-item, .hero-headline'
    );
    if (!targets.length) return;

    targets.forEach((el) => el.classList.add('cine-reveal-ready'));

    if (reduceMotion) {
      targets.forEach((el) => el.classList.add('cine-in'));
      return;
    }

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const delay = el.getAttribute('data-cine-delay');
        if (delay) el.style.setProperty('--cine-delay', delay + 'ms');
        // Stagger grid children (portfolio) by DOM index for a cascade.
        if (!delay && el.parentElement && el.classList.contains('portfolio-item')) {
          const idx = Array.prototype.indexOf.call(el.parentElement.children, el);
          el.style.setProperty('--cine-delay', ((idx % 4) * 70) + 'ms');
        }
        el.classList.add('cine-in');
        obs.unobserve(el);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -6% 0px' });

    targets.forEach((el) => io.observe(el));
  }

  /* ---------------------------------------------------------------------- */
  /* Scroll-velocity marquee                                                */
  /* ---------------------------------------------------------------------- */
  function initMarquee() {
    const track = document.querySelector('[data-cine-marquee]');
    if (!track) return;

    const original = track.innerHTML;
    // Quadruple content so the strip never shows a gap while wrapping.
    track.innerHTML = original + original + original + original;

    if (reduceMotion) return;

    let baseX = 0;
    let last = performance.now();
    const baseVel = 40; // px/s drift
    let velFactor = 0;
    let trackWidth = track.scrollWidth / 4;

    const measure = () => { trackWidth = track.scrollWidth / 4; };
    window.addEventListener('resize', measure, { passive: true });

    if (lenis) {
      lenis.on('scroll', ({ velocity }) => {
        velFactor = Math.max(-6, Math.min(6, velocity * 0.18));
      });
    } else {
      let lastY = window.scrollY;
      window.addEventListener('scroll', () => {
        const dy = window.scrollY - lastY;
        lastY = window.scrollY;
        velFactor = Math.max(-6, Math.min(6, dy * 0.4));
      }, { passive: true });
    }

    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let move = baseVel * dt;
      move += move * Math.abs(velFactor);
      const dir = velFactor < 0 ? -1 : 1;
      baseX -= move * dir;
      if (trackWidth > 0) {
        if (baseX <= -trackWidth) baseX += trackWidth;
        if (baseX > 0) baseX -= trackWidth;
      }
      track.style.transform = `translate3d(${baseX}px,0,0)`;
      velFactor *= 0.92; // decay back to drift
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------------------- */
  /* Hero parallax + kinetic weight (desktop only, pointer-fine)            */
  /* ---------------------------------------------------------------------- */
  function initHeroKinetic() {
    if (reduceMotion || coarsePointer) return;
    const hero = document.getElementById('hero');
    if (!hero) return;
    const layers = hero.querySelectorAll('[data-cine-parallax]');
    if (!layers.length) return;

    const onScroll = () => {
      const y = window.scrollY;
      layers.forEach((layer) => {
        const speed = parseFloat(layer.getAttribute('data-cine-parallax')) || 0.2;
        layer.style.transform = `translate3d(0, ${(y * speed).toFixed(1)}px, 0)`;
      });
    };
    const src = lenis || window;
    if (lenis) lenis.on('scroll', onScroll);
    else window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------------------------------------------------------------------- */
  function boot() {
    initLenis();
    initSplitText();
    initClipReveals();
    initMarquee();
    initHeroKinetic();
    document.documentElement.classList.add('cine-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
