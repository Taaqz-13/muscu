/* Service worker : app disponible hors ligne (salle de sport sans reseau).
   Reseau d'abord, cache en secours.
   GitHub Pages sert tout en max-age=600 : sans precaution, une relance juste
   apres une mise en ligne melange ancien et nouveau JS. On force donc la
   revalidation ('no-cache' = 304 si rien n'a change). Piege deja paye sur
   les apps Taches et Prompteur. Changer CACHE a chaque mise en ligne. */
const CACHE = 'muscu-v3';
const ASSETS = [
  './', './index.html', './manifest.json', './css/app.css',
  './js/seed.js', './js/stats.js', './js/store.js', './js/sync.js', './js/app.js',
  './icon-180.png', './icon-192.png', './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ASSETS.map(a => fetch(a, { cache: 'reload' }).then(r => r.ok && c.put(a, r)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fetchFrais(request) {
  try { return fetch(request, { cache: 'no-cache' }); } catch (e) { return fetch(request); }
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  /* Jamais les appels a l'API GitHub ni les autres origines */
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetchFrais(e.request)
      .then(r => {
        if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })
        .then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
