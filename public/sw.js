const SHELL_CACHE = 'studybook-shell-v4';
const RUNTIME_CACHE = 'studybook-runtime-v4';
const SHELL = ['/', '/manifest.webmanifest', '/studybook-icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      await cache.addAll(SHELL);
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('studybook-') && ![SHELL_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key)),
      )),
      self.clients.claim(),
    ]),
  );
});

async function freshResponse(request) {
  const freshRequest = new Request(request, { cache: 'no-store' });
  const response = await fetch(freshRequest);
  if (response.ok) {
    const copy = response.clone();
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, copy);
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate' || ['script', 'style'].includes(request.destination)) {
    event.respondWith(
      freshResponse(request).catch(async () => (
        (await caches.match(request)) || (request.mode === 'navigate' ? caches.match('/') : undefined)
      )),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && ['font', 'image'].includes(request.destination)) {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
