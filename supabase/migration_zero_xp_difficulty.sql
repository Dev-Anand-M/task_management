-- Migration: Add 'none' difficulty level for 0 XP tasks and quizzes
-- 1. Drop existing task difficulty check constraint if it exists
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_difficulty_check;

-- 2. Add updated task difficulty check constraint (including 'none')
ALTER TABLE public.tasks ADD CONSTRAINT tasks_difficulty_check 
  CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert', 'none'));

-- 3. Update quizzes difficulty check constraint as well for consistency
ALTER TABLE public.quizzes DROP CONSTRAINT IF EXISTS quizzes_difficulty_check;
ALTER TABLE public.quizzes ADD CONSTRAINT quizzes_difficulty_check 
  CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert', 'none'));
