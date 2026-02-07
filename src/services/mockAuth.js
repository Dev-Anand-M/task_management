// Mock Authentication Service using localStorage
import * as storage from './storage';

// Initialize demo data on first load
const initializeDemoData = () => {
    storage.initializeDemoData();
};

// Initialize on module load
initializeDemoData();

export const mockAuth = {
    // Get current session
    getSession: async () => {
        const currentUser = storage.getCurrentUser();
        return {
            data: {
                session: currentUser ? {
                    user: {
                        id: currentUser.id,
                        email: currentUser.email,
                        user_metadata: {
                            name: currentUser.name,
                            role: currentUser.role
                        }
                    }
                } : null
            },
            error: null
        };
    },

    // Sign in with email and password
    signInWithPassword: async ({ email, password }) => {
        const users = storage.getUsers();
        const user = users.find(u => 
            u.email.toLowerCase() === email.toLowerCase() && 
            u.password === password
        );

        if (!user) {
            return {
                data: { user: null },
                error: { message: 'Invalid email or password' }
            };
        }

        // Store current user
        storage.setCurrentUser(user);

        return {
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    user_metadata: {
                        name: user.name,
                        role: user.role
                    }
                }
            },
            error: null
        };
    },

    // Sign up new user
    signUp: async ({ email, password, options }) => {
        const users = storage.getUsers();
        
        // Check if user already exists
        if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
            return {
                data: { user: null },
                error: { message: 'User already exists' }
            };
        }

        const newUser = {
            id: `user-${Date.now()}`,
            email: email.toLowerCase(),
            password,
            name: options?.data?.name || email.split('@')[0],
            role: options?.data?.role || 'member',
            xp: 0,
            badges: [],
            created_at: new Date().toISOString()
        };

        users.push(newUser);
        storage.setUsers(users);
        storage.setCurrentUser(newUser);

        return {
            data: {
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    user_metadata: {
                        name: newUser.name,
                        role: newUser.role
                    }
                }
            },
            error: null
        };
    },

    // Sign out
    signOut: async () => {
        storage.clearCurrentUser();
        return { error: null };
    },

    // Auth state change listener
    onAuthStateChange: (callback) => {
        // Call immediately with current state
        const currentUser = storage.getCurrentUser();
        if (currentUser) {
            setTimeout(() => {
                callback('SIGNED_IN', {
                    user: {
                        id: currentUser.id,
                        email: currentUser.email,
                        user_metadata: {
                            name: currentUser.name,
                            role: currentUser.role
                        }
                    }
                });
            }, 0);
        } else {
            setTimeout(() => {
                callback('SIGNED_OUT', null);
            }, 0);
        }

        // Return subscription object
        return {
            data: {
                subscription: {
                    unsubscribe: () => {}
                }
            }
        };
    }
};

// Mock database service
export const mockDb = {
    // Get profile by ID
    getProfileById: async (id) => {
        const users = storage.getUsers();
        const user = users.find(u => u.id === id);
        if (!user) return null;
        
        // eslint-disable-next-line no-unused-vars
        const { password, ...profile } = user;
        return profile;
    },

    // Get all members
    getMembers: async () => {
        const users = storage.getUsers();
        // eslint-disable-next-line no-unused-vars
        return users.map(({ password, ...user }) => user);
    },

    // Update profile
    updateProfile: async (id, updates) => {
        const users = storage.getUsers();
        const index = users.findIndex(u => u.id === id);
        
        if (index === -1) return null;
        
        users[index] = { ...users[index], ...updates };
        storage.setUsers(users);
        
        // Update current user if it's the same
        const currentUser = storage.getCurrentUser();
        if (currentUser && currentUser.id === id) {
            storage.setCurrentUser(users[index]);
        }
        
        // eslint-disable-next-line no-unused-vars
        const { password, ...profile } = users[index];
        return profile;
    },

    // Tasks
    getTasks: async () => storage.getTasks(),
    getTaskById: async (id) => storage.getTaskById(id),
    createTask: async (task) => storage.addTask({ ...task, id: `task-${Date.now()}`, created_at: new Date().toISOString() }),
    updateTask: async (id, updates) => storage.updateTask(id, updates),
    deleteTask: async (id) => storage.deleteTask(id),

    // Quizzes
    getQuizzes: async () => storage.getQuizzes(),
    getQuizById: async (id) => storage.getQuizById(id),
    createQuiz: async (quiz) => storage.addQuiz({ ...quiz, id: `quiz-${Date.now()}`, created_at: new Date().toISOString() }),
    updateQuiz: async (id, updates) => storage.updateQuiz(id, updates),
    deleteQuiz: async (id) => storage.deleteQuiz(id),

    // Submissions
    getSubmissions: async () => {
        const submissions = storage.getSubmissions();
        const users = storage.getUsers();
        const tasks = storage.getTasks();
        
        // Join with user and task data
        return submissions.map(sub => ({
            ...sub,
            profiles: users.find(u => u.id === sub.user_id),
            tasks: tasks.find(t => t.id === sub.task_id)
        }));
    },
    
    getSubmissionsByUser: async (userId) => {
        const submissions = storage.getSubmissionsByUser(userId);
        const tasks = storage.getTasks();
        
        return submissions.map(sub => ({
            ...sub,
            tasks: tasks.find(t => t.id === sub.task_id)
        }));
    },
    
    getSubmissionById: async (id) => {
        const submission = storage.getSubmissionById(id);
        if (!submission) return null;
        
        const users = storage.getUsers();
        const tasks = storage.getTasks();
        
        return {
            ...submission,
            profiles: users.find(u => u.id === submission.user_id),
            tasks: tasks.find(t => t.id === submission.task_id)
        };
    },
    
    createSubmission: async (submission) => {
        return storage.addSubmission({
            ...submission,
            id: `sub-${Date.now()}`,
            submitted_at: new Date().toISOString()
        });
    },
    
    updateSubmission: async (id, updates) => storage.updateSubmission(id, updates),

    // Quiz Attempts
    getQuizAttempts: async () => storage.getQuizAttempts(),
    getQuizAttemptsByUser: async (userId) => storage.getQuizAttemptsByUser(userId),
    createQuizAttempt: async (attempt) => {
        return storage.addQuizAttempt({
            ...attempt,
            id: `attempt-${Date.now()}`,
            completed_at: new Date().toISOString()
        });
    }
};
