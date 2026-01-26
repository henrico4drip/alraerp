const VERSION = 'v6-cache-purge';

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clear any old caches
      caches.keys().then((keyList) => {
        return Promise.all(keyList.map((key) => {
          return caches.delete(key);
        }));
      })
    ])
  )
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request).catch(() => new Response('', { status: 408 })))
})
