// Service worker: network-first (so updates arrive), cache fallback (so the installed game works offline).
const CACHE = 'r2r-v2';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './game/', './manifest.webmanifest', './icon-192.png', './icon-512.png']).catch(() => {}))); });
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET') return;
  e.respondWith(fetch(r).then((res) => { if (res.ok && new URL(r.url).origin === location.origin) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); } return res; })
    .catch(() => caches.match(r, { ignoreSearch: true })));
});
