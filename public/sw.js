self.addEventListener('install', () => {
    // Skip over the "waiting" lifecycle state, to ensure that our
    // new service worker is activated immediately, even if there's
    // another tab open using the old service worker.
    self.skipWaiting();
});

self.addEventListener('activate', () => {
    // Optional: Get a list of all the current open windows/tabs under
    // our service worker's control, and force them to reload.
    // This reloads the page to load the new non-SW version (v42/43).
    self.clients.matchAll({ type: 'window' }).then(windowClients => {
        windowClients.forEach(windowClient => {
            windowClient.navigate(windowClient.url);
        });
    });

    // Immediately unregister this SW so it doesn't control future loads either
    self.registration.unregister();
});
