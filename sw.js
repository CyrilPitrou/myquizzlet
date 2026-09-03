const CACHE = 'myquizzlet-v16';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './app/style.css',
  './icons/icon-192.png', './icons/icon-512.png',
  './app/main.js', './app/app.js', './app/status.js', './app/ui.js',
  './app/store.js', './app/github.js', './app/sync.js', './app/srs.js',
  './app/grade.js', './app/csv.js', './app/merge.js',
  './app/langs.js', './app/stats.js', './app/train.js', './app/listform.js',
  './app/qr.js', './app/qrcard.js', './app/tokenshare.js', './app/setup.js', './app/zip.js', './app/install.js',
  './app/screens/lists.js', './app/screens/list.js', './app/screens/cards.js',
  './app/screens/test.js', './app/screens/settings.js',
  './app/screens/folders.js', './app/screens/editlist.js', './app/screens/view.js',
  './app/screens/train.js', './app/screens/help.js', './app/screens/adopt.js',
  './app/screens/token.js',
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
      // A cache miss falls back to the app shell only for a navigation. Any
      // other request — an icon, the manifest, a module — must fail as itself:
      // handing back index.html gives the browser an HTML document where it
      // asked for a PNG, and an icon that cannot be decoded is replaced by a
      // generated one. A broken image is honest; a disguised one is not.
      .catch(() => caches.match(request).then((hit) => {
        if (hit) return hit;
        if (request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      })),
  );
});
