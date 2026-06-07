/**
 * Push Notifications — Clean Web Push (VAPID) implementation.
 * No Firebase. No OneSignal. Just the Web Push API.
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// ── Helpers ────────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Check if push notifications are supported in this environment.
 */
export function isSupported() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get the current notification permission state.
 * @returns {'granted'|'denied'|'default'|'unsupported'}
 */
export function getPermissionState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Subscribe to push notifications.
 * Requests permission, registers SW, creates subscription.
 * @returns {Promise<PushSubscriptionJSON>} The subscription object (ready to save to DB)
 */
export async function subscribe() {
  if (!isSupported()) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  if (!VAPID_PUBLIC_KEY) {
    throw new Error('VAPID public key is not configured.');
  }

  // 1. Request permission
  let permission = Notification.permission;
  if (permission === 'denied') {
    throw new Error('Notifications are blocked. Enable them in your browser settings.');
  }

  if (permission === 'default') {
    permission = await Promise.race([
      Notification.requestPermission(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Permission request timed out.')), 8000)
      ),
    ]);
  }

  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  // 2. Get or register service worker
  let registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) {
    registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }

  // Wait for the SW to be active
  await navigator.serviceWorker.ready;

  // 3. Subscribe to push
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  return subscription.toJSON();
}

/**
 * Unsubscribe from push notifications.
 * @returns {Promise<boolean>} true if successfully unsubscribed
 */
export async function unsubscribe() {
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) return false;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;

  await subscription.unsubscribe();
  return true;
}
