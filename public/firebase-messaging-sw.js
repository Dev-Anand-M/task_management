// Version: 1.0.6 (Modular V10)
console.log('[firebase-messaging-sw.js] Loading Modern SW...');

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

// Correct method name for Firebase 10+ Compat
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || payload.data?.title || 'New Update';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new message.',
    icon: '/zenith.png',
    badge: '/zenith.png',
    tag: 'idl-notification',
    renotify: true,
    requireInteraction: true,
    data: {
      link: payload.data?.link || '/'
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Force activation
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === link && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(link);
    })
  );
});
