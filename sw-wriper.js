self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => caches.delete(cacheName))
            );
        }).then(() => {
            return self.registration.unregister();
        }).then(() => {
            console.log('Service Worker unregistered and cache cleared.');
            // Broadcast to clients to reload
            return self.clients.matchAll();
        }).then((clients) => {
            clients.forEach(client => {
                client.navigate(client.url);
            });
        })
    );
});
