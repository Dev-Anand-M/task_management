-- Migration: Snapshot routine details in logs to prevent past records from changing when routine is edited
ALTER TABLE routine_logs ADD COLUMN IF NOT EXISTS snapshot_title TEXT;
ALTER TABLE routine_logs ADD COLUMN IF NOT EXISTS snapshot_start_time TIME;

-- Update existing logs to have the current title/time from routines table
UPDATE routine_logs
SET snapshot_title = routines.title,
    snapshot_start_time = routines.start_time
FROM routines
WHERE routine_logs.routine_id = routines.id;
