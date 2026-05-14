// Service Worker for Zenith Productivity System
// Handles background notifications even when the app is closed

self.addEventListener('install', (event) => {
    console.log('[Zenith SW] Installed');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[Zenith SW] Activated');
});

// Periodic Sync (if supported) to check for alarms
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-alarms') {
        event.waitUntil(checkRoutinesAndNotify());
    }
});

// We can also use a "push" event if we had a backend
self.addEventListener('push', (event) => {
    const data = event.data.json();
    self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/zenith.png',
        badge: '/zenith.png',
        tag: data.id,
        actions: [
            { action: 'open', title: 'Open App' }
        ]
    });
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Local check function (limited by SW environment, needs access to indexedDB or similar)
// For now, the best reliability is the GlobalAlarmListener while the browser is open.
async function checkRoutinesAndNotify() {
    // This would ideally fetch from a local cache or Supabase
    // But Service Workers have limited network access in some contexts
    console.log('[Zenith SW] Periodic check triggered');
}
