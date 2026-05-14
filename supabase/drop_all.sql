-- ============================================
-- DROP ALL - Complete cleanup script
-- ============================================
-- Run this FIRST before running schema.sql

-- Drop all policies
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

DROP POLICY IF EXISTS "Users can view all tasks" ON tasks;
DROP POLICY IF EXISTS "Admins can manage tasks" ON tasks;

DROP POLICY IF EXISTS "Users can view all quizzes" ON quizzes;
DROP POLICY IF EXISTS "Admins can manage quizzes" ON quizzes;

DROP POLICY IF EXISTS "Users can view own submissions" ON submissions;
DROP POLICY IF EXISTS "Admins can view all submissions" ON submissions;
DROP POLICY IF EXISTS "Users can create own submissions" ON submissions;
DROP POLICY IF EXISTS "Admins can update submissions" ON submissions;

DROP POLICY IF EXISTS "Users can view own quiz attempts" ON quiz_attempts;
DROP POLICY IF EXISTS "Admins can view all quiz attempts" ON quiz_attempts;
DROP POLICY IF EXISTS "Users can create own quiz attempts" ON quiz_attempts;

-- Drop all tables (CASCADE removes dependencies)
DROP TABLE IF EXISTS quiz_attempts CASCADE;
DROP TABLE IF EXISTS submissions CASCADE;
DROP TABLE IF EXISTS quizzes CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Verify everything is dropped
SELECT 'All tables and policies dropped successfully!' as status;
