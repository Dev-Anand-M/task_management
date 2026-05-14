-- Complete Notification System Fix
-- This migration fixes notification types and RLS policies

-- 1. Fix notification type constraint
ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('success', 'info', 'warning', 'error', 'award', 'task', 'quiz', 'announcement', 'submission', 'quiz_result'));

-- 2. Fix RLS policies - Allow admins to insert notifications for any user
DROP POLICY IF EXISTS "Admins can insert notifications" ON notifications;

CREATE POLICY "Admins can insert notifications" ON notifications
  FOR INSERT WITH CHECK (
    -- Admin can insert notifications for anyone
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. Add comment explaining the types
COMMENT ON COLUMN notifications.type IS 
'Notification types:
- success: General success message
- info: Informational message  
- warning: Warning message
- error: Error message
- award: Achievement/award notification
- task: Task assignment or update
- quiz: Quiz assignment or update
- announcement: Classroom announcement
- submission: Task submission evaluation
- quiz_result: Quiz evaluation result';

-- 4. Add index for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON notifications(user_id, is_read, created_at DESC);

-- 5. Add push_subscription column for native push notifications
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS push_subscription JSONB;

COMMENT ON COLUMN profiles.push_subscription IS 
'Native browser push subscription object containing endpoint, keys, etc.';
