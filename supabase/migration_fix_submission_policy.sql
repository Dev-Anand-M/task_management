-- Fix submission update policy to allow resubmission of rejected tasks
-- Previous policy only allowed updates if status was 'pending'

DROP POLICY IF EXISTS "Users can update own pending submissions" ON submissions;

CREATE POLICY "Users can update own submissions" ON submissions
  FOR UPDATE USING (
    (user_id = auth.uid() AND status IN ('pending', 'rejected')) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
