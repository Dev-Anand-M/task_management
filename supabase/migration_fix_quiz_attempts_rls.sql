-- Migration: Fix quiz_attempts RLS policy to allow Admins to update attempts (e.g. finalization and draft saving)
-- Purpose: Grant FOR UPDATE access to admin users so they can finalize and save draft reviews.

DROP POLICY IF EXISTS "Admins can update all quiz attempts" ON quiz_attempts;
CREATE POLICY "Admins can update all quiz attempts" ON quiz_attempts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
