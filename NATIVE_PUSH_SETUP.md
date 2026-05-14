# Native Push Notifications Setup (LN-Reader Style)

## Overview

We've switched from OneSignal to **native browser Push API** for a simpler, more reliable notification system.

### Benefits:
- ✅ No ad-blocker issues
- ✅ No external SDK dependencies
- ✅ Completely free
- ✅ More reliable
- ✅ Full control
- ✅ Works offline

## Step 1: Run Database Migration

Run this SQL in Supabase Dashboard → SQL Editor:

```sql
-- Fix notification types and RLS policies
ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('success', 'info', 'warning', 'error', 'award', 'task', 'quiz', 'announcement', 'submission', 'quiz_result'));

-- Fix RLS - Allow admins to insert notifications
DROP POLICY IF EXISTS "Admins can insert notifications" ON notifications;

CREATE POLICY "Admins can insert notifications" ON notifications
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Add push subscription column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS push_subscription JSONB;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON notifications(user_id, is_read, created_at DESC);
```

## Step 2: Generate VAPID Keys

VAPID keys are needed for web push. Generate them once:

```bash
npx web-push generate-vapid-keys
```

You'll get output like:
```
=======================================
Public Key:
BEl62iUYgUivxIkv69yViEuiBIa-Ib27SDbQjfTbSAiJ...

Private Key:
p6YgZzmBlN7cUiWXRqYKwKZJ8YqVqKqKqKqKqKqKqKq...
=======================================
```

## Step 3: Add Environment Variables

### Local Development (.env):
```env
VITE_VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa-Ib27SDbQjfTbSAiJ...
VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa-Ib27SDbQjfTbSAiJ...
VAPID_PRIVATE_KEY=p6YgZzmBlN7cUiWXRqYKwKZJ8YqVqKqKqKqKqKqKqKq...
VAPID_SUBJECT=mailto:your-email@example.com
```

### Vercel (Production):
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add these variables:
   - `VITE_VAPID_PUBLIC_KEY` = [Your public key]
   - `VAPID_PUBLIC_KEY` = [Your public key]
   - `VAPID_PRIVATE_KEY` = [Your private key]
   - `VAPID_SUBJECT` = `mailto:your-email@example.com`
3. Select all environments (Production, Preview, Development)
4. Click Save
5. Redeploy your app

## Step 4: Update Code to Use Native Push

### Remove OneSignal References

Delete or comment out OneSignal code in:
- `index.html` - Remove OneSignal SDK scripts
- Any imports from `src/lib/onesignal.js`

### Update Settings Page

Replace OneSignal functions with native push:

```javascript
// Old (OneSignal):
import { requestOneSignalPermission } from '../lib/onesignal';

// New (Native):
import { requestPushPermission, unsubscribePush } from '../lib/nativePush';
```

## Step 5: Update Notification Sending

### In TaskManager, QuizBuilder, ClassroomDetail, etc.:

```javascript
// Old (OneSignal):
const onesignalId = member?.preferences?.onesignal_id;
if (onesignalId) {
  await fetch('/api/push', {
    method: 'POST',
    body: JSON.stringify({
      onesignal_id: onesignalId,
      title: 'Task Assigned',
      body: 'New task for you'
    })
  });
}

// New (Native):
const pushSubscription = member?.push_subscription;
if (pushSubscription) {
  await fetch('/api/native-push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: pushSubscription,
      title: 'Task Assigned',
      body: 'New task for you',
      url: '/tasks'
    })
  });
}
```

## Step 6: Test

### Test Locally:
1. Start dev server: `npm run dev`
2. Open browser console (F12)
3. Go to Settings page
4. Toggle "Push Notifications" ON
5. Click "Allow" on browser prompt
6. Check console for success messages
7. Send a test notification

### Test on Mobile:
1. Deploy to Vercel
2. Open site on mobile browser
3. Enable push notifications
4. Close the app completely
5. Have someone assign you a task
6. Notification should appear even when app is closed

## Files Created:

- ✅ `public/sw.js` - Service worker with push handlers
- ✅ `src/lib/nativePush.js` - Native push API wrapper
- ✅ `api/native-push.js` - Backend push sender
- ✅ `supabase/migration_fix_notifications_complete.sql` - Database fixes
- ✅ `.gitignore` - Excludes LN-Reader folder

## Files to Update:

- `index.html` - Remove OneSignal, register service worker
- `src/pages/Settings.jsx` - Use native push functions
- `src/pages/admin/TaskManager.jsx` - Use native push API
- `src/pages/admin/QuizBuilder.jsx` - Use native push API
- `src/pages/admin/ClassroomDetail.jsx` - Use native push API
- `src/pages/admin/EvaluationCenter.jsx` - Use native push API

## Debugging

### Check Service Worker:
1. Open DevTools → Application → Service Workers
2. Should see `/sw.js` registered

### Check Push Subscription:
```javascript
// In browser console:
import { debugPushStatus } from './src/lib/nativePush.js';
debugPushStatus();
```

### Check Notification Permission:
```javascript
// In browser console:
console.log(Notification.permission); // Should be "granted"
```

### Test Push Notification:
```javascript
// In browser console (after enabling push):
const subscription = await navigator.serviceWorker.ready
  .then(reg => reg.pushManager.getSubscription());

await fetch('/api/native-push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    subscription: subscription,
    title: 'Test Notification',
    body: 'If you see this, native push is working!',
    url: '/settings'
  })
});
```

## Troubleshooting

### "VAPID keys not configured"
- Make sure you added all environment variables in Vercel
- Redeploy after adding variables

### "Service worker registration failed"
- Check browser console for errors
- Make sure `/sw.js` file exists in `public/` folder
- Try clearing browser cache

### "Notification permission denied"
- User must click "Allow" on browser prompt
- If denied, user must reset in browser settings:
  - Chrome: Click lock icon → Site settings → Notifications → Allow
  - Firefox: Click lock icon → Permissions → Notifications → Allow

### Notifications only work when app is open
- Check if service worker is registered
- Check if push subscription exists
- On iOS: Must install as PWA (Add to Home Screen)

### "Push subscription expired"
- Subscription can expire after ~90 days
- User needs to toggle push OFF then ON again
- Backend should handle 410 errors and remove expired subscriptions

## Next Steps

1. Run database migration
2. Generate VAPID keys
3. Add environment variables to Vercel
4. Update code to use native push
5. Test locally
6. Deploy and test on mobile

## Comparison: OneSignal vs Native

| Feature | OneSignal | Native Push |
|---------|-----------|-------------|
| Ad-blocker issues | ❌ Yes | ✅ No |
| External dependency | ❌ Yes | ✅ No |
| Setup complexity | ❌ High | ✅ Low |
| Reliability | ⚠️ Medium | ✅ High |
| Cost | ⚠️ Free tier limits | ✅ Free forever |
| Control | ⚠️ Limited | ✅ Full |
| Works offline | ⚠️ Sometimes | ✅ Yes |
