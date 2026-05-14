-- Ensure delete policy for tasks is correct
DROP POLICY IF EXISTS "Admins can delete tasks" ON tasks;
CREATE POLICY "Admins can delete tasks" ON tasks
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Ensure delete policy for submissions is correct (in case of cascade issues)
DROP POLICY IF EXISTS "Admins can delete submissions" ON submissions;
CREATE POLICY "Admins can delete submissions" ON submissions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
