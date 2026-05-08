/**
 * Hero Liquid Particle Headline — adapt z https://jarvis-design-signal.netlify.app/
 * Spring physics + mouse repel s cubic falloff + connection lines.
 * Tweaks: 11k particles max, DPR cap 1.5, palette dle loga, autohides h1 jen když canvas mounted.
 */
(function () {
    'use strict';

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
    headline.insertBefore(canvas, h1);

    const ctx = canvas.getContext('2d', { alpha: true });
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    let W = 0, H = 0;
    let dots = [];
    let elapsed = 0;
    let rafId = 0;
    let isVisible = true;

    const rawMouse = { x: -9999, y: -9999 };
    const mouse = { x: -9999, y: -9999, px: -9999, py: -9999, vx: 0, vy: 0, smoothSpeed: 0 };

    // Paleta z loga (silver tóny + signal blue)
    const COLORS = [
        '236, 241, 247',
        '216, 225, 236',
        '108, 188, 239',
        '78, 162, 224',
        '44, 126, 192',
        '168, 181, 197'
    ];
    const REPEL_RADIUS = 130;
    const REPEL_FORCE = 13;

    function getText() {
        const t = (h1.textContent || '').trim().replace(/\s+/g, ' ');
        return t || 'Fotograf & AI Developer';
    }

    function resize() {
        const rect = headline.getBoundingClientRect();
        W = Math.max(320, Math.floor(rect.width));
        H = Math.max(200, Math.floor(rect.height));
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        buildText();
    }

    function buildText() {
        dots = [];
        ctx.clearRect(0, 0, W, H);
        const text = getText();
        const fontFamily = '"Geist", system-ui, sans-serif';

        // Auto-fit font size do 86% šířky
        let fs = 30;
        ctx.font = `900 ${fs}px ${fontFamily}`;
        while (ctx.measureText(text).width < W * 0.86 && fs < 600) {
            fs += 2;
            ctx.font = `900 ${fs}px ${fontFamily}`;
        }
        fs -= 2;
        ctx.font = `900 ${fs}px ${fontFamily}`;

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, W / 2, H / 2);

        const imgData = ctx.getImageData(0, 0, W * dpr, H * dpr).data;
        const targetCount = Math.min(11000, Math.floor(W * H / 110));

        let textPixels = 0;
        const scanGap = 3;
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
                        size: Math.random() * 1.6 + 0.7,
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
                ctx.fillStyle = `rgba(${d.color},${ep * 0.7})`;
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
            const alpha = Math.min(1, 0.7 + displacement * 0.012);
            ctx.fillStyle = `rgba(${d.color},${alpha})`;
            const sz = d.size + (displacement > 18 ? Math.min(displacement * 0.012, 1.4) : 0);
            ctx.fillRect(d.x - sz * 0.5, d.y - sz * 0.5, sz, sz);

            // Connection lines mezi displaced sousedy (každý 6. — úspora CPU)
            if (displacement > 24 && i % 6 === 0) {
                for (let j = i + 3; j < Math.min(i + 9, len); j += 2) {
                    const q = dots[j];
                    const qdx = d.x - q.x, qdy = d.y - q.y;
                    const qd = qdx * qdx + qdy * qdy;
                    if (qd < 1400) {
                        const lineAlpha = (1 - qd / 1400) * 0.16;
                        ctx.strokeStyle = `rgba(${d.color},${lineAlpha})`;
                        ctx.lineWidth = 0.5;
                        ctx.beginPath();
                        ctx.moveTo(d.x, d.y);
                        ctx.lineTo(q.x, q.y);
                        ctx.stroke();
                    }
                }
            }
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

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(start);
    } else {
        setTimeout(start, 250);
    }
})();
