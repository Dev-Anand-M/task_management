# Simplified Notification System (Based on LN-Reader)

## Current Problem
We're overcomplicating notifications with OneSignal SDK, which:
- Gets blocked by ad-blockers
- Has complex initialization
- Requires external service
- Adds unnecessary complexity

## LN-Reader's Simple Approach

### What They Do:
1. **Simple Service Worker** (`sw.js`)
   - Handles push events directly
   - No external SDK needed
   - Works with native browser Push API

2. **Native Push API**
   - Uses `navigator.serviceWorker.register()`
   - Uses `registration.showNotification()`
   - No OneSignal, no Firebase, just browser APIs

3. **Clean Implementation**
   - Service worker registered in one place
   - Push notifications handled in service worker
   - Notification clicks handled in service worker

### Their Code (Simplified):
```javascript
// Register service worker
navigator.serviceWorker.register('/sw.js')

// In service worker:
self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon.png',
      data: { url: data.url }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

## Proposed Simplification

### Step 1: Remove OneSignal
- Remove OneSignal SDK from `index.html`
- Remove `src/lib/onesignal.js`
- Remove OneSignal initialization code

### Step 2: Create Simple Service Worker
- Create `public/sw.js` with push notification handlers
- Register it in main app
- Handle push events natively

### Step 3: Use Native Push API
- Request permission using `Notification.requestPermission()`
- Get push subscription using `registration.pushManager.subscribe()`
- Store subscription in Supabase
- Send notifications using Web Push protocol

### Step 4: Backend Push Sending
- Use `web-push` library (Node.js)
- Send notifications directly to browser
- No third-party service needed

## Benefits

1. **No Ad-Blocker Issues** - Native browser API can't be blocked
2. **Simpler Code** - No SDK, no complex initialization
3. **More Reliable** - Direct browser communication
4. **Free** - No external service costs
5. **Better Control** - Full control over notification flow

## Implementation Plan

### Files to Create:
1. `public/sw.js` - Service worker with push handlers
2. `src/lib/push.js` - Native push API wrapper
3. `api/web-push.js` - Backend push sender using web-push library

### Files to Modify:
1. `index.html` - Remove OneSignal, add SW registration
2. `src/pages/Settings.jsx` - Use native push API
3. `package.json` - Add `web-push` dependency

### Files to Delete:
1. `src/lib/onesignal.js`
2. All OneSignal-related documentation

## Next Steps

1. First, run the database migration to fix notification types
2. Then, implement simplified push notification system
3. Test on mobile devices
4. Remove all OneSignal code

## Comparison

| Feature | OneSignal (Current) | Native Push (Proposed) |
|---------|-------------------|----------------------|
| Ad-blocker issues | ❌ Yes | ✅ No |
| External dependency | ❌ Yes | ✅ No |
| Complexity | ❌ High | ✅ Low |
| Reliability | ⚠️ Medium | ✅ High |
| Cost | ⚠️ Free tier limits | ✅ Completely free |
| Control | ⚠️ Limited | ✅ Full control |

## Decision

Should we:
A. **Fix current OneSignal implementation** (run migration, debug SDK loading)
B. **Switch to native Push API** (like LN-Reader, simpler and more reliable)

Your choice?
