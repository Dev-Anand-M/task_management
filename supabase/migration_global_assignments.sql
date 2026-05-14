-- Add is_global column to tasks and quizzes
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;

-- Add assignment_type column for UI clarity (optional but helpful)
-- 'everyone' or 'specific'
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignment_type TEXT DEFAULT 'everyone' CHECK (assignment_type IN ('everyone', 'specific'));
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS assignment_type TEXT DEFAULT 'everyone' CHECK (assignment_type IN ('everyone', 'specific'));

-- Update RLS Policies to allow viewing global items
DROP POLICY IF EXISTS "Users can view classroom tasks" ON tasks;
CREATE POLICY "Users can view tasks" ON tasks
  FOR SELECT USING (
    classroom_id = get_my_classroom_id() OR
    is_global = true
  );

DROP POLICY IF EXISTS "Users can view classroom quizzes" ON quizzes;
CREATE POLICY "Users can view quizzes" ON quizzes
  FOR SELECT USING (
    classroom_id = get_my_classroom_id() OR
    is_global = true
  );

-- Update Insert policies to allow admins to create global tasks
DROP POLICY IF EXISTS "Admins can insert classroom tasks" ON tasks;
CREATE POLICY "Admins can insert tasks" ON tasks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can update classroom tasks" ON tasks;
CREATE POLICY "Admins can update tasks" ON tasks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can delete classroom tasks" ON tasks;
CREATE POLICY "Admins can delete tasks" ON tasks
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Similar for Quizzes
DROP POLICY IF EXISTS "Admins can manage classroom quizzes" ON quizzes;
CREATE POLICY "Admins can manage quizzes" ON quizzes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
