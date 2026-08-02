// stage.js — jediný vlastník Paper Shaders (Agent Stage vizuální vrstva)
// Mount/unmount shader scén, reduced-motion → statický frame, barvy z CSS proměnných.
// API: window.ldStage.mount(el, name, opts) / unmount(el) / refreshColors()
// Auto-mount: elementy s [data-stage="neuro-noise|god-rays|pulsing-border|waves|liquid-metal"]

import {
    ShaderMount,
    ShaderFitOptions,
    getShaderColorFromString,
    getShaderNoiseTexture,
    neuroNoiseFragmentShader,
    liquidMetalFragmentShader,
    godRaysFragmentShader,
    pulsingBorderFragmentShader,
    wavesFragmentShader,
    LiquidMetalShapes,
    PulsingBorderAspectRatios,
    toProcessedLiquidMetal
} from '@paper-design/shaders';

(function () {
    'use strict';

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobileQuery = window.matchMedia('(hover: none), (max-width: 767px)');

    function cssColor(varName, fallback) {
        const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        return getShaderColorFromString(value || fallback);
    }

    function withAlpha(rgba, alpha) {
        return [rgba[0], rgba[1], rgba[2], alpha];
    }

    const TRANSPARENT = [0, 0, 0, 0];

    // Sizing uniformy (vertex shader) — pattern = dlaždicový, object = centrovaný tvar
    function sizingUniforms(fit, overrides) {
        return Object.assign({
            u_fit: ShaderFitOptions[fit],
            u_scale: 1,
            u_rotation: 0,
            u_originX: 0.5,
            u_originY: 0.5,
            u_offsetX: 0,
            u_offsetY: 0,
            u_worldWidth: 0,
            u_worldHeight: 0
        }, overrides || {});
    }

    // Definice scén. colors() se volá při mountu a při změně tématu.
    const SHADERS = {
        'neuro-noise': {
            fragment: neuroNoiseFragmentShader,
            speed: 0.2,
            // Fullscreen měkký pattern — render v 1× DPR s pixel stropem, upscale není vidět
            pixel: { minRatio: 1, maxCount: 1400000 },
            colors: () => ({
                u_colorBack: cssColor('--ink-900', '#050d1d'),
                u_colorMid: withAlpha(cssColor('--signal-deep', '#2c7ec0'), 0.55),
                u_colorFront: withAlpha(cssColor('--signal', '#4ea2e0'), 0.85)
            }),
            uniforms: () => Object.assign({
                u_brightness: 0.12,
                u_contrast: 0.32
            }, sizingUniforms('none', { u_scale: 0.75 }))
        },
        'god-rays': {
            fragment: godRaysFragmentShader,
            speed: 0.5,
            pixel: { minRatio: 1, maxCount: 2000000 },
            colors: () => ({
                u_colorBack: TRANSPARENT,
                u_colorBloom: withAlpha(cssColor('--signal', '#4ea2e0'), 0.6),
                u_colors: [
                    withAlpha(cssColor('--signal', '#4ea2e0'), 0.85),
                    withAlpha(cssColor('--signal-hi', '#6cbcef'), 0.7)
                ]
            }),
            uniforms: () => Object.assign({
                u_colorsCount: 2,
                u_bloom: 0.45,
                u_intensity: 0.5,
                u_density: 0.3,
                u_spotty: 0.35,
                u_midSize: 0.25,
                u_midIntensity: 0.55,
                u_noiseTexture: getShaderNoiseTexture()
            }, sizingUniforms('contain'))
        },
        'pulsing-border': {
            fragment: pulsingBorderFragmentShader,
            speed: 0.6,
            pixel: { minRatio: 1.5 },
            colors: () => ({
                u_colorBack: TRANSPARENT,
                u_colors: [
                    withAlpha(cssColor('--signal', '#4ea2e0'), 0.9),
                    withAlpha(cssColor('--signal-hi', '#6cbcef'), 0.8),
                    withAlpha(cssColor('--signal-deep', '#2c7ec0'), 0.7)
                ]
            }),
            uniforms: () => Object.assign({
                u_colorsCount: 3,
                u_roundness: 0.3,
                u_thickness: 0.05,
                u_softness: 0.55,
                u_marginLeft: 0,
                u_marginRight: 0,
                u_marginTop: 0,
                u_marginBottom: 0,
                u_aspectRatio: PulsingBorderAspectRatios.auto,
                u_intensity: 0.4,
                u_bloom: 0.4,
                u_spots: 3,
                u_spotSize: 0.4,
                u_pulse: 0.3,
                u_smoke: 0,
                u_smokeSize: 0,
                u_noiseTexture: getShaderNoiseTexture()
            }, sizingUniforms('none'))
        },
        'waves': {
            fragment: wavesFragmentShader,
            speed: 0, // Waves je statický pattern (nemá u_time)
            colors: () => ({
                u_colorBack: TRANSPARENT,
                u_colorFront: withAlpha(cssColor('--silver-200', '#a8b5c5'), 0.35)
            }),
            uniforms: () => Object.assign({
                u_shape: 1.6,
                u_frequency: 0.5,
                u_amplitude: 0.4,
                u_spacing: 1.4,
                u_proportion: 0.35,
                u_softness: 0
            }, sizingUniforms('none', { u_scale: 0.6 }))
        },
        'liquid-metal': {
            fragment: liquidMetalFragmentShader,
            speed: 0.3,
            colors: () => ({
                u_colorBack: TRANSPARENT,
                u_colorTint: withAlpha(cssColor('--silver-100', '#d8e1ec'), 1)
            }),
            uniforms: () => Object.assign({
                u_repetition: 3,
                u_softness: 0.45,
                u_shiftRed: 0.3,
                u_shiftBlue: -0.3,
                u_distortion: 0.12,
                u_contour: 0.6,
                u_angle: 70,
                u_shape: LiquidMetalShapes.none,
                u_isImage: true
            }, sizingUniforms('contain', { u_scale: 0.92 }))
        }
    };

    const instances = new Map(); // el -> { mount, def, baseSpeed, observer, isStatic }

    function isStaticContext(opts) {
        if (opts && opts.forceAnimate) return false;
        return reducedMotionQuery.matches || mobileQuery.matches || Boolean(opts && opts.static);
    }

    function buildUniforms(def, opts) {
        const uniforms = Object.assign({}, def.uniforms(), def.colors(), (opts && opts.uniforms) || {});
        return uniforms;
    }

    async function stageMount(el, name, opts) {
        if (!el || instances.has(el)) return instances.get(el) || null;
        const def = SHADERS[name];
        if (!def) return null;

        try {
            const uniforms = buildUniforms(def, opts);

            // LiquidMetal potřebuje předzpracovaný obraz (edge gradient + alpha mapa)
            if (name === 'liquid-metal' && opts && opts.image) {
                const processed = await toProcessedLiquidMetal(opts.image);
                const img = new Image();
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = URL.createObjectURL(processed.pngBlob);
                });
                uniforms.u_image = img;
            }

            const isStatic = isStaticContext(opts);
            const baseSpeed = (opts && typeof opts.speed === 'number') ? opts.speed : def.speed;
            const speed = isStatic ? 0 : baseSpeed;

            // minPixelRatio (default 2!) a maxPixelCount drží počet pixelů na uzdě —
            // fullscreen scény jinak renderují miliony pixelů navíc bez viditelného zisku
            const pixel = def.pixel || {};
            const mount = new ShaderMount(el, def.fragment, uniforms, undefined, speed, 0, pixel.minRatio, pixel.maxCount);

            const record = { mount, def, opts: opts || {}, baseSpeed, isStatic, observer: null };

            // Mimo viewport → zastavit rAF (speed 0), ve viewportu → obnovit
            if (!isStatic && baseSpeed > 0) {
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach((entry) => {
                        mount.setSpeed(entry.isIntersecting ? baseSpeed : 0);
                    });
                }, { rootMargin: '80px' });
                observer.observe(el);
                record.observer = observer;
            }

            instances.set(el, record);
            return record;
        } catch (error) {
            console.warn('ldStage: mount failed (' + name + ')', error);
            return null; // caller si nechá CSS fallback
        }
    }

    function stageUnmount(el) {
        const record = instances.get(el);
        if (!record) return;
        if (record.observer) record.observer.disconnect();
        try { record.mount.dispose(); } catch (e) { /* už disposed */ }
        instances.delete(el);
    }

    function refreshColors() {
        instances.forEach((record) => {
            try {
                record.mount.setUniforms(record.def.colors());
            } catch (e) { /* instance mohla zaniknout */ }
        });
    }

    // Změna tématu (themeToggle přepíná atribut/class na <html>) → přebarvit scény
    const themeObserver = new MutationObserver(refreshColors);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });

    reducedMotionQuery.addEventListener('change', (e) => {
        instances.forEach((record) => {
            record.mount.setSpeed(e.matches ? 0 : record.baseSpeed);
        });
    });

    // Scéna se mountuje, až když se blíží do viewportu. Každý mount stojí WebGL
    // kontext + kompilaci shaderu, a dividery sedí hluboko na stránce (ř. 536,
    // 963, 997) — dřív se všechny tři kompilovaly hned při načtení, přestože je
    // nikdo nevidí. Hero je ve viewportu, takže mu observer zavolá callback
    // okamžitě a chová se dál jako dřív.
    const LAZY_MOUNT_MARGIN = '400px';

    function stageOptsFor(el) {
        const opts = {};
        if (el.hasAttribute('data-stage-static')) opts.static = true;
        if (el.hasAttribute('data-stage-image')) opts.image = el.getAttribute('data-stage-image');
        return opts;
    }

    function autoMount() {
        const nodes = Array.from(document.querySelectorAll('[data-stage]'));
        const mountNow = (el) => stageMount(el, el.getAttribute('data-stage'), stageOptsFor(el));

        if (!('IntersectionObserver' in window)) {
            nodes.forEach(mountNow);
            setupPortfolioAccent();
            runLogoIntro();
            return;
        }

        // Co je při načtení v prvním viewportu (hero), mountujeme rovnou podle
        // geometrie. Na skrytém tabu IntersectionObserver protnutí nehlásí, a
        // hero je nosný vizuál — nesmí záviset na tom, jestli má tab fokus.
        const viewport = window.innerHeight || document.documentElement.clientHeight;
        const eager = [];
        const lazy = [];
        nodes.forEach((el) => {
            const rect = el.getBoundingClientRect();
            (rect.top < viewport && rect.bottom > 0 ? eager : lazy).push(el);
        });

        eager.forEach(mountNow);

        if (lazy.length) {
            const mountObserver = new IntersectionObserver((entries, obs) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    obs.unobserve(entry.target);
                    mountNow(entry.target);
                });
            }, { rootMargin: LAZY_MOUNT_MARGIN });
            lazy.forEach((el) => mountObserver.observe(el));
        }

        setupPortfolioAccent();
        runLogoIntro();
    }

    // Logo intro — odjištěno inline skriptem v index.html (overlay kryje první
    // paint). Stage přebírá orchestraci: LiquidMetal kůže, do 600 ms rozhodnutí,
    // jinak SVG fallback. Pojistku (ldIntroFailsafe) ruší převzetím.
    function runLogoIntro() {
        if (!window.ldIntroArmed) return;
        window.ldIntroArmed = false;
        if (window.ldIntroFailsafe) clearTimeout(window.ldIntroFailsafe);

        const overlay = document.querySelector('.logo-intro-overlay');
        if (!overlay) {
            document.body.classList.remove('logo-intro-active');
            return;
        }
        const metalHost = overlay.querySelector('.logo-intro-metal');

        const runSvgIntro = () => {
            overlay.classList.remove('logo-intro-wait');
            setTimeout(() => document.body.classList.remove('logo-intro-active'), 1450);
        };

        // Mobil/reduced-motion: metal je animovaný — rovnou SVG
        if (!metalHost || isStaticContext(null)) {
            runSvgIntro();
            return;
        }

        let decided = false;
        const fallbackTimer = setTimeout(() => {
            if (decided) return;
            decided = true;
            runSvgIntro();
        }, 600);

        stageMount(metalHost, 'liquid-metal', {
            image: '/assets/brand/ld-mark.svg',
            forceAnimate: true
        }).then((inst) => {
            if (decided) {
                if (inst) stageUnmount(metalHost);
                return;
            }
            decided = true;
            clearTimeout(fallbackTimer);
            if (!inst) {
                runSvgIntro();
                return;
            }
            overlay.classList.remove('logo-intro-wait');
            overlay.classList.add('logo-intro-has-metal');
            setTimeout(() => {
                document.body.classList.remove('logo-intro-active');
                setTimeout(() => stageUnmount(metalHost), 450);
            }, 1900);
        }).catch(() => {
            if (decided) return;
            decided = true;
            clearTimeout(fallbackTimer);
            runSvgIntro();
        });
    }

    // PulsingBorder akcent na hover portfolio karet — jeden sdílený WebGL
    // context, host div se přesouvá na aktuální kartu. Jen desktop.
    function setupPortfolioAccent() {
        if (reducedMotionQuery.matches || mobileQuery.matches) return;
        const grid = document.getElementById('portfolioGrid');
        if (!grid) return;

        let host = null;
        let currentCard = null;

        const ensureHost = () => {
            if (host) return host;
            host = document.createElement('div');
            host.className = 'stage-card-accent';
            host.setAttribute('aria-hidden', 'true');
            return host;
        };

        grid.addEventListener('pointerover', (e) => {
            const card = e.target && e.target.closest ? e.target.closest('.portfolio-item') : null;
            if (!card || card === currentCard) return;
            currentCard = card;
            const el = ensureHost();
            card.appendChild(el);
            if (!instances.has(el)) {
                stageMount(el, 'pulsing-border', { forceAnimate: true });
            }
            requestAnimationFrame(() => el.classList.add('on'));
        });

        grid.addEventListener('pointerout', (e) => {
            if (!currentCard) return;
            const to = e.relatedTarget;
            if (to && currentCard.contains(to)) return;
            if (host) host.classList.remove('on');
            currentCard = null;
        });
    }

    window.ldStage = {
        mount: stageMount,
        unmount: stageUnmount,
        refreshColors: refreshColors,
        instances: instances
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoMount, { once: true });
    } else {
        autoMount();
    }

    window.dispatchEvent(new CustomEvent('ld:stage-ready'));
})();
