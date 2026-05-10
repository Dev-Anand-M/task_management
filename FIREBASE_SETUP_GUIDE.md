# 🔥 Firebase Setup Guide for Push Notifications

## Why Do I Need Firebase?

Firebase Cloud Messaging (FCM) is required for push notifications to work on mobile devices and when your app is closed. Without it, users will only see in-app notifications.

---

## Quick Setup (10 minutes)

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** (or use existing project)
3. Enter project name: `Zenith` (or your app name)
4. Disable Google Analytics (optional, not needed for notifications)
5. Click **"Create project"**

### Step 2: Add Web App to Firebase

1. In your Firebase project, click the **Web icon** `</>`
2. Register app:
   - App nickname: `Zenith Web`
   - ✅ Check "Also set up Firebase Hosting" (optional)
3. Click **"Register app"**
4. You'll see a config object like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

5. **Copy these values** - you'll need them in Step 4

### Step 3: Enable Cloud Messaging

1. In Firebase Console, click the **gear icon** ⚙️ → **Project Settings**
2. Go to **"Cloud Messaging"** tab
3. Scroll to **"Web Push certificates"** section
4. Click **"Generate key pair"**
5. **Copy the key** (starts with `BN...`) - this is your VAPID key

### Step 4: Update Your `.env` File

Open your `.env` file and fill in the Firebase values:

```env
# Supabase (already configured)
VITE_SUPABASE_URL=https://xnzmlzihqaqcwoiufegm.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Firebase Configuration (ADD THESE)
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
VITE_FIREBASE_VAPID_KEY=BNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 5: Get Service Account (For Server-Side)

This is needed for the `/api/push.js` endpoint to send notifications:

1. In Firebase Console → **Project Settings** → **Service accounts** tab
2. Click **"Generate new private key"**
3. Click **"Generate key"** (downloads a JSON file)
4. Open the JSON file and **copy the entire content**
5. Add to your `.env` file (all on one line):

```env
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"your-project",...}'
```

**Important:** For Vercel deployment, add this as an environment variable in your Vercel project settings.

### Step 6: Restart Your Dev Server

```bash
# Stop the server (Ctrl+C or Cmd+C)
# Then restart
npm run dev
```

### Step 7: Test Notifications

1. Go to Settings page in your app
2. You should now see "Push Notifications" toggle
3. Click to enable
4. Grant permission when prompted
5. You should see a test notification: "Zenith Notifications Enabled! 🎉"

---

## Vercel Deployment Setup

When deploying to Vercel, you need to add the environment variables:

1. Go to your Vercel project
2. Settings → Environment Variables
3. Add each variable:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_VAPID_KEY`
   - `FIREBASE_SERVICE_ACCOUNT` (the entire JSON as a string)
4. Redeploy your app

---

## Troubleshooting

### "Firebase is not configured"
- Check that all `VITE_FIREBASE_*` variables are set in `.env`
- Restart your dev server after adding variables
- Verify no typos in variable names

### "VAPID key is missing"
- Make sure you generated the Web Push certificate in Firebase Console
- Copy the entire key (starts with `BN...`)
- Add to `.env` as `VITE_FIREBASE_VAPID_KEY`

### "Could not get notification token"
- Check your internet connection
- Verify Firebase project is active in Firebase Console
- Check browser console for detailed error messages

### Push notifications not working on Vercel
- Verify all environment variables are set in Vercel
- Check that `FIREBASE_SERVICE_ACCOUNT` is set correctly
- Redeploy after adding variables

---

## Alternative: Disable Push Notifications

If you don't want to set up Firebase right now, the app will automatically hide the "Push Notifications" toggle when Firebase is not configured. Users will still receive:
- ✅ In-app notifications (when app is open)
- ✅ Database notifications
- ✅ Real-time updates

They just won't get:
- ❌ Notifications when app is closed
- ❌ Notifications on lock screen
- ❌ Mobile push notifications

---

## Cost & Limits

Firebase Cloud Messaging is **FREE** with generous limits:
- ✅ Unlimited messages
- ✅ No credit card required
- ✅ No monthly fees

The free tier (Spark Plan) is sufficient for most apps.

---

## Security Notes

- ✅ Never commit `.env` file to git (it's in `.gitignore`)
- ✅ Keep your service account JSON secure
- ✅ Use environment variables in Vercel for production
- ✅ VAPID key is public (safe to expose in client code)
- ❌ Service account JSON should NEVER be in client code

---

## Need Help?

1. Check the [Firebase Documentation](https://firebase.google.com/docs/cloud-messaging/js/client)
2. See `NOTIFICATION_TROUBLESHOOTING.md` for common issues
3. Use `/test-notification.html` to diagnose problems

---

**Status:** Ready to set up  
**Time Required:** ~10 minutes  
**Cost:** Free  
**Difficulty:** Easy
