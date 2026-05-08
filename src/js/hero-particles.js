/**
 * Hero Liquid Particle Headline — adapt z https://jarvis-design-signal.netlify.app/
 * Spring physics + mouse repel s cubic falloff + connection lines.
 * Tweaks: 11k particles max, DPR cap 1.5, palette dle loga, autohides h1 jen když canvas mounted.
 */
(function () {
    'use strict';

    // Guard proti double-mount: skript je teď eager-loaded přes <script defer>
    // i pořád loadable via core.js loadModule. Pustíme jen 1× per session.
    if (window.__heroParticlesInit) return;
    window.__heroParticlesInit = true;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(hover: none)').matches) return;
    if (window.innerWidth < 768) return;

    const headline = document.querySelector('.hero-headline');
    if (!headline) return;
    const h1 = headline.querySelector('.hero-h1');
    if (!h1) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'hero-particles';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.pointerEvents = 'none';
    headline.insertBefore(canvas, h1);

    const ctx = canvas.getContext('2d', { alpha: true });
    const dpr = 1;

    let W = 0, H = 0;
    let dots = [];
    let elapsed = 0;
    let rafId = 0;
    let isVisible = true;

    const rawMouse = { x: -9999, y: -9999 };
    const mouse = { x: -9999, y: -9999, px: -9999, py: -9999, vx: 0, vy: 0, smoothSpeed: 0 };

    // Paleta — vyváženo směr brightness: víc bright signal blue + čisté bílé,
    // tmavší tóny zachovány jen jako akcent (každé "324..." se objeví jen 1×).
    // Duplikace bright entries = vyšší pravděpodobnost výběru → text víc září.
    const COLORS = [
        '255, 255, 255',  // pure white
        '255, 255, 255',
        '236, 241, 247',  // silver-50
        '236, 241, 247',
        '108, 188, 239',  // signal-hi (bright)
        '108, 188, 239',
        '108, 188, 239',
        '160, 210, 250',  // light sky
        '78, 162, 224',   // signal
        '78, 162, 224',
        '216, 225, 236',  // silver-100
        '44, 126, 192'    // signal-deep (jediný tmavší accent)
    ];
    const REPEL_RADIUS = 130;
    const REPEL_FORCE = 13;

    function getText() {
        const t = (h1.textContent || '').trim().replace(/\s+/g, ' ');
        return t || 'Fotograf & AI Developer';
    }

    function resize() {
        const rect = headline.getBoundingClientRect();
        // Canvas roztáhnu na celou šířku viewportu (full-bleed),
        // aby particles měly prostor a vykreslily text VELKÝ.
        const vw = window.innerWidth;
        W = Math.max(320, Math.floor(vw));
        H = Math.max(280, Math.floor(rect.height));
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        // Centruj canvas na viewport (rodič může být užší, max-w-5xl)
        canvas.style.left = '50%';
        canvas.style.right = 'auto';
        canvas.style.transform = 'translateX(-50%)';
        canvas.style.maxWidth = 'none';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        buildText();
    }

    function buildText() {
        dots = [];
        ctx.clearRect(0, 0, W, H);
        const text = getText();
        const h1Style = window.getComputedStyle(h1);
        const fontFamily = h1Style.fontFamily || '"Geist", system-ui, sans-serif';
        const fontWeight = h1Style.fontWeight || '900';

        // VELKÝ viewport-based font; multi-line wrap (cíl 3 řádky pro
        // "Fotograf" / "& AI" / "Developer"). H1 computed style ignoruji,
        // protože H1 je hidden a může vrátit bezvýznamnou hodnotu.
        const lineHeight = 0.92;
        // Pro známé texty hardcoduju estetický wrap (jinak greedy by dal jiný split).
        const KNOWN_WRAPS = {
            'Fotograf & AI Developer': ['Fotograf', '& AI', 'Developer'],
            'Photographer & AI Developer': ['Photographer', '& AI', 'Developer']
        };
        function wrapLines(fontSize) {
            ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
            if (KNOWN_WRAPS[text]) return KNOWN_WRAPS[text].slice();
            const maxLineWidth = Math.min(W * 0.86, ctx.measureText('M').width * 14);
            const words = text.split(/\s+/);
            const out = [];
            let line = '';
            for (const w of words) {
                const test = line ? line + ' ' + w : w;
                if (ctx.measureText(test).width <= maxLineWidth) {
                    line = test;
                } else {
                    if (line) out.push(line);
                    line = w;
                }
            }
            if (line) out.push(line);
            return out;
        }

        // Velikost ~5× původního auto-shrink renderu (desktop cap 200px).
        // Desktop ≥1024: ~16 % šířky viewportu (cap 200px)
        // Tablet 640-1023: ~12 % vw (cap 130px)
        // Mobil <640: ~11 % vw (cap 76px)
        const vw = window.innerWidth;
        let fs;
        if (vw >= 1024)      fs = Math.min(vw * 0.16, 200);
        else if (vw >= 640)  fs = Math.min(vw * 0.12, 130);
        else                 fs = Math.min(vw * 0.11, 76);
        fs = Math.max(50, Math.round(fs));

        let lines = wrapLines(fs);
        // Shrink jen pokud nějaký řádek přesahuje canvas šířku
        // nebo celková výška překročí canvas. Zachovává VELKÝ font.
        let safety = 30;
        while (safety-- > 0 && fs > 60) {
            ctx.font = `${fontWeight} ${fs}px ${fontFamily}`;
            const totalH = lines.length * fs * lineHeight;
            const widestLine = Math.max.apply(null, lines.map(l => ctx.measureText(l).width));
            if (totalH <= H * 0.96 && widestLine <= W * 0.92) break;
            fs -= 6;
            lines = wrapLines(fs);
        }

        ctx.font = `${fontWeight} ${fs}px ${fontFamily}`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const totalHeight = lines.length * fs * lineHeight;
        const startY = (H - totalHeight) / 2 + (fs * lineHeight) / 2;
        lines.forEach((line, i) => {
            ctx.fillText(line, W / 2, startY + i * fs * lineHeight);
        });

        const imgData = ctx.getImageData(0, 0, W * dpr, H * dpr).data;
        // Density bumped: víc bodů na pixel = čitelnější písmo
        const targetCount = Math.min(5500, Math.floor(W * H / 200));

        let textPixels = 0;
        const scanGap = 4;
        for (let y = 0; y < H; y += scanGap) {
            for (let x = 0; x < W; x += scanGap) {
                const idx = (Math.floor(y * dpr) * Math.floor(W * dpr) + Math.floor(x * dpr)) * 4;
                if (imgData[idx + 3] > 128) textPixels++;
            }
        }
        const sampling = Math.max(2, Math.round(Math.sqrt(textPixels * scanGap * scanGap / targetCount)));

        for (let y = 0; y < H; y += sampling) {
            for (let x = 0; x < W; x += sampling) {
                const idx = (Math.floor(y * dpr) * Math.floor(W * dpr) + Math.floor(x * dpr)) * 4;
                if (imgData[idx + 3] > 128) {
                    const scatter = 30 + Math.random() * 40;
                    const angle = Math.random() * Math.PI * 2;
                    const distFromCenter = Math.sqrt((x - W / 2) ** 2 + (y - H / 2) ** 2);
                    dots.push({
                        ox: x, oy: y,
                        x: x + Math.cos(angle) * scatter,
                        y: y + Math.sin(angle) * scatter,
                        vx: 0, vy: 0,
                        // Body bumped: 2.0–5.5px (předtím 1.6–4.0)
                        size: Math.random() * 3.5 + 2.0,
                        color: COLORS[Math.floor(Math.random() * COLORS.length)],
                        revealDelay: distFromCenter * 0.0028 + Math.random() * 0.25,
                        revealProgress: 0
                    });
                }
            }
        }
        ctx.clearRect(0, 0, W, H);
    }

    function localizeMouse(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        rawMouse.x = clientX - rect.left;
        rawMouse.y = clientY - rect.top;
    }

    function onMove(e) {
        if (e.touches && e.touches.length) {
            localizeMouse(e.touches[0].clientX, e.touches[0].clientY);
        } else {
            localizeMouse(e.clientX, e.clientY);
        }
    }
    function onLeave() {
        rawMouse.x = -9999; rawMouse.y = -9999;
    }

    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); onMove(e); }, { passive: false });
    canvas.addEventListener('touchend', onLeave);

    function draw() {
        if (!isVisible) { rafId = 0; return; }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Lerp smooth mouse
        mouse.px = mouse.x;
        mouse.py = mouse.y;
        if (rawMouse.x > -9000) {
            if (mouse.x < -9000) {
                mouse.x = rawMouse.x;
                mouse.y = rawMouse.y;
            } else {
                mouse.x += (rawMouse.x - mouse.x) * 0.32;
                mouse.y += (rawMouse.y - mouse.y) * 0.32;
            }
        } else {
            mouse.x = -9999; mouse.y = -9999;
        }

        const rawVx = mouse.x - mouse.px;
        const rawVy = mouse.y - mouse.py;
        mouse.vx += (rawVx - mouse.vx) * 0.3;
        mouse.vy += (rawVy - mouse.vy) * 0.3;
        const rawSpeed = Math.sqrt(mouse.vx * mouse.vx + mouse.vy * mouse.vy);
        mouse.smoothSpeed += (rawSpeed - mouse.smoothSpeed) * 0.15;

        // Motion blur trail (destination-out, transparent canvas)
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';

        const dynRadius = REPEL_RADIUS + Math.min(mouse.smoothSpeed * 1.1, 70);
        const dynForce = REPEL_FORCE + Math.min(mouse.smoothSpeed * 0.45, 14);

        elapsed += 0.016;
        const len = dots.length;

        for (let i = 0; i < len; i++) {
            const d = dots[i];

            // Reveal stagger
            if (d.revealProgress < 1) {
                d.revealProgress = Math.min(1, Math.max(0, (elapsed - d.revealDelay) / 0.8));
                const ep = 1 - Math.pow(1 - d.revealProgress, 3);
                d.x += (d.ox - d.x) * ep * 0.08;
                d.y += (d.oy - d.y) * ep * 0.08;
                d.vx *= 0.5; d.vy *= 0.5;
                // Reveal alpha bumped na 0.78 (z 0.38) — viditelnější fade-in
                ctx.fillStyle = `rgba(${d.color},${ep * 0.78})`;
                ctx.fillRect(d.x - d.size * 0.5, d.y - d.size * 0.5, d.size, d.size);
                continue;
            }

            // Spring k origin
            const dx = d.ox - d.x, dy = d.oy - d.y;
            const dist = dx * dx + dy * dy;
            const spring = dist > 10000 ? 0.07 : dist > 400 ? 0.035 : 0.02;
            d.vx += dx * spring;
            d.vy += dy * spring;

            // Mouse repel s cubic falloff
            const mdx = d.x - mouse.x, mdy = d.y - mouse.y;
            const md = Math.sqrt(mdx * mdx + mdy * mdy);
            if (md < dynRadius && md > 0.1) {
                const t = (dynRadius - md) / dynRadius;
                const f = t * t * t * dynForce;
                const nx = mdx / md, ny = mdy / md;
                const velScale = Math.min(0.22, 0.13 + mouse.smoothSpeed * 0.0018);
                d.vx += nx * f + mouse.vx * t * velScale;
                d.vy += ny * f + mouse.vy * t * velScale;
            }

            d.vx *= 0.86;
            d.vy *= 0.86;
            d.x += d.vx;
            d.y += d.vy;

            const displacement = Math.sqrt((d.x - d.ox) ** 2 + (d.y - d.oy) ** 2);
            // Alpha full bright: 0.92 → 1.0 (předtím 0.78 → 0.95)
            const alpha = Math.min(1.0, 0.92 + displacement * 0.006);
            const sz = d.size + (displacement > 18 ? Math.min(displacement * 0.012, 1.4) : 0);

            // Soft glow halo — vykresluje se jen pro větší body (perf-friendly).
            // 2.6× větší square, low alpha → bloom dojem kolem ostrého jádra.
            if (sz > 3.2) {
                ctx.fillStyle = `rgba(${d.color},${alpha * 0.18})`;
                const haloSz = sz * 2.6;
                ctx.fillRect(d.x - haloSz * 0.5, d.y - haloSz * 0.5, haloSz, haloSz);
            }
            // Sharp core
            ctx.fillStyle = `rgba(${d.color},${alpha})`;
            ctx.fillRect(d.x - sz * 0.5, d.y - sz * 0.5, sz, sz);

        }

        rafId = requestAnimationFrame(draw);
    }

    function start() {
        headline.classList.add('with-particles');
        resize();
        rafId = requestAnimationFrame(draw);
    }

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            cancelAnimationFrame(rafId);
            elapsed = 0;
            resize();
            rafId = requestAnimationFrame(draw);
        }, 200);
    });

    document.addEventListener('visibilitychange', () => {
        isVisible = !document.hidden;
        if (isVisible && !rafId) {
            rafId = requestAnimationFrame(draw);
        }
    });

    requestAnimationFrame(start);
})();
