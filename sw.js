/**
 * Service worker - what makes the app installable and genuinely offline.
 *
 * Strategy is network-first with a cache fallback, not cache-first. The
 * platform is developed by editing the very files this would cache, and a
 * service worker that serves yesterday's JavaScript is a bug that looks like a
 * mystery. Network-first costs one request when online and still answers
 * everything from the cache when there is no network at all.
 *
 * The precache list is deliberately short: the shell and the vendored
 * libraries. Everything else is cached the first time it is fetched, which is
 * the first time a learner opens the section that needs it.
 */

const VERSION = 'berugo-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './lib/tailwind.css',
  './src/css/main.css',
  './lib/jquery-3.7.1.min.js',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSION)
      .then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (key) {
          return key === VERSION ? null : caches.delete(key);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

function fromNetwork(request) {
  return fetch(request).then(function (response) {
    if (!response || !response.ok || response.type === 'opaque') return response;
    const copy = response.clone();
    caches.open(VERSION).then(function (cache) { cache.put(request, copy); });
    return response;
  });
}

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fromNetwork(request).catch(function () {
      return caches.match(request).then(function (cached) {
        if (cached) return cached;
        if (request.mode === 'navigate') return caches.match('./index.html');
        return new Response('offline', { status: 503, statusText: 'offline' });
      });
    })
  );
});
