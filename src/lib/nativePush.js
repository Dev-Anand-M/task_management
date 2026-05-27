// Native Push Notification API Wrapper (No external SDK needed)

// VAPID public key - generate with: npx web-push generate-vapid-keys
// You'll need to add this to your .env as VITE_VAPID_PUBLIC_KEY
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * Check if push notifications are supported
 */
export const isPushSupported = () => {
  return window.isSecureContext &&
         'serviceWorker' in navigator && 
         'PushManager' in window && 
         'Notification' in window;
};

/**
 * Check if service worker is registered
 */
export const isServiceWorkerRegistered = async () => {
  if (!('serviceWorker' in navigator)) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  return !!registration;
};

/**
 * Register service worker
 */
export const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers not supported');
  }
  
  try {
    console.log('[Push] Registering service worker...');
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    console.log('[Push] Service worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('[Push] Service worker registration failed:', error);
    throw error;
  }
};

/**
 * Request notification permission and get push subscription
 */
export const requestPushPermission = async () => {
  if (!isPushSupported()) {
    throw new Error('Push notifications not supported in this environment (must be a secure context)');
  }
  
  try {
    let permission = Notification.permission;
    console.log('[Push] Current permission state:', permission);
    
    if (permission === 'default') {
      console.log('[Push] Prompting user for notification permission...');
      
      // Resilient permission request wrapper with callback support and a 5-second timeout race
      permission = await Promise.race([
        new Promise((resolve) => {
          try {
            const p = Notification.requestPermission(resolve);
            if (p && typeof p.then === 'function') {
              p.then(resolve).catch(() => resolve(Notification.permission));
            }
          } catch (err) {
            resolve(Notification.permission);
          }
        }),
        new Promise((resolve) => setTimeout(() => {
          console.warn('[Push] Permission request timed out. Checking current state.');
          resolve(Notification.permission);
        }, 5000))
      ]);
      
      console.log('[Push] User prompt response:', permission);
    }
    
    if (permission !== 'granted') {
      throw new Error('Notification permission denied');
    }
    
    // ── Resilient SW Registration & Cleanup ──────────────────────────────────
    // Aggressively unregister conflicting legacy service workers to avoid background push routing issues.
    const registrations = await navigator.serviceWorker.getRegistrations();
    let swRegistration = null;
    
    for (const reg of registrations) {
      const activeUrl = reg.active?.scriptURL || '';
      if (activeUrl.includes('sw.js')) {
        swRegistration = reg;
      } else {
        console.log('[Push] Unregistering conflicting legacy service worker:', activeUrl);
        await reg.unregister();
      }
    }
    
    // Explicitly register sw.js if not already present
    if (!swRegistration) {
      swRegistration = await registerServiceWorker();
    }
    
    let registration = swRegistration;
    
    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      console.log('[Push] Creating new push subscription...');
      
      if (!VAPID_PUBLIC_KEY) {
        throw new Error('VAPID public key not configured');
      }
      
      // Subscribe to push notifications
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      
      console.log('[Push] Push subscription created');
    } else {
      console.log('[Push] Using existing push subscription');
    }
    
    return subscription;
  } catch (error) {
    console.error('[Push] Error requesting push permission:', error);
    throw error;
  }
};

/**
 * Get current push subscription
 */
export const getPushSubscription = async () => {
  if (!isPushSupported()) return null;
  
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return null;
    
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('[Push] Error getting subscription:', error);
    return null;
  }
};

/**
 * Unsubscribe from push notifications
 */
export const unsubscribePush = async () => {
  try {
    const subscription = await getPushSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      console.log('[Push] Unsubscribed from push notifications');
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Push] Error unsubscribing:', error);
    throw error;
  }
};

/**
 * Check current notification permission
 */
export const getNotificationPermission = () => {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
};

/**
 * Helper function to convert VAPID key
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Debug helper - log push notification status
 */
export const debugPushStatus = async () => {
  console.log('=== Push Notification Debug ===');
  console.log('Push supported:', isPushSupported());
  console.log('Notification permission:', getNotificationPermission());
  console.log('Service worker registered:', await isServiceWorkerRegistered());
  
  const subscription = await getPushSubscription();
  console.log('Push subscription:', subscription ? 'Active' : 'None');
  if (subscription) {
    console.log('Endpoint:', subscription.endpoint);
  }
  console.log('VAPID key configured:', !!VAPID_PUBLIC_KEY);
  console.log('==============================');
};
