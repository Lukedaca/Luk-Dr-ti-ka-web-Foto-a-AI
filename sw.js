// Pass-through service worker (žádné cachování).
// Důvod: cachované staré JS způsobovalo, že po deployi se nový kód neprojevil.
// PWA instalace zůstává, jen se vše tahá z network. HTTP Cache-Control hlavičky
// (immutable na /dist/*) zajišťují cache na úrovni prohlížeče.

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(names.map((n) => caches.delete(n))))
            .then(() => self.clients.claim())
    );
});

// Žádný fetch handler → prohlížeč jde přímo na síť.
