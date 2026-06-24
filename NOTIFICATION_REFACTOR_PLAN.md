# Notification System Refactoring Plan

## Current Architecture Analysis

### What We Have Now
1. **Foreground (App Open)**:
   - Header.jsx uses Realtime subscriptions on `notifications` table ✅ (GOOD)
   - Notifications.jsx loads data on mount only (no polling, no realtime)
   
2. **Background (App Closed)**:
   - Service Worker (`public/sw.js`) handles push events ✅ (KEEP)
   - Web Push API with VAPID keys ✅ (KEEP)
   - `api/push.js` serverless endpoint ✅ (KEEP)
   - **PROBLEM**: Single `profiles.push_subscription` field (one device per user)

3. **Storage**:
   - `profiles.push_subscription` (JSONB) - stores ONE subscription per user ❌
   - `notifications` table - stores in-app notifications ✅

### Issues Identified
1. ❌ **Single device limitation**: `profiles.push_subscription` can only store one subscription
2. ❌ **No polling removal needed**: Actually, there is NO 30-second polling! Header already uses Realtime ✅
3. ⚠️ **Notifications.jsx doesn't use Realtime**: Only loads on mount

---

## Migration Strategy

### Phase 1: Database Schema Changes

#### Create `push_subscriptions` Table
```sql
-- New table for multi-device push subscriptions
CREATE TABLE push_subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  endpoint TEXT NOT NULL UNIQUE, -- Extracted for fast lookups
  device_name TEXT, -- Optional: "Chrome on Windows", "Firefox on Android"
  user_agent TEXT, -- For analytics
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);
CREATE INDEX idx_push_subscriptions_active ON push_subscriptions(user_id, is_active);
```

#### Enable RLS
```sql
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscriptions
CREATE POLICY "Users can view own push subscriptions" 
ON push_subscriptions FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own subscriptions
CREATE POLICY "Users can insert own push subscriptions" 
ON push_subscriptions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own subscriptions
CREATE POLICY "Users can update own push subscriptions" 
ON push_subscriptions FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own subscriptions
CREATE POLICY "Users can delete own push subscriptions" 
ON push_subscriptions FOR DELETE 
USING (auth.uid() = user_id);

-- Service role can read all (for push.js API)
CREATE POLICY "Service can read all push subscriptions" 
ON push_subscriptions FOR SELECT 
TO service_role USING (true);
```

### Phase 2: Code Changes

#### A. Update `api/push.js`
**CHANGES**:
- Query `push_subscriptions` table instead of `profiles.push_subscription`
- Send to ALL active subscriptions for each user
- Auto-cleanup: set `is_active = false` instead of deleting row (for analytics)

#### B. Update `src/lib/pushNotifications.js`
**CHANGES**:
- `subscribe()`: Insert into `push_subscriptions` table
- `unsubscribe()`: Mark as `is_active = false` in database
- Add `getActiveSubscriptions()`: Fetch user's active subscriptions
- Add `removeSubscription(endpoint)`: Remove specific device

#### C. Update `src/services/database.js`
**CHANGES**:
- Remove all references to `profiles.push_subscription`
- `createNotification()`: Query `push_subscriptions` for user's devices
- `notifyClassroom()`: Fetch all subscriptions for classroom students
- `notifyAdmins()`: Fetch all subscriptions for classroom admins

#### D. Update `src/pages/Notifications.jsx`
**ENHANCEMENT**:
- Add Realtime subscription like Header does
- Listen for INSERT events on `notifications` table
- Auto-update list when new notifications arrive

#### E. Update `src/pages/Settings.jsx`
**CHANGES**:
- Show list of registered devices (from `push_subscriptions`)
- Allow removing individual devices
- Update toggle to use new table
- Show device count correctly

#### F. Update `src/components/layout/GlobalAlarmListener.jsx`
**CHANGES**:
- Update auto-subscription logic to use new table
- Check if subscription already exists by endpoint before inserting

---

## Files to Modify

### 1. Database Migration Files
- ✅ **CREATE**: `supabase/migration_push_subscriptions.sql`

### 2. API Routes
- ✏️ **MODIFY**: `api/push.js` (major refactor for multi-device support)

### 3. Client Libraries
- ✏️ **MODIFY**: `src/lib/pushNotifications.js` (add table integration)

### 4. Services
- ✏️ **MODIFY**: `src/services/database.js` (remove `push_subscription` field references)

### 5. UI Components
- ✏️ **MODIFY**: `src/pages/Settings.jsx` (device management UI)
- ✏️ **MODIFY**: `src/pages/Notifications.jsx` (add Realtime subscription)
- ✏️ **MODIFY**: `src/components/layout/GlobalAlarmListener.jsx` (update auto-subscribe)
- ⚠️ **NO CHANGE**: `src/components/layout/Header.jsx` (already uses Realtime correctly)

### 6. Service Worker
- ⚠️ **NO CHANGE**: `public/sw.js` (perfect as-is, keep all diagnostic logging)

---

## Files to Keep (DO NOT TOUCH)

### Keep As-Is
1. ✅ `public/sw.js` - Service Worker (background notifications)
2. ✅ `src/components/layout/Header.jsx` - Already uses Realtime properly
3. ✅ Database notifications table schema - No changes needed

---

## Files to Remove

### Can Be Deleted
❌ None - All push notification infrastructure is essential

---

## Migration Checklist

### Pre-Migration
- [ ] Backup production database
- [ ] Document current `profiles.push_subscription` data for migration
- [ ] Test migration on staging environment

### Database Migration
- [ ] Run migration SQL to create `push_subscriptions` table
- [ ] Data migration: Copy existing `profiles.push_subscription` to new table
- [ ] Verify RLS policies work correctly
- [ ] Test queries with service role

### Code Updates
- [ ] Update `api/push.js` for multi-device support
- [ ] Update `src/lib/pushNotifications.js` for new table
- [ ] Update `src/services/database.js` to remove old field references
- [ ] Add Realtime to `Notifications.jsx`
- [ ] Update Settings device management UI
- [ ] Update `GlobalAlarmListener.jsx` auto-subscribe logic

### Testing
- [ ] Test push notifications on multiple devices/browsers per user
- [ ] Verify expired subscription cleanup works
- [ ] Test Realtime updates in Notifications.jsx
- [ ] Verify Settings shows all devices correctly
- [ ] Test unsubscribe from individual devices
- [ ] Test background notifications with app closed

### Cleanup (Post-Migration)
- [ ] Monitor for 1 week to ensure stability
- [ ] Drop `profiles.push_subscription` column (after confirming migration success)
- [ ] Update documentation

---

## Data Migration Query

```sql
-- Migrate existing push_subscription data to new table
INSERT INTO push_subscriptions (user_id, subscription, endpoint, device_name, created_at)
SELECT 
  id as user_id,
  push_subscription as subscription,
  push_subscription->>'endpoint' as endpoint,
  'Migrated Device' as device_name,
  NOW() as created_at
FROM profiles
WHERE push_subscription IS NOT NULL 
  AND push_subscription->>'endpoint' IS NOT NULL
ON CONFLICT (endpoint) DO NOTHING;

-- Verify migration
SELECT 
  (SELECT COUNT(*) FROM profiles WHERE push_subscription IS NOT NULL) as old_count,
  (SELECT COUNT(*) FROM push_subscriptions) as new_count;
```

---

## Rollback Plan

If issues occur:
1. Keep `profiles.push_subscription` column until stable
2. Dual-write strategy: Write to both old and new during transition
3. Read from new table, fallback to old if empty
4. Can revert code changes without data loss

---

## Performance Considerations

### Query Optimization
- Indexed lookups on `user_id` and `endpoint`
- Batch queries for classroom notifications
- Connection pooling for push delivery

### Storage
- Old table: 1 row per user in `profiles` (stored as JSONB field)
- New table: N rows per user in dedicated table
- Estimate: ~3KB per subscription × 5 devices/user × 1000 users = ~15MB
- ✅ Minimal impact, acceptable growth

---

## Breaking Changes

### For Users
- ✅ **None** - Seamless upgrade
- ✅ Existing subscriptions will be migrated automatically
- ✅ Users may need to re-enable push on secondary devices

### For Developers
- ⚠️ API contract changes in `database.js` for push notification functions
- ⚠️ `profiles.push_subscription` field will be deprecated (keep for 1 month grace period)

---

## Timeline Estimate

- **Phase 1** (Database): 2 hours
  - Write migration SQL
  - Test on staging
  - Run migration
  
- **Phase 2** (Backend): 4 hours
  - Update `api/push.js`
  - Update `database.js`
  - Update `pushNotifications.js`
  
- **Phase 3** (Frontend): 3 hours
  - Update Settings UI
  - Add Realtime to Notifications
  - Update GlobalAlarmListener
  
- **Testing & QA**: 3 hours
- **Total**: ~12 hours of development + 1 week monitoring

---

## Success Criteria

✅ Users can receive push notifications on multiple devices simultaneously
✅ Expired subscriptions are auto-cleaned without affecting other devices
✅ Settings page shows all registered devices
✅ Notifications.jsx updates in real-time when app is open
✅ Background push works when app is closed
✅ No breaking changes for existing users
✅ Service Worker diagnostic logging remains intact

---

## Questions to Answer Before Implementation

1. **Device naming**: Auto-detect from user agent or let users name devices?
   - **Recommendation**: Auto-detect with option to rename
   
2. **Subscription expiry**: How long before marking inactive subscriptions as expired?
   - **Recommendation**: 90 days of no successful delivery
   
3. **Max devices per user**: Limit to prevent abuse?
   - **Recommendation**: 10 devices per user (soft limit)
   
4. **Migration timing**: Deploy during low-traffic hours?
   - **Recommendation**: Yes, schedule for off-peak
