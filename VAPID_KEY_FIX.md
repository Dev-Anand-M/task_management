# VAPID Key Mismatch Fix

## Problem
Getting **401 Unauthorized - "VAPID authentication failed"** error when testing push notifications.

## Root Cause
The VAPID keys in Vercel environment variables don't match the keys used to create the push subscription in the browser.

## Your VAPID Keys (from .env)
```
VITE_VAPID_PUBLIC_KEY=BDh_CLMgIPlfMDObBg2nesGZQ4ObJjfN0rUrPh9-W9iV3RojHkPsmEx6FsV0x_9XqsMU5It-zvGlNTnNxpBzgc0
VAPID_PUBLIC_KEY=BDh_CLMgIPlfMDObBg2nesGZQ4ObJjfN0rUrPh9-W9iV3RojHkPsmEx6FsV0x_9XqsMU5It-zvGlNTnNxpBzgc0
VAPID_PRIVATE_KEY=DLgvMH_99zrztgXzuY50i6gVHXZGTUBqAVwxpHLV8Gg
VAPID_SUBJECT=mailto:dev.klinux@proton.me
```

## Fix Steps

### 1. Verify Vercel Environment Variables
Go to your Vercel project → Settings → Environment Variables

Make sure these **EXACT** values are set (no extra spaces, no truncation):

| Variable Name | Value |
|--------------|-------|
| `VITE_VAPID_PUBLIC_KEY` | `BDh_CLMgIPlfMDObBg2nesGZQ4ObJjfN0rUrPh9-W9iV3RojHkPsmEx6FsV0x_9XqsMU5It-zvGlNTnNxpBzgc0` |
| `VAPID_PUBLIC_KEY` | `BDh_CLMgIPlfMDObBg2nesGZQ4ObJjfN0rUrPh9-W9iV3RojHkPsmEx6FsV0x_9XqsMU5It-zvGlNTnNxpBzgc0` |
| `VAPID_PRIVATE_KEY` | `DLgvMH_99zrztgXzuY50i6gVHXZGTUBqAVwxpHLV8Gg` |
| `VAPID_SUBJECT` | `mailto:dev.klinux@proton.me` |

**IMPORTANT**: 
- Copy-paste directly from your `.env` file
- Check for NO extra spaces at the beginning or end
- Vercel sometimes truncates display but stores full value - verify by editing each variable
- Make sure you're setting them for **Production** environment

### 2. Redeploy
After updating the environment variables in Vercel:
```bash
git commit --allow-empty -m "Trigger redeploy for VAPID key fix"
git push
```

Or use Vercel dashboard → Deployments → Redeploy

### 3. Clear Browser Subscription
After the new deployment is live:

1. Go to Settings page
2. Toggle push notifications **OFF**
3. Wait 2 seconds
4. Toggle push notifications **ON**
5. This creates a fresh subscription with the correct keys

### 4. Test
Click the "Test Push Notification" button - it should work now!

## Why This Happens
- Browser creates push subscription using `VITE_VAPID_PUBLIC_KEY` (frontend)
- Backend sends notifications using `VAPID_PRIVATE_KEY` (API)
- If keys don't match, Windows Notification Service rejects with 401
- The subscription is tied to the public key, so you need to recreate it after fixing keys

## Verification
After fixing, you should see:
```
[TestPush] Sending to subscription: https://wns2-par02p.notify.windows.com/...
POST /api/native-push 200 (OK)
[TestPush] Response: {success: true, message: 'Push notification sent'}
```

And you'll receive a Windows notification!
