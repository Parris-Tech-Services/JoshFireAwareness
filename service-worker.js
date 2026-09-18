const CACHE_NAME = 'jfa-static-v1';
const RUNTIME_CACHE = 'jfa-runtime-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/docs/favicon.svg',
  '/docs/INCIDENT_DICTIONARY.md',
  '/serverless-readme.md'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME && k !== RUNTIME_CACHE) return caches.delete(k);
        })
      );
      if (self.clients && self.clients.claim) await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Network-first for API endpoints (proxy/EMV/ArcGIS)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('data.emergency.vic.gov.au') || url.hostname.includes('emapdev.ffm.vic.gov.au')) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
          const cached = await caches.match(req);
          if (cached) return cached;
          return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
        }
      })()
    );
    return;
  }

  // Tile caching (cache-first with runtime fallback)
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        return caches.open(RUNTIME_CACHE).then((cache) => { cache.put(req, res.clone()); return res; });
      }).catch(() => cached))
    );
    return;
  }

  // Navigation requests -> serve cached index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cached) => cached || fetch(req))
    );
    return;
  }

  // For same-origin assets, use cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        return caches.open(RUNTIME_CACHE).then((cache) => { cache.put(req, res.clone()); return res; });
      }))
    );
    return;
  }

  // For cross-origin not handled above, fallback to network
});
