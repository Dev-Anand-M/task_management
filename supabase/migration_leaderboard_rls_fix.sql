-- Migration: Fix quiz_attempts and submissions SELECT policies for classmates
-- Purpose: Correct leaderboard completion statistics and ranking for students

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

-- 2. Submissions SELECT policy update
DROP POLICY IF EXISTS "Users can view own submissions" ON public.submissions;
CREATE POLICY "Users can view own submissions" ON public.submissions
    FOR SELECT USING (
        user_id = auth.uid() OR
        is_admin() OR
        EXISTS (
            SELECT 1 FROM public.profiles student_p
            JOIN public.profiles my_p ON student_p.classroom_id = my_p.classroom_id
            WHERE student_p.id = submissions.user_id
              AND my_p.id = auth.uid()
              AND my_p.classroom_id IS NOT NULL
        )
    );

-- 3. Quiz Attempts SELECT policy update
DROP POLICY IF EXISTS "Users can view own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Users can view own quiz attempts" ON public.quiz_attempts
    FOR SELECT USING (
        user_id = auth.uid() OR
        is_admin() OR
        EXISTS (
            SELECT 1 FROM public.profiles student_p
            JOIN public.profiles my_p ON student_p.classroom_id = my_p.classroom_id
            WHERE student_p.id = quiz_attempts.user_id
              AND my_p.id = auth.uid()
              AND my_p.classroom_id IS NOT NULL
        )
    );
