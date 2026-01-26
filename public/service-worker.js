// MANUAL KILL SWITCH SERVICE WORKER
// This file will replace the existing sw.js on the user's device.
console.log("☠️ Killer Service Worker Loaded");

self.addEventListener('install', (event) => {
    // Force immediate activation
    console.log("☠️ Killer SW Installing...");
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log("☠️ Killer SW Activating & Cleaning Up...");

    event.waitUntil(
        Promise.all([
            // 1. Take control of all clients
            self.clients.claim(),
            // 2. Unregister THIS service worker (suicide mission)
            self.registration.unregister().then(() => {
                console.log("☠️ Killer SW Unregistered itself.");
            }),
            // 3. Delete ALL Caches
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        console.log("Deleting cache:", cacheName);
                        return caches.delete(cacheName);
                    })
                );
            }),
            // 4. Force Reload all open tabs
            self.clients.matchAll({ type: 'window' }).then(clients => {
                clients.forEach(client => {
                    console.log("Forcing reload on client:", client.url);
                    client.navigate(client.url);
                });
            })
        ])
    );
});
