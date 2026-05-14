const CACHE_NAME = 'zenith-cache-v2';
const urlsToCache = [
    '/',
    '/vite.svg'
];

self.addEventListener('install', event => {
    // Skip waiting to activate immediately
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('activate', event => {
    // Clean up old caches
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', event => {
    // Only cache GET requests and avoid API calls
    if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // If fetch succeeds, return response and cache it
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => cache.put(event.request, responseClone));
                }
                return response;
            })
            .catch(() => {
                // If fetch fails, try to serve from cache
                return caches.match(event.request);
            })
    );
});

// ── Push Notification Handling ──────────────────────────────────────────────
self.addEventListener('push', event => {
    let data = { title: 'Zenith', body: 'New notification', icon: '/vite.svg', url: '/' };
    
    try {
        if (event.data) {
            // Some browsers might send text instead of JSON
            const text = event.data.text();
            try {
                const payload = JSON.parse(text);
                data = { ...data, ...payload };
            } catch (e) {
                data.body = text;
            }
        }
    } catch (e) {
        console.error('Error parsing push data:', e);
    }

    const options = {
        body: data.body,
        icon: data.icon || '/vite.svg',
        badge: '/vite.svg',
        data: { url: data.url || '/' },
        vibrate: [100, 50, 100],
        tag: 'zenith-notification', // Groups similar notifications
        renotify: true, // Notifies again for the same tag
        actions: [
            { action: 'open', title: 'Open Zenith' }
        ],
        requireInteraction: true // Keeps notification visible until user interacts
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    const urlToOpen = new URL(event.notification.data?.url || '/', self.location.origin).href;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                // 1. Try to find an existing window and focus it
                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    if (client.url === urlToOpen && 'focus' in client) {
                        return client.focus();
                    }
                }
                // 2. If not found, try to focus any Zenith window and navigate
                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    if ('focus' in client) {
                        client.navigate(urlToOpen);
                        return client.focus();
                    }
                }
                // 3. If no window open, open a new one
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});
