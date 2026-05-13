# Fix Notification Type Error

## Problem

You're getting this error:
```
Error creating notification: new row for relation "notifications" violates check constraint "notifications_type_check"
```

This is because the database only allows these notification types:
- `'success', 'info', 'warning', 'error', 'award'`

But we're trying to use:
- `'task', 'quiz', 'announcement', 'submission', 'quiz_result'`

## Solution

Run the migration to add the new notification types to the database.

### Step 1: Go to Supabase Dashboard

1. Open https://supabase.com/dashboard
2. Select your project: `xnzmlzihqaqcwoiufegm`
3. Go to **SQL Editor** (left sidebar)

### Step 2: Run the Migration

Copy and paste this SQL into the SQL Editor:

```sql
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
```

### Step 3: Click "Run"

The migration should complete successfully with a message like:
```
Success. No rows returned
```

### Step 4: Test

1. Go back to your app
2. Try assigning a task or quiz
3. Check if notifications are created without errors
4. Check the notification bell icon

## Verification

After running the migration, you can verify it worked by running this query in SQL Editor:

```sql
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'notifications_type_check';
```

You should see the new types in the check clause.

## What This Does

This migration:
1. Removes the old constraint that only allowed 5 types
2. Adds a new constraint that allows 10 types (old + new)
3. Adds documentation to the database about what each type means

## After Migration

Once the migration is complete:
- ✅ Task assignments will create notifications
- ✅ Quiz assignments will create notifications
- ✅ Announcements will create notifications
- ✅ Task evaluations will create notifications
- ✅ Quiz evaluations will create notifications

All without database errors!
