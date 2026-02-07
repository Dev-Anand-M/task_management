-- ============================================
-- RESET SCRIPT - Clears all data and resets tables
-- ============================================
-- WARNING: This will delete ALL data in your database!
-- Run this in Supabase SQL Editor to start fresh

-- Delete all data from tables (in correct order to avoid foreign key issues)
DELETE FROM quiz_attempts;
DELETE FROM submissions;
DELETE FROM quizzes;
DELETE FROM tasks;
DELETE FROM profiles;

-- Reset sequences (if any)
-- Note: Supabase uses UUIDs by default, so no sequences to reset

-- Verify all tables are empty
SELECT 'profiles' as table_name, COUNT(*) as count FROM profiles
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'quizzes', COUNT(*) FROM quizzes
UNION ALL
SELECT 'submissions', COUNT(*) FROM submissions
UNION ALL
SELECT 'quiz_attempts', COUNT(*) FROM quiz_attempts;

-- ============================================
-- OPTIONAL: Insert demo data
-- ============================================

-- Note: You'll need to create auth users first in Supabase Dashboard
-- Then their profiles will be auto-created by the trigger

-- Demo Tasks
INSERT INTO tasks (title, description, category, difficulty, points, deadline, assigned_to, criteria, status, created_by) VALUES
('Create a Responsive Login Page', 'Build a modern, responsive login page with email/password fields, remember me checkbox, and forgot password link. Use form validation and ensure it works on mobile devices.', 'Frontend', 'medium', 100, NOW() + INTERVAL '7 days', ARRAY[]::uuid[], ARRAY['has_html', 'has_css', 'responsive', 'form_validation'], 'active', (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1)),
('Build a REST API', 'Create a simple REST API with CRUD operations for a todo list. Implement proper error handling and return appropriate status codes.', 'Backend', 'hard', 200, NOW() + INTERVAL '14 days', ARRAY[]::uuid[], ARRAY['clean_code', 'error_handling', 'readme'], 'active', (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1)),
('Design a Dashboard UI', 'Create a dashboard UI mockup with charts, cards, and navigation. Focus on visual hierarchy and user experience.', 'UI/UX', 'easy', 50, NOW() + INTERVAL '5 days', ARRAY[]::uuid[], ARRAY['has_html', 'has_css', 'responsive'], 'active', (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1));

-- Demo Quizzes
INSERT INTO quizzes (title, description, category, difficulty, points, time_limit, questions, status, assigned_to, created_by) VALUES
('HTML Fundamentals', 'Test your knowledge of HTML basics including tags, attributes, and semantic markup.', 'Frontend', 'easy', 30, 10, 
'[
  {
    "id": "q1",
    "type": "multiple",
    "question": "What does HTML stand for?",
    "options": ["Hyper Text Markup Language", "High Tech Modern Language", "Hybrid Text Making Language", "Home Tool Markup Language"],
    "correctAnswer": 0
  },
  {
    "id": "q2",
    "type": "boolean",
    "question": "The <div> tag is a semantic HTML element.",
    "correctAnswer": false
  },
  {
    "id": "q3",
    "type": "multiple",
    "question": "Which tag is used for the largest heading?",
    "options": ["<h6>", "<h1>", "<heading>", "<head>"],
    "correctAnswer": 1
  },
  {
    "id": "q4",
    "type": "multiple",
    "question": "Which attribute specifies the destination of a link?",
    "options": ["src", "link", "href", "dest"],
    "correctAnswer": 2
  },
  {
    "id": "q5",
    "type": "boolean",
    "question": "The <img> tag requires a closing tag.",
    "correctAnswer": false
  }
]'::jsonb, 'active', ARRAY[]::uuid[], (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1)),

('CSS Flexbox & Grid', 'Advanced CSS layout techniques using Flexbox and Grid.', 'Frontend', 'medium', 50, 15,
'[
  {
    "id": "q1",
    "type": "multiple",
    "question": "Which property is used to create a flex container?",
    "options": ["flex: 1", "display: flex", "flex-direction: row", "justify-content: center"],
    "correctAnswer": 1
  },
  {
    "id": "q2",
    "type": "multiple",
    "question": "What is the default flex-direction value?",
    "options": ["column", "row-reverse", "row", "column-reverse"],
    "correctAnswer": 2
  },
  {
    "id": "q3",
    "type": "boolean",
    "question": "CSS Grid can only create one-dimensional layouts.",
    "correctAnswer": false
  },
  {
    "id": "q4",
    "type": "multiple",
    "question": "Which property centers items vertically in a flex container?",
    "options": ["justify-content", "align-items", "flex-align", "vertical-align"],
    "correctAnswer": 1
  }
]'::jsonb, 'active', ARRAY[]::uuid[], (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1));

-- Success message
SELECT '✅ Database reset complete! All data cleared.' as status;
SELECT '⚠️  Remember to create auth users in Supabase Dashboard > Authentication > Users' as reminder;
