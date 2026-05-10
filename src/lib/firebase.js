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
  if (!messaging) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Register service worker
      const swUrl = `/firebase-messaging-sw.js?v=${Date.now()}&apiKey=${firebaseConfig.apiKey}&authDomain=${firebaseConfig.authDomain}&projectId=${firebaseConfig.projectId}&storageBucket=${firebaseConfig.storageBucket}&messagingSenderId=${firebaseConfig.messagingSenderId}&appId=${firebaseConfig.appId}`;
      await navigator.serviceWorker.register(swUrl);
      
      // WAIT for the service worker to be active
      const registration = await navigator.serviceWorker.ready;

      // Get the VAPID key from Firebase console -> Cloud Messaging -> Web configuration
      const currentToken = await getToken(messaging, { 
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration
      });

      if (currentToken) {
        // Save token to Supabase profiles (merge into preferences or a dedicated column)
        await saveTokenToDatabase(userId, currentToken);
        return true;
      }
    }
  } catch (error) {
    console.error('An error occurred while requesting permission. ', error);
  }
  return false;
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
