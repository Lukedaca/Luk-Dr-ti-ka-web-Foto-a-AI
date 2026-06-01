(function () {
    'use strict';

    const CORE_SRC = '/dist/js/core.min.js?v=36';
    const REPLAY_SELECTOR = [
        '#chatBtn',
        '#themeToggle',
        '#themeToggleMobile',
        '#mobileMenuBtn',
        '.lang-switch-btn',
        '#voice-call-btn',
        '#hero-send',
        '.hero-qr',
        '.speech-output-toggle'
    ].join(',');

    let loading = false;
    let loaded = false;

    function loadCore(callback) {
        if (loaded || window.ldCoreReady) {
            loaded = true;
            if (typeof callback === 'function') callback();
            return;
        }

        if (loading) {
            if (typeof callback === 'function') {
                window.addEventListener('ld:core-ready', callback, { once: true });
            }
            return;
        }

        loading = true;
        if (typeof callback === 'function') {
            window.addEventListener('ld:core-ready', callback, { once: true });
        }

        const script = document.createElement('script');
        script.src = CORE_SRC;
        script.async = true;
        script.onload = () => {
            loaded = true;
        };
        document.body.appendChild(script);
    }

    function replayClick(target) {
        if (!target || !document.contains(target)) return;
        target.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        }));
    }

    document.addEventListener('click', (event) => {
        const target = event.target && event.target.closest
            ? event.target.closest(REPLAY_SELECTOR)
            : null;
        if (!target || window.ldCoreReady) return;

        event.preventDefault();
        event.stopPropagation();
        loadCore(() => {
            window.setTimeout(() => replayClick(target), 0);
        });
    }, true);

    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((eventName) => {
        window.addEventListener(eventName, () => loadCore(), { once: true, passive: true });
    });

    window.setTimeout(() => loadCore(), 15000);
}());
