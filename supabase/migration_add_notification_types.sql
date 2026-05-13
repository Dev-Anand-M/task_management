-- Add new notification types for task, quiz, and announcement
-- Drop the old constraint and create a new one with additional types

ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('success', 'info', 'warning', 'error', 'award', 'task', 'quiz', 'announcement', 'submission', 'quiz_result'));

-- Add comment explaining the types
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
