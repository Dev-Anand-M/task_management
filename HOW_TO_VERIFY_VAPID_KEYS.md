# How to Verify VAPID Keys

## Option 1: Check Local Only (Quick)

```bash
node verify-vapid-keys.js
```

This checks your local `.env` file only.

## Option 2: Check Local + Vercel (Recommended)

### Step 1: Get Vercel Credentials

1. **Get Vercel Token:**
   - Go to: https://vercel.com/account/tokens
   - Click "Create Token"
   - Give it a name like "VAPID Checker"
   - Copy the token

2. **Get Project ID:**
   - Go to Vercel Dashboard
   - Select your project
   - Go to Settings → General
   - Copy the "Project ID"

### Step 2: Add to .env

Add these lines to your `.env` file:

```env
VERCEL_TOKEN=your_vercel_token_here
VERCEL_PROJECT_ID=your_project_id_here
```

### Step 3: Run the Script

```bash
node verify-vapid-keys.js --vercel
```

This will check BOTH your local `.env` AND Vercel environment variables!

## What the Script Does:

### ✅ Checks Local .env:
- Verifies all 4 VAPID keys are present
- Compares them to expected values
- Shows which keys match and which don't

### ✅ Checks Vercel (with --vercel flag):
- Fetches environment variables from Vercel API
- Verifies all 4 VAPID keys are set
- Checks if values match expected values
- Confirms they're set for Production environment

## Expected Output (Everything OK):

```
=== VAPID Key Verification ===

📋 Expected Keys:
  VITE_VAPID_PUBLIC_KEY: BDh_CLMgIPlfMDObBg2n...
  VAPID_PUBLIC_KEY: BDh_CLMgIPlfMDObBg2n...
  VAPID_PRIVATE_KEY: DLgvMH_99zrztgXzuY50...
  VAPID_SUBJECT: mailto:dev.klinux@proton.me

🔍 Checking Local .env:
  ✅ VITE_VAPID_PUBLIC_KEY: OK
  ✅ VAPID_PUBLIC_KEY: OK
  ✅ VAPID_PRIVATE_KEY: OK
  ✅ VAPID_SUBJECT: OK

✅ All local keys match!

🌐 Checking Vercel Environment Variables:
  ✅ VITE_VAPID_PUBLIC_KEY: OK (Production)
  ✅ VAPID_PUBLIC_KEY: OK (Production)
  ✅ VAPID_PRIVATE_KEY: OK (Production)
  ✅ VAPID_SUBJECT: OK (Production)

✅ All Vercel keys match and are set for Production!

🎉 Everything looks good! Your VAPID keys match everywhere.

Next steps:
  1. Make sure Vercel deployment is complete
  2. Go to Settings page
  3. Toggle push OFF → wait 2 sec → toggle ON
  4. Test push notification

=== End Verification ===
```

## If You See Errors:

### Error: "Cannot find module 'dotenv'"
```bash
npm install dotenv
```

### Error: "MISMATCH" in Local
Update your `.env` file with the correct values from `VAPID_KEY_FIX.md`

### Error: "MISMATCH" in Vercel
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Edit each mismatched variable
3. Copy the correct value from `VAPID_KEY_FIX.md`
4. Make sure it's set for "Production"
5. Redeploy your app

### Error: "NOT SET in Vercel"
The variable is missing from Vercel. Add it:
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Click "Add New"
3. Enter the key name and value
4. Select "Production" environment
5. Save and redeploy

## After Fixing:

1. Wait for Vercel deployment to complete
2. Go to your app's Settings page
3. Toggle push notifications OFF
4. Wait 2 seconds
5. Toggle push notifications ON
6. Click "Test Push Notification"
7. You should receive a notification! 🎉

## Security Note:

The `.env` file with `VERCEL_TOKEN` should NOT be committed to git. It's already in `.gitignore`, but double-check before pushing!
