import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { supabase } from "./supabase";

// Your web app's Firebase configuration
// You will need to add these to your .env file
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app;
let messaging;

try {
  // Initialize Firebase
  app = initializeApp(firebaseConfig);
  messaging = getMessaging(app);
} catch (error) {
  console.warn("Firebase not initialized. Make sure you have the environment variables set up.");
}

export const requestNotificationPermission = async (userId) => {
  if (!messaging) {
    console.error('[Firebase] Messaging not initialized. Check environment variables.');
    alert('Firebase is not configured. Please contact the administrator.');
    return false;
  }

  try {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.error('[Firebase] Notifications not supported in this browser');
      alert('Notifications are not supported in your browser. Please use Chrome, Firefox, or Safari.');
      return false;
    }

    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
      console.error('[Firebase] Service Workers not supported');
      alert('Service Workers are not supported in your browser. Please update your browser.');
      return false;
    }

    // Check current permission state
    const currentPermission = Notification.permission;
    console.log('[Firebase] Current notification permission:', currentPermission);
    
    if (currentPermission === 'denied') {
      console.warn('[Firebase] Notification permission denied by user');
      alert('Notifications are blocked. Please enable them in your browser settings:\n\n1. Click the lock icon in the address bar\n2. Find "Notifications"\n3. Change to "Allow"');
      return false;
    }

    // Request permission if not already granted
    console.log('[Firebase] Requesting notification permission...');
    const permission = await Notification.requestPermission();
    console.log('[Firebase] Permission result:', permission);
    
    if (permission !== 'granted') {
      console.warn('[Firebase] Notification permission not granted:', permission);
      alert('Notification permission was not granted. Please try again and click "Allow" when prompted.');
      return false;
    }

    // Register or re-use existing service worker
    console.log('[Firebase] Registering service worker...');
    const swUrl = `/firebase-messaging-sw.js?apiKey=${firebaseConfig.apiKey}&authDomain=${firebaseConfig.authDomain}&projectId=${firebaseConfig.projectId}&storageBucket=${firebaseConfig.storageBucket}&messagingSenderId=${firebaseConfig.messagingSenderId}&appId=${firebaseConfig.appId}`;
    
    let registration;
    const existingRegistrations = await navigator.serviceWorker.getRegistrations();
    const existingSW = existingRegistrations.find(r => r.active?.scriptURL.includes('firebase-messaging-sw.js'));
    
    if (existingSW) {
      console.log('[Firebase] Reusing existing service worker');
      registration = existingSW;
      // Update the SW in the background (don't wait)
      existingSW.update().catch(() => {});
    } else {
      registration = await navigator.serviceWorker.register(swUrl, {
        scope: '/'
      });
      console.log('[Firebase] New service worker registered');
    }
    
    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;
    console.log('[Firebase] Service worker ready');

    // Check if VAPID key is configured
    if (!import.meta.env.VITE_FIREBASE_VAPID_KEY) {
      console.error('[Firebase] VAPID key not configured');
      alert('Firebase VAPID key is missing. Please contact the administrator.');
      return false;
    }

    // Get the VAPID key from Firebase console -> Cloud Messaging -> Web configuration
    console.log('[Firebase] Getting FCM token...');
    const currentToken = await getToken(messaging, { 
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    if (currentToken) {
      console.log('[Firebase] FCM token obtained:', currentToken.substring(0, 20) + '...');
      // Save token to Supabase profiles (merge into preferences or a dedicated column)
      await saveTokenToDatabase(userId, currentToken);
      
      console.log('[Firebase] ✅ Notifications enabled successfully');
      return true;
    } else {
      console.warn('[Firebase] No FCM token received');
      alert('Could not get notification token. Please try again.');
      return false;
    }
  } catch (error) {
    console.error('[Firebase] Error requesting permission:', error);
    console.error('[Firebase] Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    // Provide user-friendly error messages
    let errorMessage = 'Could not enable notifications. ';
    
    if (error.code === 'messaging/permission-blocked') {
      errorMessage += 'Notifications are blocked. Please enable them in your browser settings.';
    } else if (error.code === 'messaging/token-subscribe-failed') {
      errorMessage += 'Failed to subscribe to notifications. Please check your internet connection.';
    } else if (error.code === 'messaging/unsupported-browser') {
      errorMessage += 'Your browser does not support notifications.';
    } else if (error.message.includes('VAPID')) {
      errorMessage += 'Configuration error. Please contact the administrator.';
    } else {
      errorMessage += `Error: ${error.message}`;
    }
    
    alert(errorMessage);
    return false;
  }
};

const saveTokenToDatabase = async (userId, token) => {
  try {
    // We fetch current preferences, then update the fcm_token
    const { data: profile } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('id', userId)
      .single();

    // De-duplicate and save
    const currentTokens = profile?.preferences?.fcm_tokens || [];
    if (!currentTokens.includes(token)) {
      const updatedTokens = [...currentTokens, token];
      await supabase.from('profiles').update({
        preferences: { ...profile?.preferences, fcm_tokens: updatedTokens, fcm_token: token }
      }).eq('id', userId);
    }
  } catch (error) {
    console.error("Failed to save FCM token:", error);
  }
};

export const clearTokenFromDatabase = async (userId) => {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('id', userId)
      .single();

    if (profile?.preferences?.fcm_token) {
      const prefs = profile.preferences;
      delete prefs.fcm_token;

      await supabase
        .from('profiles')
        .update({ preferences: prefs })
        .eq('id', userId);
    }
  } catch (error) {
    console.error("Failed to clear FCM token:", error);
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    if (!messaging) return;
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
