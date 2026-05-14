-- Migration: Add duration to routines for strict interval tracking
ALTER TABLE routines ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60;

COMMENT ON COLUMN routines.duration_minutes IS 'The planned duration of the routine in minutes. Used for strict conflict detection and interval management.';
