-- ===============================================
-- iOS-Level Performance Optimization
-- Database Indexes for Query Performance
-- 
-- Purpose: Add critical indexes to speed up common queries
-- Expected improvement: 60-80% faster query times
-- 
-- Run this in Supabase SQL Editor
-- ===============================================

-- INDEX 1: User Tasks by Status
-- Used in: Dashboard, MyTasks pages
-- Speeds up: SELECT * FROM tasks WHERE user_id = ? AND status = ?
CREATE INDEX IF NOT EXISTS idx_tasks_user_id_status 
ON tasks(user_id, status);

-- INDEX 2: User Tasks by Created Date
-- Used in: Task history queries
-- Speeds up: SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_tasks_user_created 
ON tasks(user_id, created_at DESC);

-- INDEX 3: XP History by User and Date
-- Used in: XP History page, user stats
-- Speeds up: SELECT * FROM xp_history WHERE user_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_xp_history_user_created 
ON xp_history(user_id, created_at DESC);

-- INDEX 4: Notifications by User and Read Status
-- Used in: Notifications page, unread count
-- Speeds up: SELECT * FROM notifications WHERE user_id = ? AND is_read = false
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON notifications(user_id, is_read, created_at DESC);

-- INDEX 5: Chat Messages by Room
-- Used in: Chat page, message loading
-- Speeds up: SELECT * FROM messages WHERE room_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_messages_room_created 
ON messages(room_id, created_at DESC);

-- INDEX 6: Quiz Submissions by User
-- Used in: Quiz history, evaluations
-- Speeds up: SELECT * FROM quiz_submissions WHERE user_id = ?
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_user 
ON quiz_submissions(user_id, created_at DESC);

-- INDEX 7: Task Submissions by User and Status
-- Used in: Evaluations, pending work
-- Speeds up: SELECT * FROM task_submissions WHERE user_id = ? AND status = ?
CREATE INDEX IF NOT EXISTS idx_task_submissions_user_status 
ON task_submissions(user_id, status);

-- INDEX 8: Routines by User and Active Status
-- Used in: Routines page
-- Speeds up: SELECT * FROM routines WHERE user_id = ? AND is_active = true
CREATE INDEX IF NOT EXISTS idx_routines_user_active 
ON routines(user_id, is_active);

-- INDEX 9: Study Materials by Classroom
-- Used in: Study Materials page
-- Speeds up: SELECT * FROM study_materials WHERE classroom_id = ?
CREATE INDEX IF NOT EXISTS idx_study_materials_classroom 
ON study_materials(classroom_id, created_at DESC);

-- INDEX 10: Leaderboard by Classroom and XP
-- Used in: Leaderboard page
-- Speeds up: SELECT * FROM profiles WHERE classroom_id = ? ORDER BY total_xp DESC
CREATE INDEX IF NOT EXISTS idx_profiles_classroom_xp 
ON profiles(classroom_id, total_xp DESC);

-- ===============================================
-- ANALYZE TABLES
-- Updates query planner statistics for better execution plans
-- ===============================================
ANALYZE tasks;
ANALYZE xp_history;
ANALYZE notifications;
ANALYZE messages;
ANALYZE quiz_submissions;
ANALYZE task_submissions;
ANALYZE routines;
ANALYZE study_materials;
ANALYZE profiles;

-- ===============================================
-- VERIFICATION
-- Check if indexes were created successfully
-- ===============================================
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
