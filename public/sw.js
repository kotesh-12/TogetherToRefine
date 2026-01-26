// FORCE UPDATE SERVICE WORKER
// This SW is designed to replace the stale cached SW.
// It claims control immediately and forces a reload.

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        self.clients.claim().then(() => {
            // Optional: Force reload all clients
            self.clients.matchAll({ type: 'window' }).then(clients => {
                clients.forEach(client => {
                    client.navigate(client.url);
                });
            });
        })
    );
});
