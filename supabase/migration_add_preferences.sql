-- Add preferences column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{"theme": "dark", "colorScheme": "gold", "notifications": {"email": true, "push": true, "taskReminders": true, "quizResults": true}}';

-- Update existing profiles to have default preferences if null
UPDATE profiles SET preferences = '{"theme": "dark", "colorScheme": "gold", "notifications": {"email": true, "push": true, "taskReminders": true, "quizResults": true}}' WHERE preferences IS NULL;
