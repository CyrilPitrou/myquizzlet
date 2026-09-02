const CACHE = 'myquizzlet-v3';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './app/style.css',
  './app/main.js', './app/app.js', './app/status.js', './app/ui.js',
  './app/store.js', './app/github.js', './app/sync.js', './app/srs.js',
  './app/grade.js', './app/csv.js', './app/merge.js',
  './app/langs.js', './app/stats.js', './app/train.js',
  './app/screens/lists.js', './app/screens/list.js',
  './app/screens/test.js', './app/screens/settings.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;   // never cache api.github.com
  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html'))),
  );
});
