# Push Subscription Sync Issue - Root Cause Analysis

## Evidence
```
Mobile Browser: https://fcm.googleapis.com/...
Database:       https://notify.windows.com/...
Match:          NO
```

---

## Code Path Analysis

### Path 1: Settings Toggle (Manual)
```
User toggles push in Settings
  ↓
Settings.jsx line 591-598
  ↓
push.subscribe() → returns FCM subscription
  ↓
supabase.from('profiles').update({ push_subscription: subscription })
  ↓
Database SHOULD be updated
```

**Status**: ✅ This path works correctly (when toggle is used)

---

### Path 2: Auto-Sync (GlobalAlarmListener)
```
App loads / User logs in
  ↓
GlobalAlarmListener.jsx line 201-223
  ↓
Checks: if (hasSubChanged)
  ↓
Compares user.push_subscription vs activeSub
  ↓
If different → updates database
```

**Status**: ⚠️ **THIS IS THE PROBLEM**

---

## The Bug

### Location: `GlobalAlarmListener.jsx` line 211-214

```javascript
const hasSubChanged = !user.push_subscription || 
    user.push_subscription.endpoint !== activeSub.endpoint ||
    JSON.stringify(user.push_subscription.keys) !== JSON.stringify(activeSub.keys);
```

### The Issue

**`user.push_subscription` is undefined/null on mobile!**

Here's why:

1. **AuthContext.jsx** line 39-41 fetches profile:
```javascript
let { data: userProfile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
```

2. The `select('*')` DOES include `push_subscription`

3. **BUT** the comparison in GlobalAlarmListener uses **`user.push_subscription`**

4. In AuthContext, **`user`** refers to the **profile object** returned

5. **The profile IS fetched correctly** with `push_subscription: { endpoint: "https://notify.windows.com/..." }`

6. **The comparison SEES the Windows subscription** and compares it with mobile FCM subscription

7. **They are different** (`notify.windows.com` !== `fcm.googleapis.com`)

8. **`hasSubChanged` evaluates to TRUE**

9. **The update SHOULD execute**:
```javascript
await routineService.supabase.from('profiles').update({
    push_subscription: activeSub
}).eq('id', user.id);
```

---

## Wait... So Why Isn't It Updating?

Let me check for errors being swallowed:

### GlobalAlarmListener.jsx line 223
```javascript
} catch (err) {
    console.warn('[Push] Auto-sync failed:', err);
}
```

**Error is caught and suppressed!**

---

## Possible Failure Points

### 1. RLS Policy Blocking Update
**Check**: Do RLS policies allow users to update their own `push_subscription`?

```sql
-- Need to verify this policy exists:
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
```

**Likely Issue**: RLS policy might not allow `push_subscription` field updates

### 2. `routineService.supabase` vs `supabase`
**Line 217**: Uses `routineService.supabase` instead of imported `supabase`

Check if `routineService.supabase` is:
- Properly initialized
- Using correct auth context
- Same instance as main supabase client

### 3. Silent Failure Due to Missing Await
**Line 217**: The update is awaited, so this is OK

### 4. User ID Mismatch
**Line 218**: Uses `user.id` - verify this matches authenticated user

---

## Diagnostic Steps

### Step 1: Check Console for Errors
On mobile, open DevTools console and look for:
```
[Push] Auto-sync failed: <error>
```

If you see this, the error message will tell us exactly what's failing.

### Step 2: Check RLS Policies
Run in Supabase SQL Editor:
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles';
```

Look for a policy that allows UPDATE on `profiles` table.

### Step 3: Add Explicit Logging
Temporarily modify `GlobalAlarmListener.jsx` line 217-220:

```javascript
console.log('[Push] Attempting update:', {
    userId: user.id,
    oldEndpoint: user.push_subscription?.endpoint,
    newEndpoint: activeSub.endpoint
});

const { data, error } = await routineService.supabase.from('profiles').update({
    push_subscription: activeSub
}).eq('id', user.id);

console.log('[Push] Update result:', { data, error });

if (error) {
    console.error('[Push] Update failed:', error);
}
```

### Step 4: Verify routineService
Check where `routineService` is imported and verify it's using the authenticated client.

---

## Most Likely Root Cause (85% confidence)

**RLS Policy Issue**

The `profiles` table likely has an RLS policy that allows users to update SOME fields but not ALL fields. The `push_subscription` field might be restricted.

**Evidence**:
1. Settings toggle works (might use service role or different policy)
2. Auto-sync silently fails (caught error)
3. Database shows old Windows subscription (never updated)

**Solution**:
```sql
-- Create or update policy to allow push_subscription updates
CREATE POLICY "Users can update own push subscription" ON profiles
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Or modify existing policy to include push_subscription
ALTER POLICY "Users can update own profile" ON profiles
  USING (auth.uid() = id);
```

---

## Alternative Root Cause (15% confidence)

**`routineService.supabase` Not Authenticated**

If `routineService` uses a different Supabase client that isn't authenticated, the update will fail with auth error.

**Solution**: Replace with main supabase client:
```javascript
await supabase.from('profiles').update({
    push_subscription: activeSub
}).eq('id', user.id);
```

---

## Action Plan

### Immediate Fix (Test First)

1. **Check mobile console** for `[Push] Auto-sync failed:` error
2. **Report the error message** - this will confirm which issue it is

### If RLS Error:
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Ensure users can update their own profiles
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

### If Auth Error:
Replace `routineService.supabase` with `supabase` in GlobalAlarmListener.jsx

### If Unknown Error:
Add the detailed logging from Step 3 and check exact error

---

## Why Windows Works But Mobile Doesn't

**Windows**: Registered first or last from Windows device → saved successfully
**Mobile**: 
- Registers FCM subscription in browser
- Tries to auto-sync to database
- **Fails silently** due to RLS or auth error
- Database keeps old Windows subscription
- Pushes sent to Windows endpoint
- Mobile never receives

---

## Fix Verification

After implementing fix:

1. Open mobile browser
2. Check console for successful update:
```
[Push] Update result: { data: {...}, error: null }
```

3. Query database:
```sql
SELECT push_subscription->>'endpoint' FROM profiles WHERE id = '<user_id>';
```

4. Should show FCM endpoint

5. Trigger a test notification

6. Mobile should receive (even with app closed)

---

## Next Step

**RUN THIS ON MOBILE CONSOLE RIGHT NOW:**

```javascript
(async () => {
  const push = await import('./lib/pushNotifications');
  const activeSub = await push.subscribe();
  console.log('Active subscription:', activeSub);
  
  const { data, error } = await supabase.from('profiles').update({
    push_subscription: activeSub
  }).eq('id', '<your-user-id>'); // Replace with actual user ID
  
  console.log('Update result:', { data, error });
  
  if (error) {
    console.error('ERROR DETAILS:', error);
  } else {
    console.log('SUCCESS! Database updated.');
  }
})();
```

**Replace `<your-user-id>` with your actual user ID.**

This will tell us EXACTLY what error is preventing the update.
