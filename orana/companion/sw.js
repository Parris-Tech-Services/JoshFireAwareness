// Hosted offline cache: app pages and code only. The private library is never fetched as a file, so it cannot be cached here.
const CACHE = 'bbc-hosted-v1', SHELL = ['./', 'index.html', 'app.css', 'login.css', 'login.js', 'app.js', 'lib/integrity.js', 'lib/logic.js', 'manifest.json', 'icon.svg', 'icon-192.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
