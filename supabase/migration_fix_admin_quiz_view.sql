-- Migration: Fix Admin Quiz View Policy
-- Problem: Admins cannot view or delete quizzes from other classrooms due to missing RLS policy.
-- The migration_admin_global_fix.sql added global view policies for profiles, tasks,
-- submissions, and quiz_attempts — but missed the quizzes table.
-- This caused quiz attempts to show as "deleted" in the EvaluationCenter when the quiz
-- belonged to a different classroom or had a NULL classroom_id.

-- Add "Admins can view all quizzes" policy (matching the pattern from migration_admin_global_fix.sql)
DROP POLICY IF EXISTS "Admins can view all quizzes" ON quizzes;
CREATE POLICY "Admins can view all quizzes" ON quizzes
    FOR SELECT USING ( is_admin() );

-- Add "Admins can manage all quizzes" policy
DROP POLICY IF EXISTS "Admins can manage all quizzes" ON quizzes;
CREATE POLICY "Admins can manage all quizzes" ON quizzes
    FOR ALL USING ( is_admin() );
