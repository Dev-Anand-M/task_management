-- Migration: Fix Admin Permissions for Global View
-- Purpose: Allow admins to view all data regardless of classroom

-- 1. Helper function to check admin role safely (bypasses RLS due to SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Add Policies (using DO block to avoid error if policy already exists, or just create with unique names)

-- Profiles: Admins can view all
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING ( is_admin() );

-- Tasks: Admins can view all
DROP POLICY IF EXISTS "Admins can view all tasks" ON tasks;
CREATE POLICY "Admins can view all tasks" ON tasks
    FOR SELECT USING ( is_admin() );

-- Submissions: Admins can view all
DROP POLICY IF EXISTS "Admins can view all submissions" ON submissions;
CREATE POLICY "Admins can view all submissions" ON submissions
    FOR SELECT USING ( is_admin() );

-- Quiz Attempts: Admins can view all
DROP POLICY IF EXISTS "Admins can view all quiz attempts" ON quiz_attempts;
CREATE POLICY "Admins can view all quiz attempts" ON quiz_attempts
    FOR SELECT USING ( is_admin() );

-- Verify
-- SELECT * FROM profiles; -- Should now return all for admins
