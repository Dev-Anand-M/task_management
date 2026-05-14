-- Clear all push subscriptions to force recreation with new VAPID keys
-- Run this in Supabase SQL Editor

UPDATE profiles 
SET push_subscription = NULL,
    preferences = jsonb_set(
        COALESCE(preferences, '{}'::jsonb),
        '{notifications,push}',
        'false'::jsonb
    )
WHERE push_subscription IS NOT NULL;

-- Verify the update
SELECT id, email, push_subscription, preferences->'notifications'->'push' as push_enabled
FROM profiles
WHERE id IN (SELECT id FROM profiles LIMIT 10);
