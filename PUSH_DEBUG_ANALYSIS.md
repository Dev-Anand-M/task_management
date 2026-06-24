# Push Notification Root Cause Analysis

## PHASE 1: ROOT CAUSE VALIDATION

### Verified Facts
✅ Laptop receives background push when browser closed
✅ Mobile receives push when app is OPEN
❌ Mobile does NOT receive push when app is CLOSED
✅ Current `profiles.push_subscription` stores `notify.windows.com` endpoint
✅ Service Worker registers successfully on mobile
✅ VAPID keys are valid
✅ Only one subscription stored at a time (last device wins)

---

## Hypotheses to Test

### Hypothesis A: Single-Subscription Architecture Issue
**Theory**: When mobile registers, it overwrites the Windows subscription. When Windows registers, it overwrites mobile. Only the last device to register gets notifications.

**Evidence For**:
- ✅ Database stores only ONE `push_subscription` per user
- ✅ Current stored endpoint is `notify.windows.com` (Windows device)
- ✅ Mobile likely registered first, then Windows overwrote it

**Evidence Against**:
- ⚠️ This should cause Windows to also fail background push (but it works)

**Test Design**:
```javascript
// Test A1: Check what's currently in the database
// Query: SELECT push_subscription FROM profiles WHERE id = <user_id>
// Expected: Should show notify.windows.com endpoint

// Test A2: Register mobile device, check database immediately
// 1. Open mobile app
// 2. Enable push notifications
// 3. Query database
// Expected: Endpoint should change to FCM or mobile endpoint

// Test A3: After mobile registration, test Windows background push
// 1. Close Windows browser
// 2. Trigger a notification
// Expected: Windows should NOT receive (mobile stole subscription)

// Test A4: Send push directly to mobile endpoint
// Use the Test Push button on mobile after registration
// Expected: Should work if endpoint is valid
```

**Validation Criteria**:
- If Test A3 shows Windows stops receiving after mobile registers → **CONFIRMED**
- If Test A4 shows mobile can receive test push → Architecture is NOT the issue

---

### Hypothesis B: Mobile Subscription Registration Failure
**Theory**: Mobile browser fails to create a valid push subscription due to PWA configuration, permissions, or service worker issues.

**Evidence For**:
- ❌ Mobile doesn't receive background push

**Evidence Against**:
- ✅ Mobile receives push when app is OPEN (means registration worked)

**Test Design**:
```javascript
// Test B1: Check mobile registration status
// On mobile, run in console:
navigator.serviceWorker.ready.then(reg => 
  reg.pushManager.getSubscription()
).then(sub => console.log('Mobile subscription:', sub))

// Expected: Should return valid subscription object with endpoint

// Test B2: Verify subscription is saved to database
// After mobile registration, check:
const { data } = await supabase
  .from('profiles')
  .select('push_subscription')
  .eq('id', user.id)
  .single();
console.log('Database subscription:', data.push_subscription);

// Expected: Should match mobile subscription from Test B1

// Test B3: Check for permission issues
console.log('Notification permission:', Notification.permission);
console.log('Service Worker state:', navigator.serviceWorker.controller?.state);

// Expected: 'granted' and 'activated'
```

**Validation Criteria**:
- If mobile subscription exists and matches database → Registration works
- If Test B1 returns null → Registration is failing
- If Test B1 succeeds but B2 shows different endpoint → Race condition or overwrite

---

### Hypothesis C: Android Chrome/PWA Delivery Issue
**Theory**: Android Chrome or PWA restrictions prevent background push delivery even when subscription is valid.

**Known Android Issues**:
1. **Battery Optimization**: Doze mode can block push delivery
2. **App Standby Buckets**: Apps in "rare" bucket get delayed/dropped pushes
3. **PWA vs Browser Tab**: Standalone PWA may have different behavior
4. **FCM Requirement**: Some Android versions require FCM for reliable delivery

**Evidence For**:
- ❌ Mobile background push fails consistently
- ⚠️ Using Web Push API directly (not FCM)

**Evidence Against**:
- ✅ Mobile receives push when app is OPEN (means delivery works)

**Test Design**:
```javascript
// Test C1: Check Android battery optimization settings
// Manual check on mobile:
// Settings → Apps → Chrome/Zenith → Battery → Unrestricted

// Test C2: Test with high-priority urgency flag
// Already set in api/push.js:
const PUSH_OPTIONS = {
  TTL: 86400,
  urgency: 'high',
};
// Verify this is being sent

// Test C3: Test with screen ON vs screen OFF
// 1. Keep mobile screen on, close app
// 2. Trigger notification
// 3. Repeat with screen off
// Expected: Both should work if not battery optimization

// Test C4: Check Service Worker diagnostic logs
// On mobile, navigate to: /sw-diagnostic-report
// Check for push event logs
// Expected: Should see "Service Worker Push Event Fired" entries
```

**Validation Criteria**:
- If Test C4 shows no push events logged → Push not reaching Service Worker
- If Test C4 shows push events but no notification → Service Worker issue
- If Test C3 works with screen ON but not OFF → Battery optimization

---

### Hypothesis D: Service Worker Execution Issue on Mobile
**Theory**: Service Worker is registered but not properly handling push events on mobile (different from desktop).

**Evidence For**:
- ❌ Background push fails on mobile
- ⚠️ Mobile browsers have stricter SW lifecycle rules

**Evidence Against**:
- ✅ SW registers successfully
- ✅ Foreground notifications work

**Test Design**:
```javascript
// Test D1: Verify SW is active when push arrives
// On mobile console:
navigator.serviceWorker.getRegistrations().then(regs => 
  console.log('Registrations:', regs.map(r => ({
    scope: r.scope,
    active: r.active?.state,
    waiting: r.waiting?.state
  })))
);

// Expected: One registration, active state = 'activated'

// Test D2: Check SW diagnostic cache
fetch('/sw-diagnostic-report')
  .then(r => r.json())
  .then(logs => console.log('SW Logs:', logs));

// Expected: Should show push events if SW is executing

// Test D3: Test mock push (bypasses server, directly to SW)
navigator.serviceWorker.ready.then(reg => {
  if (reg.active) {
    reg.active.postMessage({
      type: 'TEST_MOCK_PUSH',
      payload: {
        title: 'Mobile Test',
        body: 'Testing SW execution',
        url: '/'
      }
    });
  }
});

// Expected: Should show notification immediately

// Test D4: Compare SW cache state between devices
// Check if SW files are cached correctly on mobile
caches.keys().then(names => console.log('Cache names:', names));
caches.open('zenith-v2').then(cache => 
  cache.keys().then(keys => console.log('Cached files:', keys))
);
```

**Validation Criteria**:
- If Test D3 works → SW can show notifications, issue is with push delivery
- If Test D3 fails → SW execution problem on mobile
- If Test D2 shows no logs → SW not executing during push events

---

### Hypothesis E: Endpoint Routing Issue
**Theory**: Push server sends to wrong endpoint because database stores Windows endpoint, not mobile endpoint.

**Evidence For**:
- ✅ Database shows `notify.windows.com` endpoint
- ✅ Only one subscription stored (last device wins)
- ✅ Windows background push works (because it's the stored endpoint)

**Evidence Against**:
- ⚠️ This is essentially Hypothesis A

**Test Design**:
```javascript
// Test E1: Direct endpoint test
// Get mobile subscription endpoint
const sub = await (await navigator.serviceWorker.ready)
  .pushManager.getSubscription();
console.log('Mobile endpoint:', sub.endpoint);

// Manually send push to this endpoint via Settings Test Push
// Expected: Should receive notification

// Test E2: Database endpoint verification
const { data } = await supabase
  .from('profiles')
  .select('push_subscription')
  .eq('id', user.id)
  .single();
console.log('Database endpoint:', data.push_subscription.endpoint);
console.log('Match:', sub.endpoint === data.push_subscription.endpoint);

// Expected: Should match for notifications to work

// Test E3: Timestamp check
console.log('Subscription created:', sub);
console.log('Database updated_at:', data.updated_at);
// Check if mobile registration actually saved to database
```

**Validation Criteria**:
- If E2 shows mismatch → Architecture issue (single subscription overwrite)
- If E2 shows match but mobile still doesn't receive → Different issue
- If E1 direct test works but E2 shows different endpoint → Confirms architecture problem

---

## Recommended Testing Sequence

### Step 1: Verify Current State (5 minutes)
```sql
-- Run on Supabase SQL Editor
SELECT 
  id,
  name,
  push_subscription->>'endpoint' as endpoint,
  push_subscription->>'expirationTime' as expiration,
  updated_at
FROM profiles
WHERE id = '<your_user_id>';
```

**Expected Result**: Should show Windows endpoint (`notify.windows.com`)

### Step 2: Mobile Endpoint Check (2 minutes)
```javascript
// On mobile browser, run in console:
(async () => {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  console.log('=== MOBILE SUBSCRIPTION ===');
  console.log('Endpoint:', sub?.endpoint);
  console.log('Full subscription:', sub?.toJSON());
  
  // Compare with database
  const { data } = await supabase.from('profiles')
    .select('push_subscription')
    .eq('id', '<user_id>')
    .single();
  console.log('=== DATABASE SUBSCRIPTION ===');
  console.log('Endpoint:', data.push_subscription?.endpoint);
  console.log('Match:', sub?.endpoint === data.push_subscription?.endpoint);
})();
```

**Decision Tree**:
- **If endpoints match**: Architecture is NOT the issue → Test Hypothesis C or D
- **If endpoints DON'T match**: Architecture IS the issue → Single subscription problem confirmed

### Step 3: Test Push Delivery Path (5 minutes)
```javascript
// On mobile, use Settings → Test Push button
// This sends directly to the subscription in the database
// 
// THEN manually trigger via server (test both):

// Test 3A: Server push to database endpoint
fetch('/api/push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer <token>' },
  body: JSON.stringify({
    user_ids: ['<user_id>'],
    title: 'Server Test',
    body: 'Testing push delivery',
    url: '/'
  })
});

// Test 3B: Direct push to mobile subscription
fetch('/api/push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer <token>' },
  body: JSON.stringify({
    subscription: { /* paste mobile subscription object here */ },
    title: 'Direct Mobile Test',
    body: 'Testing direct endpoint',
    url: '/'
  })
});
```

**Decision Tree**:
- **If 3A fails but 3B works**: Confirms architecture issue (wrong endpoint in DB)
- **If both fail**: Hypothesis C or D (Android/SW issue)
- **If both work**: Issue is with automatic push flow, not manual tests

### Step 4: Service Worker Diagnostic Check (3 minutes)
```javascript
// On mobile browser:
fetch('/sw-diagnostic-report')
  .then(r => r.json())
  .then(logs => {
    console.log('=== SERVICE WORKER LOGS ===');
    console.table(logs);
    
    // Look for:
    // - "Service Worker Push Event Fired"
    // - "showNotification executed successfully"
    // - Any errors
  });
```

**Decision Tree**:
- **If push events logged**: SW is executing, issue is with notification display
- **If no push events**: Push not reaching SW (network/subscription issue)
- **If errors in logs**: SW has runtime errors on mobile

---

## Critical Questions to Answer

### Question 1: Single Subscription Overwrite?
**Test**: Step 2 above
**Expected Answer**: YES - Mobile endpoint doesn't match database endpoint

### Question 2: Can Mobile Receive Push at All?
**Test**: Step 3B (direct push to mobile endpoint)
**Expected Answer**: Need to verify - if YES, architecture is the only problem

### Question 3: Is SW Executing on Mobile?
**Test**: Step 4 (diagnostic logs)
**Expected Answer**: Need to verify - should see push events in logs

### Question 4: Android-Specific Blocking?
**Test**: Battery optimization settings + screen on/off tests
**Expected Answer**: Possible, but should see logs regardless

---

## Predicted Root Cause (to be validated)

**Primary Hypothesis**: **Architecture Issue (Hypothesis A/E combined)**

**Evidence**:
1. Only one subscription stored in database
2. Database shows Windows endpoint
3. Windows receives background push (it's the active subscription)
4. Mobile registered but was overwritten by Windows
5. System sends push to Windows endpoint, not mobile endpoint

**Validation Required**:
- Confirm mobile endpoint differs from database endpoint
- Confirm direct push to mobile endpoint works
- Confirm SW diagnostic logs show no push events on mobile

**If Validated**: Multi-device architecture is the correct solution

**If Not Validated**: Need to investigate:
- Android push delivery restrictions
- Service Worker lifecycle issues on mobile
- FCM requirement for Android reliability

---

## Next Steps

### Before Implementing Migration:

1. **Run Step 1-4 tests above** (15 minutes total)
2. **Document actual results** in this file
3. **Determine if architecture change solves the problem**
4. **If YES**: Proceed with migration plan
5. **If NO**: Investigate Android-specific issues or SW problems

### Alternative Solutions if Architecture is NOT the Issue:

**Option A: FCM Integration**
- Use Firebase Cloud Messaging for Android
- More reliable on Android than direct Web Push
- Requires additional setup

**Option B: Foreground Service Worker**
- Keep app in "foreground" state on mobile
- May prevent Android from killing SW
- Not recommended, battery intensive

**Option C: Push Delivery Optimization**
- Increase urgency to 'very-high'
- Add requireInteraction: true
- Request battery optimization exemption

---

## Test Results (To Be Filled)

### Test Date: _______________
### Tester: _______________

#### Step 1 Results:
```
Database endpoint: _______________
Last updated: _______________
```

#### Step 2 Results:
```
Mobile endpoint: _______________
Database endpoint: _______________
Match: YES / NO
```

#### Step 3A Results:
```
Server push to database endpoint: SUCCESS / FAIL
Received on mobile: YES / NO
```

#### Step 3B Results:
```
Direct push to mobile endpoint: SUCCESS / FAIL
Received on mobile: YES / NO
```

#### Step 4 Results:
```
Push events logged: YES / NO
Notification shown successfully: YES / NO
Errors found: _______________
```

#### Conclusion:
```
Root cause identified: _______________
Architecture change needed: YES / NO
Additional investigation required: _______________
```

---

## Implementation Decision

**DO NOT PROCEED WITH MIGRATION UNTIL**:
- [ ] All tests above are completed
- [ ] Root cause is confirmed
- [ ] Architecture change is proven to fix the issue
- [ ] Alternative solutions are evaluated

**PROCEED WITH MIGRATION IF**:
- [x] Step 2 shows endpoint mismatch
- [x] Step 3B shows direct mobile push works
- [x] Step 4 shows no push events (because wrong endpoint)
- [x] Conclusion: Single subscription architecture is the root cause
