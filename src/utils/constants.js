// Zenith - Utility Functions and Constants

// Generate unique IDs
export const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Format date
export const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

// Format relative time
export const formatRelativeTime = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatDate(date);
};

// Calculate XP level
export const calculateLevel = (xp) => {
    return Math.floor(xp / 500) + 1;
};

// Calculate progress to next level
export const calculateLevelProgress = (xp) => {
    return (xp % 500) / 500 * 100;
};

// Get initials from name
export const getInitials = (name) => {
    return name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
};

// Difficulty colors
export const getDifficultyColor = (difficulty) => {
    const colors = {
        easy: 'success',
        medium: 'warning',
        hard: 'error',
        expert: 'primary'
    };
    return colors[difficulty] || 'primary';
};

// Status colors
export const getStatusColor = (status) => {
    const colors = {
        pending: 'warning',
        submitted: 'primary',
        approved: 'success',
        rejected: 'error',
        'in-progress': 'accent'
    };
    return colors[status] || 'primary';
};

// Task categories
export const TASK_CATEGORIES = [
    'Frontend',
    'Backend',
    'Full Stack',
    'UI/UX',
    'Database',
    'API',
    'Testing',
    'DevOps',
    'Mobile',
    'Other'
];

// Difficulty levels
export const DIFFICULTY_LEVELS = [
    { value: 'easy', label: 'Easy', points: 50 },
    { value: 'medium', label: 'Medium', points: 100 },
    { value: 'hard', label: 'Hard', points: 200 },
    { value: 'expert', label: 'Expert', points: 300 }
];

// Quiz question types
export const QUESTION_TYPES = [
    { value: 'multiple', label: 'Multiple Choice' },
    { value: 'boolean', label: 'True/False' },
    { value: 'short', label: 'Short Answer' }
];

// Achievement badges
export const BADGES = [
    { id: 'first_task', name: 'First Step', description: 'Complete your first task', icon: '🎯', xp: 50 },
    { id: 'streak_3', name: 'On Fire', description: 'Complete 3 tasks in a row', icon: '🔥', xp: 100 },
    { id: 'perfect_score', name: 'Perfectionist', description: 'Get 100% on a task', icon: '💯', xp: 150 },
    { id: 'quiz_master', name: 'Quiz Master', description: 'Pass 5 quizzes', icon: '🧠', xp: 200 },
    { id: 'top_3', name: 'Rising Star', description: 'Reach top 3 on leaderboard', icon: '⭐', xp: 250 },
    { id: 'week_warrior', name: 'Week Warrior', description: 'Complete all tasks in a week', icon: '⚔️', xp: 300 },
    { id: 'mentor', name: 'Mentor', description: 'Help evaluate 10 submissions', icon: '🎓', xp: 400 },
    { id: 'legend', name: 'Legend', description: 'Reach 5000 XP', icon: '👑', xp: 500 }
];

// Evaluation criteria templates
export const EVALUATION_CRITERIA = [
    { id: 'has_html', label: 'Has index.html', auto: true },
    { id: 'has_css', label: 'Has CSS file', auto: true },
    { id: 'has_js', label: 'Has JavaScript file', auto: true },
    { id: 'responsive', label: 'Responsive design', auto: false },
    { id: 'semantic_html', label: 'Semantic HTML', auto: false },
    { id: 'form_validation', label: 'Form validation', auto: false },
    { id: 'clean_code', label: 'Clean code', auto: false },
    { id: 'readme', label: 'Has README', auto: true },
    { id: 'comments', label: 'Code comments', auto: false },
    { id: 'comments', label: 'Code comments', auto: false },
    { id: 'error_handling', label: 'Error handling', auto: false }
];

// Deliverable Types
export const DELIVERABLE_TYPES = [
    { id: 'repo_url', label: 'Repository URL' },
    { id: 'live_demo', label: 'Live Demo Link' },
    { id: 'file_upload', label: 'File Upload Link' },
    { id: 'design_file', label: 'Design File Link' },
    { id: 'documentation', label: 'Documentation Link' },
    { id: 'other', label: 'Other' }
];
