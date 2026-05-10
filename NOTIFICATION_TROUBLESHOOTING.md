# 🔧 Notification Troubleshooting Guide

## Common Error Messages & Solutions

### "Could not enable push notifications. Check browser permissions."

This generic error can have several causes. Check the browser console (F12) for detailed error messages.

---

## Detailed Error Messages

### 1. "Firebase is not configured"
**Cause:** Missing Firebase environment variables

**Solution:**
1. Check your `.env` file has all Firebase variables:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_FIREBASE_VAPID_KEY=...
   ```
2. Restart your dev server after adding variables
3. For Vercel deployment, add these in Environment Variables

---

### 2. "Notifications are not supported in your browser"
**Cause:** Browser doesn't support Notification API

**Solution:**
- Use Chrome 50+, Firefox 44+, Safari 16+, or Edge 79+
- Update your browser to the latest version
- On iOS, use Safari (Chrome on iOS doesn't support notifications)

---

### 3. "Service Workers are not supported"
**Cause:** Browser doesn't support Service Workers

**Solution:**
- Update your browser
- Ensure you're using HTTPS (required for service workers)
- Service workers don't work on `file://` protocol

---

### 4. "Notifications are blocked"
**Cause:** User previously denied notification permission

**Solution:**
1. **Chrome Desktop:**
   - Click the lock icon in address bar
   - Find "Notifications"
   - Change to "Allow"
   - Reload the page

2. **Chrome Mobile:**
   - Open Chrome Settings
   - Go to Site Settings → Notifications
   - Find your site
   - Change to "Allow"

3. **Firefox:**
   - Click the lock icon
   - Click "More Information"
   - Go to Permissions tab
   - Find Notifications
   - Change to "Allow"

---

### 5. "Notification permission was not granted"
**Cause:** User clicked "Block" or dismissed the permission prompt

**Solution:**
- Try again and click "Allow" when prompted
- If blocked, follow steps in #4 above

---

### 6. "Firebase VAPID key is missing"
**Cause:** `VITE_FIREBASE_VAPID_KEY` not set in environment

**Solution:**
1. Go to Firebase Console
2. Project Settings → Cloud Messaging
3. Under "Web configuration" → "Web Push certificates"
4. Copy the "Key pair" value
5. Add to `.env`:
   ```
   VITE_FIREBASE_VAPID_KEY=YOUR_KEY_HERE
   ```
6. Restart dev server

---

### 7. "Could not get notification token"
**Cause:** FCM token generation failed

**Possible Solutions:**
1. **Check internet connection** - FCM needs to connect to Google servers
2. **Check Firebase project is active** - Verify in Firebase Console
3. **Check service worker is registered:**
   ```javascript
   // In browser console
   navigator.serviceWorker.getRegistrations().then(console.log);
   ```
4. **Clear browser cache and try again**
5. **Check Firebase project has Cloud Messaging enabled**

---

### 8. "Configuration error"
**Cause:** VAPID key mismatch or Firebase config error

**Solution:**
1. Verify all Firebase config values are correct
2. Ensure VAPID key matches your Firebase project
3. Check for typos in environment variables
4. Regenerate VAPID key in Firebase Console if needed

---

## Step-by-Step Debugging

### Step 1: Check Browser Console
1. Open browser console (F12)
2. Try enabling notifications
3. Look for `[Firebase]` log messages
4. Note any error messages

### Step 2: Check Environment Variables
```javascript
// Run in browser console
console.log({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ? '✅ Set' : '❌ Missing',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? '✅ Set' : '❌ Missing',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing',
  vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY ? '✅ Set' : '❌ Missing'
});
```

### Step 3: Check Notification Permission
```javascript
// Run in browser console
console.log('Permission:', Notification.permission);
// Should be: "granted", "denied", or "default"
```

### Step 4: Check Service Worker
```javascript
// Run in browser console
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Registered SWs:', regs.length);
  regs.forEach(reg => {
    console.log('State:', reg.active?.state);
    console.log('URL:', reg.active?.scriptURL);
  });
});
```

### Step 5: Test Notification Manually
```javascript
// Run in browser console (after granting permission)
navigator.serviceWorker.ready.then(reg => {
  reg.showNotification('Test', {
    body: 'If you see this, notifications work!',
    icon: '/zenith.png'
  });
});
```

---

## Quick Fixes

### Fix 1: Reset Everything
```javascript
// Run in browser console
// 1. Unregister all service workers
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.unregister());
});

// 2. Clear storage
localStorage.clear();
sessionStorage.clear();

// 3. Reload page
location.reload();
```

### Fix 2: Force Permission Reset (Chrome)
1. Go to `chrome://settings/content/notifications`
2. Find your site in the list
3. Click the three dots → Remove
4. Reload your site
5. Try enabling notifications again

### Fix 3: Check HTTPS
- Notifications require HTTPS (except localhost)
- Verify your site URL starts with `https://`
- Check for mixed content warnings

### Fix 4: Disable Browser Extensions
- Some ad blockers block notifications
- Try in Incognito/Private mode
- Disable extensions one by one to find the culprit

---

## Platform-Specific Issues

### iOS Safari
- ✅ Supported in iOS 16.4+
- ❌ Chrome/Firefox on iOS don't support notifications (use Safari)
- Requires "Add to Home Screen" for full PWA experience
- Check Settings → Safari → Notifications

### Android Chrome
- Check battery optimization settings
- Some manufacturers (Samsung, Xiaomi) have aggressive battery savers
- Add Chrome to "Protected apps" list
- Ensure "Background data" is enabled for Chrome

### Desktop Chrome
- Check system notification settings (Windows/Mac)
- Ensure "Focus Assist" (Windows) or "Do Not Disturb" (Mac) allows notifications
- Check Chrome notification settings: `chrome://settings/content/notifications`

---

## Still Not Working?

### Use the Diagnostic Tool
1. Open `/test-notification.html` in your browser
2. Click through each test
3. Check the activity log for errors
4. Share the log output for support

### Check Firebase Console
1. Go to Firebase Console → Cloud Messaging
2. Check if your project has Cloud Messaging enabled
3. Verify VAPID key is generated
4. Check usage quotas

### Verify Deployment
1. Ensure all environment variables are set in Vercel
2. Check build logs for errors
3. Verify `firebase-messaging-sw.js` is accessible at `/firebase-messaging-sw.js`
4. Check service worker is being served with correct MIME type

---

## Getting Help

When asking for help, provide:
1. **Browser & Version:** Chrome 120, Safari 17, etc.
2. **Platform:** Windows 11, macOS 14, Android 13, iOS 17
3. **Error Message:** Exact error from console
4. **Console Logs:** All `[Firebase]` log messages
5. **Permission State:** Result of `Notification.permission`
6. **Service Worker State:** Result of service worker check

---

**Last Updated:** 2026-05-10  
**Version:** 1.0.7
