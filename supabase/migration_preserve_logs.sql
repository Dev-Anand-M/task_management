-- Migration: Prevent log deletion when routines are removed
-- We change the foreign key from CASCADE to SET NULL so logs persist.

ALTER TABLE routine_logs 
DROP CONSTRAINT IF EXISTS routine_logs_routine_id_fkey,
ADD CONSTRAINT routine_logs_routine_id_fkey 
    FOREIGN KEY (routine_id) 
    REFERENCES routines(id) 
    ON DELETE SET NULL;

COMMENT ON CONSTRAINT routine_logs_routine_id_fkey ON routine_logs IS 'Logs are preserved even if the parent routine is deleted.';
