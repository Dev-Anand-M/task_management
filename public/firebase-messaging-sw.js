// Version: 1.0.7 (Enhanced Mobile Support)
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
    image: '/zenith.png', // Large image for rich notifications
    tag: 'zenith-notification',
    renotify: true,
    requireInteraction: true, // Keep notification visible until user interacts
    vibrate: [200, 100, 200], // Vibration pattern for mobile
    silent: false, // Ensure sound plays
    timestamp: Date.now(),
    data: {
      link: payload.data?.link || '/',
      ...payload.data
    },
    // Add action buttons for better mobile engagement
    actions: [
      {
        action: 'open',
        title: 'Open',
        icon: '/zenith.png'
      },
      {
        action: 'close',
        title: 'Dismiss',
        icon: '/zenith.png'
      }
    ]
  };

  console.log('[firebase-messaging-sw.js] Showing notification with options:', notificationOptions);
  
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Force activation
self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Activating...');
  event.waitUntil(clients.claim());
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event.action);
  event.notification.close();
  
  // Handle action buttons
  if (event.action === 'close') {
    return; // Just close the notification
  }
  
  const link = event.notification.data?.link || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => client.navigate(link));
        }
      }
      // Open a new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(link);
      }
    })
  );
});

// Handle push event directly (for both foreground and background)
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Push event received:', event);
  
  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[firebase-messaging-sw.js] Push payload:', payload);
      
      // Handle both notification and data-only messages
      const notificationTitle = payload.notification?.title || payload.data?.title || 'New Update';
      const notificationBody = payload.notification?.body || payload.data?.body || 'You have a new message.';
      const notificationLink = payload.data?.link || payload.fcmOptions?.link || '/';
      
      const notificationOptions = {
        body: notificationBody,
        icon: payload.data?.icon || '/zenith.png',
        badge: payload.data?.badge || '/zenith.png',
        image: payload.data?.image || '/zenith.png',
        tag: 'zenith-notification-' + Date.now(), // Unique tag to prevent grouping
        renotify: true,
        requireInteraction: false, // Don't require interaction for better UX
        vibrate: [200, 100, 200],
        silent: false,
        timestamp: Date.now(),
        data: {
          link: notificationLink,
          ...payload.data
        },
        actions: [
          { action: 'open', title: 'Open', icon: '/zenith.png' },
          { action: 'close', title: 'Dismiss', icon: '/zenith.png' }
        ]
      };
      
      console.log('[firebase-messaging-sw.js] Showing notification:', notificationTitle, notificationOptions);
      
      event.waitUntil(
        self.registration.showNotification(notificationTitle, notificationOptions)
      );
    } catch (error) {
      console.error('[firebase-messaging-sw.js] Error parsing push data:', error);
    }
  } else {
    console.log('[firebase-messaging-sw.js] Push event has no data');
  }
});
