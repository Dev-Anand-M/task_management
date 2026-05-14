-- Migration: Add Anonymous flags and Retroactive Logging fields
ALTER TABLE routines ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;
ALTER TABLE routine_logs ADD COLUMN IF NOT EXISTS actual_start_time TIME;

-- Update existing triggers or logic if necessary
COMMENT ON COLUMN routines.is_anonymous IS 'If true, the routine can be logged retroactively at any time. If false, it is locked until the scheduled start time.';
COMMENT ON COLUMN routine_logs.actual_start_time IS 'The time the user actually started the task, for retroactive logging.';
