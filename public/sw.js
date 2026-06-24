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

  const url = new URL(event.request.url);
  if (url.pathname === '/sw-diagnostic-report') {
    event.respondWith(
      caches.open('sw-diagnostics').then(async (cache) => {
        const keys = await cache.keys();
        const logs = [];
        for (const key of keys) {
          try {
            const res = await cache.match(key);
            if (res) {
              const logEntry = await res.json();
              logs.push(logEntry);
            }
          } catch (e) {
            logs.push({ timestamp: new Date().toISOString(), message: `Error reading log entry: ${e.message}` });
          }
        }
        logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        return new Response(JSON.stringify(logs, null, 2), {
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
          }
        });
      }).catch((err) => {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  if (url.pathname === '/sw-diagnostic-clear') {
    event.respondWith(
      caches.delete('sw-diagnostics').then((deleted) => {
        return new Response(JSON.stringify({ success: deleted }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }).catch((err) => {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

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

// ── Diagnostics Logger ────────────────────────────────────────────────────────
const logToCache = async (msg) => {
  try {
    const cache = await caches.open('sw-diagnostics');
    const logEntry = {
      timestamp: new Date().toISOString(),
      message: msg,
    };
    await cache.put(
      new Request(`/log-${Date.now()}-${Math.random()}`),
      new Response(JSON.stringify(logEntry), {
        headers: { 'Content-Type': 'application/json' }
      })
    );
  } catch (e) {
    // Ignore
  }
};

// ── Push ────────────────────────────────────────────────────────────────────────
// CRITICAL: This handler runs even when the app is closed/backgrounded.
// The browser wakes the service worker specifically to handle this event.
// showNotification MUST be called inside event.waitUntil() — if it's not,
// Android will kill the SW before the notification is shown.
self.addEventListener('push', (event) => {
  const promiseChain = (async () => {
    await logToCache('=== Service Worker Push Event Fired ===');
    
    let rawData = null;
    if (event.data) {
      try {
        rawData = event.data.text();
        await logToCache(`Raw push payload text: ${rawData}`);
      } catch (e) {
        await logToCache(`Failed to read event.data as text: ${e.message}`);
      }
    } else {
      await logToCache('event.data is empty or undefined');
    }

    let data = { title: 'Zenith', body: 'You have a new notification', url: '/' };
    try {
      if (event.data) {
        data = { ...data, ...event.data.json() };
        await logToCache('Parsed JSON payload successfully.');
      }
    } catch (e) {
      await logToCache(`JSON parsing failed (falling back to defaults): ${e.message}`);
    }

    // Resolve absolute URL for the icon (required for background notifications on mobile)
    const iconUrl = new URL('/zenith.png', self.location.origin).href;

    try {
      await logToCache('Attempting self.registration.showNotification...');
      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: iconUrl,
        image: undefined,
        data: { url: data.url || '/' },
        tag: data.tag || 'zenith-' + Date.now(),
        timestamp: data.timestamp || Date.now(),
        vibrate: [200, 100, 200, 100, 200],
        renotify: true,        // Always alert even if same tag exists
        requireInteraction: false, // Don't block mobile UI thread
        actions: [
          { action: 'open', title: 'Open' },
          { action: 'dismiss', title: 'Dismiss' }
        ],
        silent: false,
      });
      await logToCache('self.registration.showNotification executed successfully!');
    } catch (err) {
      await logToCache(`self.registration.showNotification THREW EXCEPTION: ${err.message}\nStack: ${err.stack}`);
    }
  })();

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

// ── Message listener for debugging/instrumentation ───────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'TEST_MOCK_PUSH') {
    const payload = event.data.payload || {
      title: 'Mock Push Notification 🔔',
      body: 'This is a mock push triggered via postMessage!',
      url: '/settings',
      tag: 'zenith-mock-' + Date.now(),
      timestamp: Date.now()
    };
    
    logToCache('=== Mock Push Received in Message Listener ===');
    
    try {
      const pushEvent = new PushEvent('push', {
        data: typeof payload === 'string' ? payload : JSON.stringify(payload)
      });
      self.dispatchEvent(pushEvent);
      logToCache('Dispatched PushEvent successfully.');
    } catch (e) {
      logToCache(`Failed to dispatch standard PushEvent: ${e.message}. Running fallback...`);
      // Fallback: manually invoke the push logic
      const promiseChain = (async () => {
        await logToCache('=== Service Worker Fallback Push Event Fired ===');
        let data = { title: 'Zenith', body: 'You have a new notification', url: '/' };
        if (typeof payload === 'object') {
          data = { ...data, ...payload };
        } else {
          try { data = { ...data, ...JSON.parse(payload) }; } catch(err) {}
        }
        const iconUrl = new URL('/zenith.png', self.location.origin).href;
        try {
          await logToCache('Attempting self.registration.showNotification (fallback)...');
          await self.registration.showNotification(data.title, {
            body: data.body,
            icon: iconUrl,
            data: { url: data.url || '/' },
            tag: data.tag || 'zenith-' + Date.now(),
            timestamp: data.timestamp || Date.now(),
            actions: [
              { action: 'open', title: 'Open' },
              { action: 'dismiss', title: 'Dismiss' }
            ],
          });
          await logToCache('self.registration.showNotification (fallback) executed successfully!');
        } catch (err) {
          await logToCache(`self.registration.showNotification (fallback) THREW EXCEPTION: ${err.message}\nStack: ${err.stack}`);
        }
      })();
      if (event.waitUntil) {
        event.waitUntil(promiseChain);
      }
    }
  }
});
