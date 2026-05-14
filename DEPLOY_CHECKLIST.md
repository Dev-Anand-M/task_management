# Native Push Notifications - Deploy Checklist

## ✅ Step 1: Database Migration (REQUIRED)

Go to Supabase Dashboard → SQL Editor and run this:

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

**Status**: [ ] Done

---

## ✅ Step 2: Add Environment Variables to Vercel (REQUIRED)

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add these 4 variables:

1. **VITE_VAPID_PUBLIC_KEY**
   ```
   BDh_CLMgIPlfMDObBg2nesGZQ4ObJjfN0rUrPh9-W9iV3RojHkPsmEx6FsV0x_9XqsMU5It-zvGlNTnNxpBzgc0
   ```

2. **VAPID_PUBLIC_KEY**
   ```
   BDh_CLMgIPlfMDObBg2nesGZQ4ObJjfN0rUrPh9-W9iV3RojHkPsmEx6FsV0x_9XqsMU5It-zvGlNTnNxpBzgc0
   ```

3. **VAPID_PRIVATE_KEY**
   ```
   DLgvMH_99zrztgXzuY50i6gVHXZGTUBqAVwxpHLV8Gg
   ```

4. **VAPID_SUBJECT**
   ```
   mailto:admin@zenith.app
   ```

**Important**: Select all environments (Production, Preview, Development)

**Status**: [ ] Done

---

## ✅ Step 3: Deploy to Vercel (REQUIRED)

After adding environment variables, redeploy:

```bash
git add .
git commit -m "Add native push notifications"
git push
```

Or manually trigger redeploy in Vercel Dashboard.

**Status**: [ ] Done

---

## ✅ Step 4: Test Notifications (REQUIRED)

### Test In-App Notifications:
1. [ ] Login as admin
2. [ ] Assign a task to a member
3. [ ] Check if member receives in-app notification (bell icon)
4. [ ] Click notification - should navigate to task

### Test Push Notifications:
1. [ ] Login as member
2. [ ] Go to Settings
3. [ ] Toggle "Push Notifications" ON
4. [ ] Click "Allow" on browser prompt
5. [ ] Check browser console for success message
6. [ ] Have admin assign you a task
7. [ ] Check if push notification appears

### Test Background Notifications:
1. [ ] Enable push notifications
2. [ ] Close the app completely
3. [ ] Have admin assign you a task
4. [ ] Check if notification appears even when app is closed

**Status**: [ ] Done

---

## Optional: Remove OneSignal (After Testing)

Once native push is working, you can remove OneSignal:

### Files to Update:
- [ ] `index.html` - Remove OneSignal SDK scripts
- [ ] `src/pages/Settings.jsx` - Remove OneSignal imports
- [ ] `src/pages/admin/TaskManager.jsx` - Use native push API
- [ ] `src/pages/admin/QuizBuilder.jsx` - Use native push API
- [ ] `src/pages/admin/ClassroomDetail.jsx` - Use native push API
- [ ] `src/pages/admin/EvaluationCenter.jsx` - Use native push API

### Files to Delete:
- [ ] `src/lib/onesignal.js`
- [ ] `ONESIGNAL_*.md` documentation files

**Status**: [ ] Not started (do after testing)

---

## Troubleshooting

### Issue: "VAPID keys not configured"
**Solution**: Make sure you added all 4 environment variables in Vercel and redeployed

### Issue: "Service worker registration failed"
**Solution**: Check if `public/sw.js` exists and browser console for errors

### Issue: "Notification permission denied"
**Solution**: User must click "Allow" on browser prompt. If denied, reset in browser settings.

### Issue: Notifications only work when app is open
**Solution**: 
- Check if service worker is registered (DevTools → Application → Service Workers)
- On iOS: Must install as PWA (Add to Home Screen)

---

## Current Status

- [x] VAPID keys generated
- [x] VAPID keys added to `.env`
- [x] Service worker created (`public/sw.js`)
- [x] Native push API wrapper created (`src/lib/nativePush.js`)
- [x] Backend API created (`api/native-push.js`)
- [x] Database migration prepared
- [x] LN-Reader excluded from git
- [ ] Database migration run in Supabase
- [ ] Environment variables added to Vercel
- [ ] Deployed to Vercel
- [ ] Tested in-app notifications
- [ ] Tested push notifications
- [ ] Tested background notifications

---

## Quick Links

- **Setup Guide**: `NATIVE_PUSH_SETUP.md`
- **Summary**: `SWITCH_TO_NATIVE_PUSH_SUMMARY.md`
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Vercel Dashboard**: https://vercel.com/dashboard

---

## Notes

- Native push works on all modern browsers (Chrome, Firefox, Edge, Safari)
- iOS requires PWA installation for background notifications
- Android works without PWA installation
- Push subscriptions can expire after ~90 days (user needs to re-enable)
- No external service costs - completely free!
