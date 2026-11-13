// Keeps a copy of the app on the device so it opens with no connection.
const CACHE = 'girt-and-purlin-v44';
const FILES = [
  './', 'index.html', 'style.css', 'main.js', 'lock.js', 'office.js', 'scene.js', 'plan.js', 'drawings.js', 'manifest.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png',
  'vendor/three.module.min.js', 'vendor/three.core.js', 'vendor/OrbitControls.js', 'vendor/Sky.js',
  '../engine/design.js',
  '../engine/sheds.js', '../engine/finish.js', '../engine/building.js', '../engine/framing.js', '../engine/metal.js', '../engine/cutlist.js',
  '../engine/pricing.js', '../engine/retail-prices.js', '../engine/rules.js', '../engine/stock.js', '../engine/runs.js', '../engine/interior.js', '../engine/dxf.js', '../engine/site.js', '../engine/fit.js', '../engine/license.js',
];

// A host can answer with a "checking your browser" page in place of the file. Only a plain 200 that is not
// such a page is the real file, and nothing else is ever saved.
const real = (r) => r.status === 200 && !r.headers.get('sg-captcha');

// Fetched a few at a time, so a burst of requests does not look like an attack to the host.
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (let i = 0; i < FILES.length; i += 4) {
      await Promise.all(FILES.slice(i, i + 4).map(async (f) => {
        const r = await fetch(new Request(f, { cache: 'reload' }));
        if (!real(r)) throw new Error('not saved: ' + f);
        await cache.put(f, r);
      }));
    }
    await self.skipWaiting();
  })());
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
    const fresh = fetch(e.request, { cache: 'no-cache' }).then((r) => {
      if (real(r)) cache.put(e.request, r.clone());
      else if (saved && r.status !== 404) throw new Error('not the real file');
      return r;
    });
    if (!saved) return fresh;
    fresh.catch(() => {});
    return Promise.race([fresh, new Promise((_, no) => setTimeout(no, 3000))]).catch(() => saved);
  })());
});
