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
            const payload = event.data.json();
            data = { ...data, ...payload };
        }
    } catch (e) {
        console.error('Error parsing push data:', e);
        if (event.data) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || '/vite.svg',
        badge: '/vite.svg',
        data: { url: data.url || '/' },
        vibrate: [100, 50, 100],
        actions: [
            { action: 'open', title: 'Open Zenith' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                // Check if there is already a window open with this URL
                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.navigate(urlToOpen);
                        return client.focus();
                    }
                }
                // If no window is open, open a new one
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});
