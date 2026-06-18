-- Migration: Allow Admins to delete submissions, quiz attempts, and notifications
-- Purpose: Enable Admins to clean up student data when removing them from a classroom.

-- 1. Allow Admins to delete submissions
DROP POLICY IF EXISTS "Admins can delete all submissions" ON submissions;
CREATE POLICY "Admins can delete all submissions" ON submissions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 2. Allow Admins to delete quiz attempts
DROP POLICY IF EXISTS "Admins can delete all quiz attempts" ON quiz_attempts;
CREATE POLICY "Admins can delete all quiz attempts" ON quiz_attempts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 3. Allow Admins to delete notifications
DROP POLICY IF EXISTS "Admins can delete all notifications" ON notifications;
CREATE POLICY "Admins can delete all notifications" ON notifications
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
