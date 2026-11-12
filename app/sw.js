// Keeps a copy of the app on the device so it opens with no connection.
const CACHE = 'girt-and-purlin-v19';
const FILES = [
  './', 'index.html', 'style.css', 'main.js', 'scene.js', 'plan.js', 'drawings.js', 'manifest.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png',
  'vendor/three.module.min.js', 'vendor/three.core.js', 'vendor/OrbitControls.js', 'vendor/Sky.js',
  '../engine/design.js', '../engine/building.js', '../engine/framing.js', '../engine/metal.js', '../engine/cutlist.js',
  '../engine/pricing.js', '../engine/rules.js', '../engine/stock.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Try the network for a few seconds so updates arrive, then fall back to the saved copy.
// The browser is told to check with the server, so its own stored copy never hides an update.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request, { cache: 'no-cache' }).then((r) => { if (r.ok) cache.put(e.request, r.clone()); return r; });
    if (!saved) return fresh;
    fresh.catch(() => {});
    return Promise.race([fresh, new Promise((_, no) => setTimeout(no, 3000))]).catch(() => saved);
  })());
});
