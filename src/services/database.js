import { supabase } from '../lib/supabase';

// ============================================
// PROFILES
// ============================================
export const getMembers = async () => {
    try {
        // Filter by current classroom
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
            console.error('Auth error in getMembers:', error);
            return [];
        }
        if (!user) return [];

        const { data: profile } = await supabase.from('profiles').select('classroom_id, role').eq('id', user.id).single();

        let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });

        if (profile?.classroom_id) {
            query = query.eq('classroom_id', profile.classroom_id);
        } else if (profile?.role !== 'admin') {
            // If not admin and no classroom, return nothing or handle appropriately
            return [];
        }
        // If admin and no classroom, returns all (Global)

        const { data, error: queryError } = await query;
        if (queryError) throw queryError;
        return data || [];
    } catch (err) {
        console.error('Error in getMembers:', err);
        return [];
    }
};

export const getProfileById = async (id) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (error) return null;
    return data;
};

export const updateProfile = async (id, updates) => {
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
};

export const uploadAvatar = async (userId, file) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

    if (uploadError) {
        throw uploadError;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return data.publicUrl;
};

// ============================================
// TASKS
// ============================================
export const getTasks = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await supabase.from('profiles').select('classroom_id, role').eq('id', user.id).single();

    let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });

    // Filter by classroom or global
    if (profile?.classroom_id) {
        query = query.or(`classroom_id.eq.${profile.classroom_id},is_global.eq.true`);
    } else if (profile?.role === 'admin') {
        // Admin with no classroom -> View ALL tasks
        // No filter applied
    } else {
        return [];
    }

    const { data, error } = await query;
    if (error) throw error;

    // Filter based on assignment (Everyone vs Specific)
    // Only apply this filter for students (members)
    if (profile?.role === 'member') {
        return (data || []).filter(task => {
            if (task.assignment_type === 'specific') {
                return task.assigned_to?.includes(user.id);
            }
            return true; // assignment_type === 'everyone' or undefined
        });
    }

    return data || [];
};

export const getTaskById = async (id) => {
    const { data, error } = await supabase.from('tasks').select('*').eq('id', id).single();
    if (error) return null;
    return data;
};

export const createTask = async (task) => {
    // Inject current classroom_id
    const { data: { user } } = await supabase.auth.getUser();
    let classroomId = task.classroom_id;

    if (!classroomId && !task.is_global) {
        const { data: profile } = await supabase.from('profiles').select('classroom_id').eq('id', user.id).single();
        classroomId = profile?.classroom_id;
    }

    const { data, error } = await supabase.from('tasks').insert({
        ...task,
        classroom_id: task.is_global ? null : classroomId
    }).select().single();

    if (error) throw error;

    // Notify students
    try {
        if (task.is_global) {
            // Potentially notify everyone? Skip for now to avoid noise, or notify current classroom
            if (classroomId) {
                await notifyClassroom(classroomId, {
                    title: 'New Global Task Posted',
                    message: `A new task "${task.title}" is now available to everyone.`,
                    type: 'info',
                    link: `/tasks`
                });
            }
        } else if (classroomId) {
            await notifyClassroom(classroomId, {
                title: 'New Task Posted',
                message: `A new task "${task.title}" is now available.`,
                type: 'info',
                link: `/tasks`
            });
        }
    } catch (err) {
        console.error('Notification error:', err);
    }

    return data;
};

export const updateTask = async (id, updates) => {
    const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
};

export const deleteTask = async (id) => {
    const { error, count } = await supabase.from('tasks').delete().eq('id', id).select('id', { count: 'exact' });

    if (error) throw error;
    if (count === 0) throw new Error('Task not found or permission denied');
    return true;
};

export const getSubmissions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await supabase.from('profiles').select('classroom_id').eq('id', user.id).single();

    let query = supabase.from('submissions').select('*, tasks(*), profiles(*)').order('submitted_at', { ascending: false });

    if (profile?.classroom_id) {
        // Filter submissions where the related task belongs to the current classroom
        query = supabase.from('submissions')
            .select('*, tasks!inner(*), profiles(*)')
            .eq('tasks.classroom_id', profile.classroom_id)
            .order('submitted_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

export const getSubmissionsByUser = async (userId) => {
    const { data, error } = await supabase.from('submissions').select(`*, tasks(*)`).eq('user_id', userId).order('submitted_at', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const getSubmissionById = async (id) => {
    const { data, error } = await supabase.from('submissions').select(`*, profiles(*), tasks(*)`).eq('id', id).single();
    if (error) return null;
    return data;
};

export const createSubmission = async (submission) => {
    const { data, error } = await supabase.from('submissions').insert(submission).select('*, tasks(*), profiles(*)').single(); // Select related data for notification context
    if (error) throw error;

    // Notify Admins
    try {
        const classroomId = data.tasks?.classroom_id || data.profiles?.classroom_id;
        if (classroomId) {
            await notifyAdmins(classroomId, {
                title: 'New Submission',
                message: `${data.profiles?.name || 'A student'} submitted "${data.tasks?.title}" for review.`,
                type: 'info',
                link: `/admin/evaluations`
            });
        }
    } catch (err) {
        console.error('Error notifying admins on create:', err);
    }

    return data;
};

export const updateSubmission = async (id, updates) => {
    const { data, error } = await supabase.from('submissions').update(updates).eq('id', id).select('*, tasks(*), profiles(*)').single();
    if (error) throw error;

    // Notify admins if status is pending (resubmission)
    if (updates.status === 'pending') {
        try {
            const classroomId = data.tasks?.classroom_id || data.profiles?.classroom_id;
            if (classroomId) {
                await notifyAdmins(classroomId, {
                    title: 'Submission Updated',
                    message: `${data.profiles?.name || 'A student'} updated their submission for "${data.tasks?.title}"`,
                    type: 'info',
                    link: `/admin/evaluations`
                });
            }
        } catch (err) {
            console.error('Error notifying admins on update:', err);
        }
    }

    return data;
};

// ============================================
// QUIZZES
// ============================================
export const getQuizzes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await supabase.from('profiles').select('classroom_id, role').eq('id', user.id).single();

    let query = supabase.from('quizzes').select('*').order('created_at', { ascending: false });

    // Fetch all quizzes and filter in JS for maximum reliability
    const { data, error } = await query;
    if (error) {
        console.error('Database error fetching quizzes:', error);
        throw error;
    }

    const allQuizzes = data || [];

    // Students only see quizzes for their classroom, global ones, or ones specifically assigned to them
    if (profile?.role === 'member') {
        const filtered = allQuizzes.filter(quiz => {
            const isGlobal = quiz.is_global === true;
            const isInClassroom = quiz.classroom_id === profile.classroom_id;
            const isSpecificallyAssigned = quiz.assigned_to?.includes(user.id);
            
            // Logic:
            // 1. If global, everyone sees it.
            // 2. If specific, ONLY the assigned students see it.
            // 3. Otherwise (classroom/everyone), everyone in the classroom sees it.
            
            if (isGlobal) return true;
            
            if (quiz.assignment_type === 'specific') {
                return isSpecificallyAssigned;
            }
            
            return isInClassroom;
        });
        
        console.log(`Member Quizzes: Found ${allQuizzes.length} total, showing ${filtered.length} for user`);
        return filtered;
    }

    return allQuizzes;
};

export const getQuizById = async (id) => {
    const { data, error } = await supabase.from('quizzes').select('*').eq('id', id).single();
    if (error) return null;
    return data;
};

export const createQuiz = async (quiz) => {
    const { data: { user } } = await supabase.auth.getUser();
    let classroomId = quiz.classroom_id;

    if (!classroomId && !quiz.is_global) {
        const { data: profile } = await supabase.from('profiles').select('classroom_id').eq('id', user.id).single();
        classroomId = profile?.classroom_id;
    }

    const { data, error } = await supabase.from('quizzes').insert({
        ...quiz,
        classroom_id: quiz.is_global ? null : classroomId
    }).select().single();

    if (error) throw error;

    // Notify students
    try {
        if (quiz.assignment_type === 'specific' && quiz.assigned_to?.length > 0) {
            // Notify specific students
            const notifications = quiz.assigned_to.map(studentId => ({
                user_id: studentId,
                title: 'New Quiz Assigned',
                message: `You have been specifically assigned the quiz: "${quiz.title}"`,
                type: 'warning',
                link: '/quizzes'
            }));
            await supabase.from('notifications').insert(notifications);
        } else if (classroomId) {
            // Notify entire classroom
            await notifyClassroom(classroomId, {
                title: quiz.is_global ? 'New Global Quiz Available' : 'New Quiz Available',
                message: `A new quiz "${quiz.title}" is ready for you!`,
                type: 'warning',
                link: '/quizzes'
            });
        }
    } catch (err) {
        console.error('Notification error:', err);
    }

    return data;
};

export const updateQuiz = async (id, updates) => {
    const { data, error } = await supabase.from('quizzes').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
};

export const deleteQuiz = async (id) => {
    const { error } = await supabase.from('quizzes').delete().eq('id', id);
    if (error) throw error;
};


export const getQuizAttempts = async () => {
    const { data, error } = await supabase.from('quiz_attempts').select('*').order('completed_at', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const getQuizAttemptsByUser = async (userId) => {
    const { data, error } = await supabase.from('quiz_attempts').select('*').eq('user_id', userId).order('completed_at', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const createQuizAttempt = async (attempt) => {
    const { data, error } = await supabase.from('quiz_attempts').insert(attempt).select().single();
    if (error) throw error;
    return data;
};

// ============================================
// INVITE CODES
// ============================================
export const getInviteCodes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await supabase.from('profiles').select('classroom_id').eq('id', user.id).single();
    if (!profile?.classroom_id) return [];

    const { data, error } = await supabase.from('invite_codes')
        .select('*')
        .eq('classroom_id', profile.classroom_id)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

export const createInviteCode = async (codeData, targetClassroomId) => {
    const { data: { user } } = await supabase.auth.getUser();

    // Use passed classroomId or fallback to user's current one
    let classroomId = targetClassroomId;
    if (!classroomId) {
        const { data: profile } = await supabase.from('profiles').select('classroom_id').eq('id', user.id).single();
        classroomId = profile?.classroom_id;
    }

    const { data, error } = await supabase.from('invite_codes').insert({
        code: codeData,
        classroom_id: classroomId,
        created_by: user.id
    }).select().single();

    if (error) throw error;
    return data;
};

export const deleteInviteCode = async (id) => {
    const { error } = await supabase.from('invite_codes').delete().eq('id', id);
    if (error) throw error;
    return true;
};

export const validateInviteCode = async (code) => {
    const { data, error } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('code', code)
        .eq('is_used', false)
        .single();

    if (error) return null;
    return data;
};

export const useInviteCode = async (code, userId) => {
    const { error } = await supabase
        .from('invite_codes')
        .update({ is_used: true, used_by: userId })
        .eq('code', code);

    if (error) throw error;
    return true;
};

// ============================================
// NOTIFICATIONS
// ============================================
export const getNotifications = async (userId) => {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) throw error;
    return data || [];
};

export const getUnreadNotificationCount = async (userId) => {
    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

    if (error) return 0;
    return count;
};

export const markNotificationRead = async (id) => {
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

    if (error) throw error;
    return true;
};

export const markAllNotificationsRead = async (userId) => {
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

    if (error) throw error;
    return true;
};

export const createNotification = async (notification) => {
    const { error } = await supabase.from('notifications').insert(notification);
    if (error) console.error('Error creating notification:', error);
};

export const notifyClassroom = async (classroomId, notification) => {
    // 1. Get all students in classroom
    const { data: students } = await supabase
        .from('profiles')
        .select('id')
        .eq('classroom_id', classroomId)
        .eq('role', 'member'); // Only notify students

    if (!students || students.length === 0) return;

    // 2. Prepare bulk insert
    const notifications = students.map(student => ({
        user_id: student.id,
        classroom_id: classroomId,
        title: notification.title,
        message: notification.message,
        type: notification.type || 'info',
        link: notification.link,
        is_read: false
    }));

    // 3. Insert
    const { error } = await supabase.from('notifications').insert(notifications);
    if (error) console.error('Error sending classroom notifications:', error);
};

export const notifyAdmins = async (classroomId, notification) => {
    // 1. Get all admins in classroom
    const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('classroom_id', classroomId)
        .eq('role', 'admin');

    if (!admins || admins.length === 0) return;

    // 2. Prepare bulk insert
    const notifications = admins.map(admin => ({
        user_id: admin.id,
        classroom_id: classroomId,
        title: notification.title,
        message: notification.message,
        type: notification.type || 'info', // 'info', 'warning', 'success', 'error'
        link: notification.link,
        is_read: false
    }));

    // 3. Insert
    const { error } = await supabase.from('notifications').insert(notifications);
    if (error) console.error('Error notifying admins:', error);
};

// ============================================
// DEADLINE CHECKER
// ============================================
export const checkDeadlines = async (userId) => {
    // Get tasks due in next 24h
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Simple query: tasks in my classroom, due > now, due < tomorrow
    const { data: profile } = await supabase.from('profiles').select('classroom_id').eq('id', userId).single();
    if (!profile?.classroom_id) return;

    const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('classroom_id', profile.classroom_id)
        .gt('due_date', new Date().toISOString())
        .lt('due_date', tomorrow.toISOString());

    if (!tasks || tasks.length === 0) return;

    // For each task, check if we already notified this user about expiration
    // We don't have a perfect "already notified" flag, but we can query standard notifications
    // Optimization: Just check top 10 recent notifications
    const { data: recentNotifs } = await supabase
        .from('notifications')
        .select('title')
        .eq('user_id', userId)
        .like('title', 'Deadline Approaching%')
        .limit(20);

    const notifiedTitles = new Set(recentNotifs?.map(n => n.title) || []);

    for (const task of tasks) {
        const title = `Deadline Approaching: ${task.title}`;
        if (!notifiedTitles.has(title)) {
            // Need to create one
            await createNotification({
                user_id: userId,
                classroom_id: profile.classroom_id,
                title: title,
                message: `Task "${task.title}" is due in less than 24 hours!`,
                type: 'warning',
                link: `/tasks`
            });
        }
    }
};

// ============================================
// CLASSROOMS
// ============================================
export const getClassroom = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase.from('profiles').select('classroom_id').eq('id', user.id).single();
    if (!profile?.classroom_id) return null;

    const { data, error } = await supabase.from('classrooms').select('*').eq('id', profile.classroom_id).single();
    if (error) return null;
    return data;
};

export const getClassrooms = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase.from('classrooms').select('*').order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

export const createClassroom = async (name, description) => {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase.from('classrooms').insert({
        name,
        description,
        created_by: user.id
    }).select().single();

    if (error) throw error;
    return data;
};

export const updateClassroom = async (id, updates) => {
    const { data, error } = await supabase.from('classrooms').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
};

export const switchClassroom = async (classroomId) => {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase.from('profiles').update({
        classroom_id: classroomId
    }).eq('id', user.id).select().single();

    if (error) throw error;
    return data;
};

// ============================================
// ADMIN CLASSROOM DATA (CONTEXTLESS)
// ============================================
export const getClassroomById = async (id) => {
    const { data, error } = await supabase.from('classrooms').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
};

export const getMembersByClassroom = async (classroomId) => {
    const { data, error } = await supabase.from('profiles')
        .select('*')
        .eq('classroom_id', classroomId)
        .order('xp', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const getTasksByClassroom = async (classroomId) => {
    const { data, error } = await supabase.from('tasks')
        .select('*')
        .eq('classroom_id', classroomId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const getSubmissionsByClassroom = async (classroomId) => {
    const { data, error } = await supabase.from('submissions')
        .select('*, tasks!inner(*), profiles(*)')
        .eq('tasks.classroom_id', classroomId)
        .order('submitted_at', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const getClassroomStats = async (classroomId) => {
    try {
        const [members, tasks, submissions] = await Promise.all([
            getMembersByClassroom(classroomId),
            getTasksByClassroom(classroomId),
            getSubmissionsByClassroom(classroomId)
        ]);

        const approvedCount = submissions.filter(s => s.status === 'approved').length;
        const totalPoints = tasks.reduce((sum, t) => sum + (t.points || 0), 0);
        const earnedPoints = members.reduce((sum, m) => sum + (m.xp || 0), 0);

        return {
            memberCount: members.length,
            taskCount: tasks.length,
            submissionCount: submissions.length,
            approvedCount,
            totalPoints,
            earnedPoints,
            avgCompletion: members.length > 0 ? (approvedCount / (members.length * (tasks.length || 1))) * 100 : 0
        };
    } catch (error) {
        console.error('Error fetching classroom stats:', error);
        return null;
    }
};

// ============================================
// GLOBAL ADMIN DATA (ALL CLASSROOMS)
// ============================================
export const getAllMembers = async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const getAllTasks = async () => {
    const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const getAllSubmissions = async () => {
    const { data, error } = await supabase.from('submissions')
        .select('*, tasks(*), profiles(*)')
        .order('submitted_at', { ascending: false });
    if (error) throw error;
    return data || [];
};

// ============================================
// ANNOUNCEMENTS
// ============================================
export const getAnnouncementsByClassroom = async (classroomId) => {
    const { data, error } = await supabase.from('announcements')
        .select('*, profiles(*)')
        .eq('classroom_id', classroomId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

export const createAnnouncement = async (announcement) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('announcements')
        .insert({
            ...announcement,
            created_by: user.id
        })
        .select('*, profiles(*)')
        .single();

    if (error) throw error;

    // Notify students
    try {
        await notifyClassroom(announcement.classroom_id, {
            title: 'New Announcement',
            message: `A new announcement was posted in your classroom.`,
            type: 'info',
            link: `/dashboard`
        });
    } catch (err) {
        console.error('Notification error:', err);
    }

    return data;
};
