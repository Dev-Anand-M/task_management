// Version: 2.0.0 (Fixed duplicate notification handlers)
console.log('[firebase-messaging-sw.js] Loading SW v2.0.0...');

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const urlParams = new URLSearchParams(self.location.search);

const firebaseConfig = {
  apiKey: urlParams.get('apiKey'),
  authDomain: urlParams.get('authDomain'),
  projectId: urlParams.get('projectId'),
  storageBucket: urlParams.get('storageBucket'),
  messagingSenderId: urlParams.get('messagingSenderId'),
  appId: urlParams.get('appId')
};

if (firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();

// This is the ONLY handler for background messages.
// Do NOT add a separate 'push' event listener — it conflicts with this.
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);
  
  const title = payload.notification?.title || payload.data?.title || 'New Update';
  const options = {
    body: payload.notification?.body || payload.data?.body || 'You have a new message.',
    icon: '/zenith.png',
    badge: '/zenith.png',
    tag: 'zenith-' + (payload.data?.type || 'general') + '-' + Date.now(),
    renotify: true,
    vibrate: [200, 100, 200],
    silent: false,
    timestamp: Date.now(),
    data: {
      link: payload.data?.link || payload.fcmOptions?.link || '/',
      ...payload.data
    }
  };

  return self.registration.showNotification(title, options);
});

// Force activation on install
self.addEventListener('install', () => {
  console.log('[SW] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(clients.claim());
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'close') return;
  
  const link = event.notification.data?.link || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => client.navigate(link));
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(link);
      }
    })
  );
});
