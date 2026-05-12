# OneSignal Push Notification Troubleshooting Guide

## Quick Diagnostic Test

**Visit this page to diagnose issues**: `/test-onesignal.html`

This diagnostic page will check:
- ✓ OneSignal SDK loading status
- ✓ Browser permissions
- ✓ Subscription ID
- ✓ Push notification API

## Current Issues
1. **Push notification toggle button not working**
2. **Mobile notifications not working (background/closed app)**

## Root Causes & Solutions

### Issue 1: OneSignal SDK Not Loading
**Status**: ⚠️ MOST COMMON ISSUE

The OneSignal SDK might be blocked by:
- Ad blockers (uBlock Origin, AdBlock Plus, etc.)
- Privacy extensions (Privacy Badger, Ghostery)
- Brave browser's built-in shields
- Corporate firewalls

**How to Test**:
1. Open browser console (F12)
2. Look for errors like:
   - `OneSignal SDK failed to load`
   - `Failed to load resource: net::ERR_BLOCKED_BY_CLIENT`
3. Check if `window.OneSignal` exists: Type `window.OneSignal` in console
4. **OR** Visit `/test-onesignal.html` for automated diagnostics

**How to Fix**:
- Temporarily disable ad blockers
- Whitelist your domain in ad blocker settings
- Test in incognito mode without extensions
- Try a different browser (Chrome, Firefox, Safari)

### Issue 2: Browser Permissions Denied
**Status**: ⚠️ User-dependent

Notifications require explicit browser permission.

**How to Test**:
1. Check permission status in console: `Notification.permission`
2. Should return: `"granted"`, `"denied"`, or `"default"`
3. **OR** Visit `/test-onesignal.html` for automated check

**How to Fix**:
- If `"denied"`: User must manually reset in browser settings
  - **Chrome**: Click lock icon in address bar → Site settings → Notifications → Allow
  - **Firefox**: Click lock icon → Permissions → Notifications → Allow
  - **Safari**: Safari → Settings → Websites → Notifications → Allow
- If `"default"`: Click the toggle in Settings to request permission

### Issue 3: Service Worker Not Registered
**Status**: ⚠️ Needs verification

OneSignal requires a service worker to handle background notifications.

**How to Test**:
1. Open DevTools → **Application** tab → **Service Workers**
2. Check if OneSignal service worker is registered
3. Look for: `OneSignalSDKWorker.js` or `OneSignalSDKUpdaterWorker.js`

**How to Fix**:
- OneSignal should auto-register its service worker
- If not registered, check browser console for errors
- Try unregistering all service workers and refreshing

### Issue 4: HTTPS Required

### Issue 4: HTTPS Required
**Status**: ✓ Should be OK on Vercel

Push notifications only work on HTTPS (or localhost for testing).

**How to Test**:
- Check if URL starts with `https://`
- Vercel automatically provides HTTPS

**How to Fix**:
- If testing locally, use `localhost` (not `127.0.0.1` or local IP)
- On production, ensure Vercel deployment uses HTTPS (default)

## Testing Checklist

### Step 1: Use Diagnostic Page
Visit `/test-onesignal.html` on your deployed site and run all tests.

### Step 2: Manual Console Tests (if needed)

**Test SDK Loading:**
```javascript
// In browser console:
console.log(window.OneSignal); // Should not be undefined
```

**Test Permission:**
```javascript
// In browser console:
console.log(Notification.permission); // Should be "granted"
```

**Test Subscription:**
```javascript
// In browser console (after SDK loads):
window.OneSignalDeferred.push(async (OneSignal) => {
  const id = await OneSignal.User.PushSubscription.id;
  console.log("OneSignal ID:", id); // Should show a subscription ID
});
```

**Test Push API:**
```javascript
// In browser console (replace with your OneSignal ID):
fetch('/api/push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    onesignal_id: 'YOUR_ONESIGNAL_ID_HERE',
    title: 'Test Notification',
    body: 'Testing OneSignal API',
    link: '/settings'
  })
}).then(r => r.json()).then(console.log);
```

## Expected Behavior After Fixes

### When Toggle is ON:
1. Browser shows native permission prompt
2. User clicks "Allow"
3. OneSignal SDK subscribes the device
4. Subscription ID is saved to Supabase `profiles.preferences.onesignal_id`
5. Toggle stays ON

### When Notification is Sent:
1. Server calls `/api/push` with `onesignal_id`
2. OneSignal API sends notification to device
3. **App Open**: Notification appears as in-app banner
4. **App Closed/Background**: Notification appears as OS system notification

### Mobile Behavior:
- **Android Chrome**: Works in background/closed
- **iOS Safari**: Requires app to be installed as PWA (Add to Home Screen)
- **iOS Chrome**: Same as iOS Safari (uses Safari engine)

## Common Errors and Solutions

### Error: "ONESIGNAL_API_KEY missing"
**Solution**: Add the environment variable in Vercel (see Issue 1)

### Error: "OneSignal SDK failed to load"
**Solution**: Disable ad blockers or test in incognito mode

### Error: "Registration failed - push service error"
**Solution**: 
- Check browser permissions
- Ensure HTTPS (required for push notifications)
- Try different browser

### Error: "No OneSignal ID found"
**Solution**: 
- Toggle push notifications OFF then ON again
- Check browser console for subscription errors

### Notifications only work when app is open
**Solution**:
- Verify `ONESIGNAL_API_KEY` is set in Vercel
- Check if service worker is registered
- On iOS: Install app as PWA (Add to Home Screen)

## Next Steps

1. **IMMEDIATE**: Add `ONESIGNAL_API_KEY` to Vercel environment variables
2. **TEST**: Try toggling push notifications after redeployment
3. **VERIFY**: Send test notification and check if it appears when app is closed
4. **MOBILE**: Test on actual mobile device (not just desktop browser)

## Additional Resources

- OneSignal Dashboard: https://dashboard.onesignal.com/
- OneSignal Web Push Docs: https://documentation.onesignal.com/docs/web-push-quickstart
- Vercel Environment Variables: https://vercel.com/docs/projects/environment-variables
