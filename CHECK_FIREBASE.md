# 🔍 Firebase Configuration Check

## Quick Diagnostic

Run this in your browser console (F12) to check Firebase status:

```javascript
// Check if Firebase is configured
console.log('Firebase Config Check:');
console.log('API Key:', import.meta.env.VITE_FIREBASE_API_KEY ? '✅ Set' : '❌ Missing');
console.log('Auth Domain:', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? '✅ Set' : '❌ Missing');
console.log('Project ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing');
console.log('VAPID Key:', import.meta.env.VITE_FIREBASE_VAPID_KEY ? '✅ Set' : '❌ Missing');

// Check notification permission
console.log('Notification Permission:', Notification.permission);

// Check service worker
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Service Workers:', regs.length);
  regs.forEach(reg => {
    console.log('- State:', reg.active?.state);
    console.log('- URL:', reg.active?.scriptURL);
  });
});
```

## Why Mobile Notifications Only Work When App is Open

This happens when:

### 1. Firebase Not Configured ❌
**Symptom:** Notifications only show as in-app toasts
**Solution:** Set up Firebase (see `FIREBASE_SETUP_GUIDE.md`)

### 2. Service Worker Not Registered ❌
**Symptom:** No background notifications
**Check:**
```javascript
navigator.serviceWorker.controller
// Should return: ServiceWorker object
// If null: Service worker not controlling page
```

### 3. VAPID Key Missing ❌
**Symptom:** Can't get FCM token
**Check:** `.env` file has `VITE_FIREBASE_VAPID_KEY`

### 4. Push Notifications Not Enabled ❌
**Symptom:** No FCM token saved
**Solution:** Go to Settings → Enable "Push Notifications"

## Current Behavior

### ✅ What Works (Without Firebase):
- In-app notifications when app is open
- Notification bell updates
- Database notifications

### ❌ What Doesn't Work (Without Firebase):
- Notifications when app is closed
- Notifications when phone is locked
- OS-level push notifications
- Background notifications

## Quick Fix Options

### Option 1: Set Up Firebase (Recommended)
Follow `FIREBASE_SETUP_GUIDE.md` - takes 10 minutes

### Option 2: Disable Push Notifications
The app already hides the push notification toggle when Firebase isn't configured.
Users will only get in-app notifications.

## Testing Background Notifications

Once Firebase is configured:

1. **Enable notifications** in Settings
2. **Close the app** completely
3. **Lock your phone**
4. **Have someone send you a notification**
5. **Wait 5-10 seconds**
6. **Check lock screen** - notification should appear

## Common Issues

### "Firebase is not configured"
- Check `.env` file has all `VITE_FIREBASE_*` variables
- Restart dev server after adding variables

### "Service worker not found"
- Check `public/firebase-messaging-sw.js` exists
- Check browser console for 404 errors

### "No FCM token"
- Check VAPID key is correct
- Check internet connection
- Check Firebase project is active

### "Notifications work on desktop but not mobile"
- Check mobile browser is Chrome/Firefox/Safari
- Check mobile OS supports notifications (iOS 16.4+, Android 5+)
- Check battery optimization isn't blocking Chrome

---

**Next Steps:**
1. Run the diagnostic script above
2. Check which variables are missing
3. Follow `FIREBASE_SETUP_GUIDE.md` to set them up
4. Test again

**Status:** Firebase configuration required for background notifications
