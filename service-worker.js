const CACHE_NAME = 'jfa-static-v1';
const RUNTIME_CACHE = 'jfa-runtime-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/docs/favicon.svg',
  '/docs/INCIDENT_DICTIONARY.md',
  '/serverless-readme.md'
];

function isApiRequest(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('data.emergency.vic.gov.au') ||
    url.hostname.includes('emapdev.ffm.vic.gov.au')
  );
}

function isTileRequest(url) {
  return url.hostname.includes('tile.openstreetmap.org');
}

async function networkFirst(req) {
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
}

function cacheFirst(req) {
  return caches.match(req).then((cached) => cached || fetch(req).then((res) => {
    return caches.open(RUNTIME_CACHE).then((cache) => {
      cache.put(req, res.clone());
      return res;
    });
  }).catch(() => cached));
}

function navigationResponse(req) {
  return caches.match('/index.html').then((cached) => cached || fetch(req));
}

function handleSecondaryFetch(event, req, url) {
  if (req.mode === 'navigate') {
    event.respondWith(navigationResponse(req));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req));
  }
}

function handleFetch(event) {
  const req = event.request;
  const url = new URL(req.url);

  if (isApiRequest(url)) {
    event.respondWith(networkFirst(req));
    return;
  }

  if (isTileRequest(url)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  handleSecondaryFetch(event, req, url);
}

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

self.addEventListener('fetch', handleFetch);
