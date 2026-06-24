# Notification System Refactor - Executive Summary

## Your Requirements

1. ✅ **DO NOT remove Web Push system** - Keeping everything
2. ✅ **Refactor into two layers**:
   - **Foreground** (app open): Use Realtime subscriptions
   - **Background** (app closed): Use Service Worker + Web Push
3. ✅ **Remove 30-second polling** - Already done! No polling exists
4. ✅ **Replace with Supabase Realtime** - Already done in Header, adding to Notifications page
5. ✅ **Multi-device support** - New `push_subscriptions` table

---

## Current State Discovery

### Good News! 🎉
Your system is **better than expected**:

1. **No polling exists** - `Header.jsx` already uses Realtime subscriptions
2. **Service Worker is excellent** - Comprehensive diagnostic logging
3. **Push infrastructure is solid** - VAPID, proper error handling

### The Only Problem
- Single `profiles.push_subscription` field limits users to **one device**
- Users can't get notifications on phone AND laptop simultaneously

---

## What We're Changing

### Database Layer
```
BEFORE: profiles.push_subscription (JSONB) - one per user
AFTER:  push_subscriptions table - many per user
```

### Application Layers

#### Layer 1: Foreground Notifications (App Open)
| Component | Current State | Changes Needed |
|-----------|---------------|----------------|
| `Header.jsx` | ✅ Uses Realtime | **No changes** |
| `Notifications.jsx` | ❌ Loads once on mount | **Add Realtime subscription** |

#### Layer 2: Background Notifications (App Closed)
| Component | Current State | Changes Needed |
|-----------|---------------|----------------|
| `public/sw.js` | ✅ Perfect | **No changes** |
| `api/push.js` | ⚠️ Single device | **Query new table, send to all devices** |
| `src/lib/pushNotifications.js` | ⚠️ Single device | **Insert/update in new table** |

---

## Files That Will Change

### 🆕 New Files (1)
1. `supabase/migration_push_subscriptions.sql` - Create multi-device table

### ✏️ Modified Files (6)
1. `api/push.js` - Query multiple subscriptions, send to all devices
2. `src/lib/pushNotifications.js` - Use new table instead of profile field
3. `src/services/database.js` - Update notification helpers
4. `src/pages/Settings.jsx` - Show device list, manage subscriptions
5. `src/pages/Notifications.jsx` - Add Realtime subscription
6. `src/components/layout/GlobalAlarmListener.jsx` - Update auto-subscribe logic

### ⚠️ No Changes (3)
1. `public/sw.js` - Perfect, keep all diagnostic logging
2. `src/components/layout/Header.jsx` - Already uses Realtime correctly
3. Database `notifications` table - Schema is fine

### ❌ Files to Remove (0)
**Nothing!** All Web Push infrastructure stays.

---

## Migration Architecture

### Before (Current)
```
User
 └─ profiles.push_subscription (JSONB)
     └─ { endpoint, keys } ← ONE device only

Notification Flow:
1. Event occurs (task assigned)
2. Insert into notifications table
3. Header.jsx receives via Realtime ✅
4. database.js sends push to ONE device ❌
```

### After (Refactored)
```
User
 └─ push_subscriptions (Table)
     ├─ Device 1: { endpoint, keys, "Chrome on Windows" }
     ├─ Device 2: { endpoint, keys, "Firefox on Android" }
     └─ Device 3: { endpoint, keys, "Safari on iPhone" }

Notification Flow:
1. Event occurs (task assigned)
2. Insert into notifications table
3. Header.jsx receives via Realtime ✅ (no change)
4. Notifications.jsx receives via Realtime ✅ (NEW)
5. database.js queries push_subscriptions
6. api/push.js sends to ALL active devices ✅ (IMPROVED)
7. Service Worker shows notification ✅ (no change)
```

---

## Key Improvements

### Multi-Device Support ✨
```javascript
// BEFORE: User gets push on ONE device
await db.createNotification({ 
  user_id: studentId,
  title: 'New Task',
  message: 'Check your dashboard'
});
// → Sends to profiles.push_subscription (1 device)

// AFTER: User gets push on ALL devices
await db.createNotification({ 
  user_id: studentId,
  title: 'New Task',
  message: 'Check your dashboard'
});
// → Queries push_subscriptions WHERE user_id = studentId
// → Sends to EVERY active device (phone, laptop, tablet)
```

### Real-Time Notifications Page ✨
```javascript
// BEFORE: Notifications.jsx
useEffect(() => {
  loadNotifications(); // Loads once on mount
}, [user]);

// AFTER: Notifications.jsx
useEffect(() => {
  loadNotifications();
  
  // Listen for new notifications in real-time
  const channel = supabase
    .channel(`notifications-${user.id}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${user.id}`
    }, (payload) => {
      // Add new notification to list immediately
      setNotifications(prev => [payload.new, ...prev]);
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [user]);
```

### Device Management UI ✨
```javascript
// Settings.jsx - New section
<Card>
  <h3>Registered Devices</h3>
  {devices.map(device => (
    <div key={device.id}>
      <span>{device.device_name}</span>
      <span>Last used: {formatDate(device.last_used_at)}</span>
      <Button onClick={() => removeDevice(device.endpoint)}>
        Remove
      </Button>
    </div>
  ))}
</Card>
```

---

## No Breaking Changes

### For Users
- ✅ Existing push subscriptions will be migrated automatically
- ✅ No action required from users
- ✅ Secondary devices will need to re-enable push (one-time)

### For Developers
- ✅ Backward compatible during migration
- ✅ Keep old `profiles.push_subscription` for 1 month grace period
- ✅ Dual-write strategy ensures zero downtime

---

## What Gets Better

| Feature | Before | After |
|---------|--------|-------|
| Devices per user | 1 | Unlimited (soft limit: 10) |
| Foreground notifications | Realtime in Header only | Realtime in Header + Notifications page |
| Background notifications | Works on 1 device | Works on ALL devices |
| Device management | No UI | Full device list with remove option |
| Expired subscriptions | Breaks push for user | Auto-cleanup per device |
| Service Worker diagnostics | Excellent | **No changes** (keeping everything) |

---

## Testing Strategy

### Before Deployment
1. ✅ Create migration on staging
2. ✅ Test with 2+ devices per user
3. ✅ Verify Realtime updates in Notifications.jsx
4. ✅ Test background push with app closed
5. ✅ Test expired subscription cleanup

### After Deployment
1. ✅ Monitor for 1 week
2. ✅ Verify no errors in push delivery
3. ✅ Check device registration rates
4. ✅ Drop old `profiles.push_subscription` column after 30 days

---

## Timeline

- **Database Migration**: 2 hours
- **Backend Updates**: 4 hours
- **Frontend Updates**: 3 hours
- **Testing**: 3 hours
- **Total Development**: ~12 hours
- **Monitoring Period**: 1 week

---

## Next Steps

1. ✅ Review this plan
2. ⏳ Create `migration_push_subscriptions.sql`
3. ⏳ Update `api/push.js` for multi-device
4. ⏳ Update frontend components
5. ⏳ Test on staging
6. ⏳ Deploy to production
7. ⏳ Monitor and verify

---

## Questions?

**Q: Will this break existing push notifications?**
A: No - migration includes copying existing subscriptions to new table.

**Q: Do we need to remove the Service Worker?**
A: No - It's perfect! We're keeping all diagnostic logging.

**Q: Is there polling we need to remove?**
A: No - Header already uses Realtime! We're just adding it to Notifications.jsx.

**Q: How many devices can a user register?**
A: Soft limit of 10 devices (configurable).

**Q: What happens to expired subscriptions?**
A: Auto-marked as `is_active = false` instead of breaking push for user.

---

Ready to implement? See `NOTIFICATION_REFACTOR_PLAN.md` for detailed technical specs.
