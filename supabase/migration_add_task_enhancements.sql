-- Migration: Add task enhancements
-- Run this in Supabase SQL Editor to add new fields

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

-- Update task display function to handle multiple categories
CREATE OR REPLACE FUNCTION get_task_categories(task_categories TEXT[])
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(array_to_string(task_categories, ', '), 'No categories');
END;
$$ LANGUAGE plpgsql;

-- Comment on the changes
COMMENT ON COLUMN tasks.start_date IS 'When the task should start';
COMMENT ON COLUMN tasks.deliverable_types IS 'Array of acceptable deliverable types';
COMMENT ON COLUMN tasks.categories IS 'Array of task categories (multiple allowed)';
COMMENT ON COLUMN submissions.live_demo_url IS 'URL to live demo/preview';
COMMENT ON COLUMN submissions.file_upload IS 'Link to uploaded files';
COMMENT ON COLUMN submissions.design_files IS 'Link to design files';
COMMENT ON COLUMN submissions.documentation IS 'Link to documentation';
