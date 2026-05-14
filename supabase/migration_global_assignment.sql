-- Add is_global and assignment_type to tasks
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'is_global') THEN
        ALTER TABLE tasks ADD COLUMN is_global BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'assignment_type') THEN
        ALTER TABLE tasks ADD COLUMN assignment_type TEXT DEFAULT 'everyone';
    END IF;
END $$;

-- Add is_global and assignment_type to quizzes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quizzes' AND column_name = 'is_global') THEN
        ALTER TABLE quizzes ADD COLUMN is_global BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quizzes' AND column_name = 'assignment_type') THEN
        ALTER TABLE quizzes ADD COLUMN assignment_type TEXT DEFAULT 'everyone';
    END IF;
END $$;
