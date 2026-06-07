// Zenith Service Worker
const CACHE_NAME = 'zenith-v2';
const OFFLINE_URL = '/offline.html';

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([OFFLINE_URL, '/manifest.json', '/zenith.png'])
        .catch(() => {/* non-critical */})
    )
  );
  self.skipWaiting();
});

// ── Activate ───────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch (network-first, offline fallback) ────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') return caches.match(OFFLINE_URL);
          return new Response('Offline', { status: 503 });
        })
      )
  );
});

// ── Push ────────────────────────────────────────────────────────────────────────
// CRITICAL: This handler runs even when the app is closed/backgrounded.
// The browser wakes the service worker specifically to handle this event.
// showNotification MUST be called inside event.waitUntil() — if it's not,
// Android will kill the SW before the notification is shown.
self.addEventListener('push', (event) => {
  let data = { title: 'Zenith', body: 'You have a new notification', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) { /* fallback to defaults */ }

  // Show the notification immediately — no async work before this!
  const promiseChain = self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/zenith.png',
    badge: '/zenith.png',
    image: undefined,
    data: { url: data.url || '/' },
    tag: data.tag || 'zenith-' + Date.now(),
    timestamp: data.timestamp || Date.now(),
    vibrate: [200, 100, 200, 100, 200],
    renotify: true,        // Always alert even if same tag exists
    requireInteraction: true, // DON'T auto-dismiss on Android — user must tap/swipe
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    // Android notification channel hint (Chrome 115+)
    silent: false,
  });

  event.waitUntil(promiseChain);
});

// ── Notification Click ─────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Handle action buttons
  if (event.action === 'dismiss') return;
  
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
