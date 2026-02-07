-- Allow Admins to see ALL classrooms they created (not just the one they are currently 'in')
DROP POLICY IF EXISTS "Admins can view created classrooms" ON classrooms;
CREATE POLICY "Admins can view created classrooms" ON classrooms
  FOR SELECT USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') 
  );

-- Allow Admins to INSERT new classrooms
DROP POLICY IF EXISTS "Admins can create classrooms" ON classrooms;
CREATE POLICY "Admins can create classrooms" ON classrooms
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow Admins to UPDATE classrooms they created
DROP POLICY IF EXISTS "Admins can update created classrooms" ON classrooms;
CREATE POLICY "Admins can update created classrooms" ON classrooms
  FOR UPDATE USING (
    created_by = auth.uid()
  );

-- Allow Admins to DELETE classrooms they created
DROP POLICY IF EXISTS "Admins can delete created classrooms" ON classrooms;
CREATE POLICY "Admins can delete created classrooms" ON classrooms
  FOR DELETE USING (
    created_by = auth.uid()
  );
  
-- Important: We need to ensure 'created_by' is set on insert. Trigger or client side?
-- Client side can send it, but trigger is safer.
-- Let's rely on client sending it for now for simplicity, or add a trigger if needed.
-- Actually, default value auth.uid() is good practice but Supabase RLS checks constraints.

-- Also, we need to allow updating the profile's classroom_id (Switching Classrooms)
-- Existing policy "Users can update own profile" usually allows this.
-- Let's verify profiles policies.
-- In migration_profiles (or handled implicitly), usually users can update their own non-sensitive fields. 
-- Changing classroom_id is sensitive-ish? 
-- Let's ensure a policy exists for updating own profile classroom_id.
-- Let's ensure a policy exists for updating own profile classroom_id.
DROP POLICY IF EXISTS "Users can update own classroom context" ON profiles;
CREATE POLICY "Users can update own classroom context" ON profiles
  FOR UPDATE USING (
    id = auth.uid()
  ) WITH CHECK (
    id = auth.uid() -- standard own-profile update
  );

-- Fix: Allow public access to validate invite codes (Required for Registration)
DROP POLICY IF EXISTS "Anyone can check invite codes" ON invite_codes;
CREATE POLICY "Anyone can check invite codes" ON invite_codes
  FOR SELECT USING (true);

-- Fix: Allow new students to claim (update) invite codes
DROP POLICY IF EXISTS "Students can claim invite codes" ON invite_codes;
CREATE POLICY "Students can claim invite codes" ON invite_codes
  FOR UPDATE USING (
    is_used = false
  ) WITH CHECK (
    used_by = auth.uid()
  );

-- ============================================
-- FIX: ADMIN PERMISSIONS
-- ============================================

-- Allow Admins to update student profiles (e.g. Awarding XP)
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Ensure Admins can definitely update submissions
DROP POLICY IF EXISTS "Admins can update all submissions" ON submissions;
CREATE POLICY "Admins can update all submissions" ON submissions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- TASK ENHANCEMENTS (Missing Columns Fix)
-- ============================================

-- Add new columns to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deliverable_types TEXT[] DEFAULT '{repo_url}',
ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{Frontend}';

-- Update existing tasks to have default values
UPDATE tasks 
SET 
    start_date = created_at,
    deliverable_types = '{repo_url}',
    categories = ARRAY[category]
WHERE deliverable_types IS NULL OR categories IS NULL;

-- Add new columns to submissions table
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS live_demo_url TEXT,
ADD COLUMN IF NOT EXISTS file_upload TEXT,
ADD COLUMN IF NOT EXISTS design_files TEXT,
ADD COLUMN IF NOT EXISTS documentation TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_categories ON tasks USING GIN (categories);
CREATE INDEX IF NOT EXISTS idx_tasks_deliverable_types ON tasks USING GIN (deliverable_types);
CREATE INDEX IF NOT EXISTS idx_tasks_start_date ON tasks (start_date);
