# Endpoint Verification - Run This Now

## Step 1: Check Mobile Browser Subscription

**On your mobile device**, open the browser console and paste this:

```javascript
(async () => {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    
    console.log('=== MOBILE BROWSER SUBSCRIPTION ===');
    console.log('Endpoint:', sub?.endpoint || 'NO SUBSCRIPTION');
    
    if (sub) {
      // Copy this entire object
      console.log('Full subscription:', JSON.stringify(sub.toJSON(), null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  }
})();
```

**Copy the endpoint URL here:**
```
Mobile Endpoint: _______________________________________________
```

---

## Step 2: Check Database Subscription

**On Supabase SQL Editor**, run this query (replace `your-user-id` with your actual user ID):

```sql
SELECT 
  id,
  name,
  push_subscription->>'endpoint' as endpoint,
  push_subscription,
  updated_at
FROM profiles
WHERE id = 'your-user-id';
```

**OR use this JavaScript** in your browser console while logged in:

```javascript
(async () => {
  // Get your Supabase client (assumes you have access to supabase object)
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.error('Not logged in');
    return;
  }
  
  const { data, error } = await supabase
    .from('profiles')
    .select('push_subscription')
    .eq('id', user.id)
    .single();
  
  console.log('=== DATABASE SUBSCRIPTION ===');
  console.log('Endpoint:', data?.push_subscription?.endpoint || 'NO SUBSCRIPTION');
  console.log('Full subscription:', JSON.stringify(data?.push_subscription, null, 2));
})();
```

**Copy the endpoint URL here:**
```
Database Endpoint: _______________________________________________
```

---

## Step 3: Compare

**Paste both endpoints below and I will analyze:**

```
Mobile Browser Endpoint: 
Database Endpoint: 
```

---

## What This Tells Us

### If Endpoints DON'T Match:
- **Root Cause**: Single-subscription architecture
- **Why Mobile Fails**: Pushes are sent to Windows endpoint (in database), not mobile endpoint (in browser)
- **Solution**: Implement multi-device push_subscriptions table
- **Confidence**: 99%

### If Endpoints DO Match:
- **Root Cause**: NOT architecture (something else)
- **Why Mobile Fails**: Android-specific delivery issue, battery optimization, or Service Worker problem
- **Solution**: Investigate Android restrictions, NOT multi-device table
- **Confidence**: 99%

---

## Quick Alternative (If Console Access is Difficult)

**From Settings page** in your app:
1. Go to Settings → Notifications section
2. Look for the "Test Push" button
3. Before clicking, open browser DevTools
4. Click Test Push
5. In Network tab, find the request to `/api/push`
6. Check the request payload - it will show the subscription endpoint

---

**Paste the two endpoints above and I'll give you the final answer.**
