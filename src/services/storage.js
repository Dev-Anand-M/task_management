// Zenith - Local Storage Service

const STORAGE_KEYS = {
    USERS: 'zenith_users',
    CURRENT_USER: 'zenith_current_user',
    TASKS: 'zenith_tasks',
    SUBMISSIONS: 'zenith_submissions',
    QUIZZES: 'zenith_quizzes',
    QUIZ_ATTEMPTS: 'zenith_quiz_attempts',
    THEME: 'zenith_theme'
};

// Generic storage functions
export const getItem = (key) => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (error) {
        console.error(`Error getting item ${key}:`, error);
        return null;
    }
};

export const setItem = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error(`Error setting item ${key}:`, error);
        return false;
    }
};

export const removeItem = (key) => {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error(`Error removing item ${key}:`, error);
        return false;
    }
};

// User functions
export const getUsers = () => getItem(STORAGE_KEYS.USERS) || [];
export const setUsers = (users) => setItem(STORAGE_KEYS.USERS, users);

export const getCurrentUser = () => getItem(STORAGE_KEYS.CURRENT_USER);
export const setCurrentUser = (user) => setItem(STORAGE_KEYS.CURRENT_USER, user);
export const clearCurrentUser = () => removeItem(STORAGE_KEYS.CURRENT_USER);

export const getUserById = (id) => {
    const users = getUsers();
    return users.find(u => u.id === id);
};

export const updateUser = (id, updates) => {
    const users = getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
        users[index] = { ...users[index], ...updates };
        setUsers(users);
        // Update current user if it's the same user
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.id === id) {
            setCurrentUser(users[index]);
        }
        return users[index];
    }
    return null;
};

// Task functions
export const getTasks = () => getItem(STORAGE_KEYS.TASKS) || [];
export const setTasks = (tasks) => setItem(STORAGE_KEYS.TASKS, tasks);

export const getTaskById = (id) => {
    const tasks = getTasks();
    return tasks.find(t => t.id === id);
};

export const addTask = (task) => {
    const tasks = getTasks();
    tasks.push(task);
    setTasks(tasks);
    return task;
};

export const updateTask = (id, updates) => {
    const tasks = getTasks();
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
        tasks[index] = { ...tasks[index], ...updates };
        setTasks(tasks);
        return tasks[index];
    }
    return null;
};

export const deleteTask = (id) => {
    const tasks = getTasks();
    const filtered = tasks.filter(t => t.id !== id);
    setTasks(filtered);
    return true;
};

// Submission functions
export const getSubmissions = () => getItem(STORAGE_KEYS.SUBMISSIONS) || [];
export const setSubmissions = (submissions) => setItem(STORAGE_KEYS.SUBMISSIONS, submissions);

export const getSubmissionById = (id) => {
    const submissions = getSubmissions();
    return submissions.find(s => s.id === id);
};

export const getSubmissionsByTask = (taskId) => {
    const submissions = getSubmissions();
    return submissions.filter(s => s.task_id === taskId);
};

export const getSubmissionsByUser = (userId) => {
    const submissions = getSubmissions();
    return submissions.filter(s => s.user_id === userId);
};

export const addSubmission = (submission) => {
    const submissions = getSubmissions();
    submissions.push(submission);
    setSubmissions(submissions);
    return submission;
};

export const updateSubmission = (id, updates) => {
    const submissions = getSubmissions();
    const index = submissions.findIndex(s => s.id === id);
    if (index !== -1) {
        submissions[index] = { ...submissions[index], ...updates };
        setSubmissions(submissions);
        return submissions[index];
    }
    return null;
};

// Quiz functions
export const getQuizzes = () => getItem(STORAGE_KEYS.QUIZZES) || [];
export const setQuizzes = (quizzes) => setItem(STORAGE_KEYS.QUIZZES, quizzes);

export const getQuizById = (id) => {
    const quizzes = getQuizzes();
    return quizzes.find(q => q.id === id);
};

export const addQuiz = (quiz) => {
    const quizzes = getQuizzes();
    quizzes.push(quiz);
    setQuizzes(quizzes);
    return quiz;
};

export const updateQuiz = (id, updates) => {
    const quizzes = getQuizzes();
    const index = quizzes.findIndex(q => q.id === id);
    if (index !== -1) {
        quizzes[index] = { ...quizzes[index], ...updates };
        setQuizzes(quizzes);
        return quizzes[index];
    }
    return null;
};

export const deleteQuiz = (id) => {
    const quizzes = getQuizzes();
    const filtered = quizzes.filter(q => q.id !== id);
    setQuizzes(filtered);
    return true;
};

// Quiz attempts
export const getQuizAttempts = () => getItem(STORAGE_KEYS.QUIZ_ATTEMPTS) || [];
export const setQuizAttempts = (attempts) => setItem(STORAGE_KEYS.QUIZ_ATTEMPTS, attempts);

export const addQuizAttempt = (attempt) => {
    const attempts = getQuizAttempts();
    attempts.push(attempt);
    setQuizAttempts(attempts);
    return attempt;
};

export const getQuizAttemptsByUser = (userId) => {
    const attempts = getQuizAttempts();
    return attempts.filter(a => a.user_id === userId);
};

// Theme functions
export const getTheme = () => getItem(STORAGE_KEYS.THEME) || 'dark';
export const setTheme = (theme) => setItem(STORAGE_KEYS.THEME, theme);

// Initialize with demo data (disabled for production)
export const initializeDemoData = () => {
    // Demo data removed - starting with clean slate
};

export { STORAGE_KEYS };
