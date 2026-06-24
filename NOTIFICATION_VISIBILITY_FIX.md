# Notification Visibility Investigation

## Current Status

### What's Working ✅
- Push delivery: FCM → Chrome → Service Worker
- Service Worker `push` event fires correctly
- `showNotification()` executes without errors
- Notification permission is granted
- Mobile subscription is in database

### What's NOT Working ❌
- Notifications don't appear visibly to user when app is closed
- Notifications only appear when user opens app (delayed/queued)

---

## Change Made

### Service Worker Enhancement (`public/sw.js`)

**Changed**:
```javascript
requireInteraction: false // Old
requireInteraction: true  // New - Forces notification to stay visible
```

**Added Logging**:
- Log notification options before calling `showNotification()`
- Check `getNotifications()` after showing
- Log count and details of active notifications
- Warning if notification disappeared

---

## Testing Instructions

### After Deploy:

1. **Clear SW cache**:
```javascript
navigator.serviceWorker.getRegistrations().then(regs => 
  Promise.all(regs.map(r => r.unregister()))
).then(() => location.reload());
```

2. **Register fresh**:
   - Open app
   - Allow notifications
   - Check console for `[Push Sync] ✅ UPDATE SUCCESS`

3. **Close app completely** (not just minimize)

4. **Trigger notification** from admin/another device

5. **Check if notification appears** on closed app

6. **Check SW logs**:
```javascript
fetch('/sw-diagnostic-report').then(r => r.json()).then(logs => {
  const recent = logs.slice(-10);
  console.table(recent);
});
```

---

## Expected Behavior After Fix

### If `requireInteraction: true` Fixes It:
- Notifications appear immediately when app closed
- They stay visible until dismissed
- Confirms Android was auto-dismissing notifications

### If Still Doesn't Appear:
Check SW logs for:
```
Active notifications after show: 0
WARNING: showNotification succeeded but notification not found
```

This would indicate:
- Android silently blocking notifications
- Chrome notification channel disabled
- Some other system-level restriction

---

## Alternative Test: Minimal Notification

If issue persists, test with absolute minimum options:

**In Settings → Test Push**, modify to send:
```javascript
{
  subscription: currentSub,
  title: 'TEST',
  body: 'Minimal notification test',
  url: '/'
}
```

Then in SW, handle with minimal options:
```javascript
await self.registration.showNotification('TEST', {
  body: 'Minimal test'
});
```

If minimal works but full doesn't → problematic option in notification config

---

## Hypothesis

**Most Likely**: `requireInteraction: false` allowed Android to auto-dismiss
**Second**: `renotify: true` with same tag causing replacement issues
**Third**: Icon/image loading failure silently blocking notification
**Fourth**: Android Chrome notification channel permissions

---

## Next Steps

1. Deploy and test
2. Check SW logs for notification count
3. Report: Does notification appear now?
4. If no, paste SW diagnostic logs showing the attempt
