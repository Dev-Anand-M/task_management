import { supabase as supabaseClient } from '../lib/supabase';
export const supabase = supabaseClient;

// ============================================
// PROFILES
// ============================================
// Helper for safe user retrieval to avoid hangs
const getActiveUser = async () => {
    try {
        // Try session first (fast, local)
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) return session.user;
        
        // Fallback to getUser without aggressive timeout
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    } catch (e) {
        console.error('getActiveUser failed:', e);
        return null;
    }
};

// GLOBAL QUERY TIMEOUT WRAPPER (increased for reliability)
export const withTimeout = async (promise, ms = 30000) => {
    const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('DATABASE_TIMEOUT')), ms)
    );
    return Promise.race([promise, timeout]);
};

export const getMembers = async () => {
    try {
        // Filter by current classroom
        const user = await getActiveUser();

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
    try {
        const { data, error } = await withTimeout(supabase.from('profiles').select('*').eq('id', id).single(), 10000);
        if (error) return null;
        return data;
    } catch (err) {
        console.error('Error in getProfileById:', err);
        return null;
    }
};

export const updateProfile = async (id, updates) => {
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
};

export const uploadAvatar = async (userId, file) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

    if (uploadError) {
        throw uploadError;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return data.publicUrl;
};

export const uploadStudyMaterial = async (file) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `materials/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('study_materials')
        .upload(filePath, file, { upsert: true });

    if (uploadError) {
        throw uploadError;
    }

    const { data } = supabase.storage.from('study_materials').getPublicUrl(filePath);
    return data.publicUrl;
};

// ============================================
// TASKS
// ============================================
export const getTasks = async () => {
    const user = await getActiveUser();
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

    const { data, error } = await withTimeout(query);
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
    const user = await getActiveUser();
    if (!user) throw new Error('Authentication required');
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
        if (task.assignment_type === 'specific' && task.assigned_to?.length > 0) {
            // Notify specific assigned students
            const notifications = task.assigned_to.map(studentId => ({
                user_id: studentId,
                classroom_id: classroomId,
                title: '📋 New Task Assigned',
                message: `You have been assigned: "${task.title}"`,
                type: 'info',
                link: `/tasks/${data.id}`,
                is_read: false
            }));

            const { error: notifError } = await supabase.from('notifications').insert(notifications);
            if (notifError) console.error('Error creating notifications:', notifError);

            // Trigger push notifications for assigned users
            const userIds = task.assigned_to.filter(Boolean);

            if (userIds.length > 0) {
                console.log(`[Push] Sending task assignment notification to ${userIds.length} users`);
                fetch(`${window.location.origin}/api/push`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_ids: userIds,
                        title: '📋 New Task Assigned',
                        body: `You have been assigned: "${task.title}"`,
                        link: `/tasks/${data.id}`
                    })
                }).catch(e => console.warn('[Push] Error:', e));
            }
        } else if (task.is_global) {
            // Notify current classroom for global tasks
            if (classroomId) {
                await notifyClassroom(classroomId, {
                    title: '🌍 New Global Task Posted',
                    message: `A new task "${task.title}" is now available to everyone.`,
                    type: 'info',
                    link: `/tasks/${data.id}`
                });
            }
        } else if (classroomId) {
            // Notify entire classroom
            await notifyClassroom(classroomId, {
                title: '📋 New Task Posted',
                message: `A new task "${task.title}" is now available.`,
                type: 'info',
                link: `/tasks/${data.id}`
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
    const user = await getActiveUser();
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

    const { data, error } = await withTimeout(query);
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
    const user = await getActiveUser();
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
            
            if (isGlobal) return true;
            if (quiz.assignment_type === 'specific') return isSpecificallyAssigned;
            return isInClassroom;
        });
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
    const user = await getActiveUser();
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
            
            const userIds = quiz.assigned_to.filter(Boolean);
            if (userIds.length > 0) {
                fetch(`${window.location.origin}/api/push`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_ids: userIds,
                        title: 'New Quiz Assigned',
                        body: `You have been specifically assigned the quiz: "${quiz.title}"`,
                        link: '/quizzes',
                        data: { type: 'warning' }
                    })
                }).catch(e => console.warn('[Push] Error:', e));
            }
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
    try {
        const user = await getActiveUser();
        if (!user) return [];

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        const isAdmin = profile?.role === 'admin';

        let query = supabase.from('quiz_attempts').select('*, profiles!left(name, avatar_url, email, classroom_id, xp), quizzes!left(title, points)');
        if (!isAdmin) query = query.eq('user_id', user.id);

        const { data, error } = await withTimeout(query.order('completed_at', { ascending: false }));
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error in getQuizAttempts:', err);
        return [];
    }
};

export const getQuizAttemptsByUser = async (userId) => {
    try {
        const { data, error } = await supabase
            .from('quiz_attempts')
            .select('*, quizzes!left(title, points)')
            .eq('user_id', userId)
            .order('completed_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error in getQuizAttemptsByUser:', err);
        return [];
    }
};

export const updateQuizAttempt = async (id, updates) => {
    const { data, error } = await supabase.from('quiz_attempts').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
};

export const createQuizAttempt = async (attempt) => {
    const { data, error } = await supabase.from('quiz_attempts').insert(attempt).select('*, quizzes(*), profiles(*)').single();
    if (error) throw error;

    try {
        const classroomId = data.quizzes?.classroom_id || data.profiles?.classroom_id;
        if (classroomId) {
            await notifyAdmins(classroomId, {
                title: 'New Quiz Attempt',
                message: `${data.profiles?.name || 'A student'} completed the quiz: "${data.quizzes?.title}"`,
                type: 'info',
                link: `/admin/evaluations/quizzes/${data.id}`
            });
        }
    } catch (err) {
        console.error('Error notifying admins on quiz attempt:', err);
    }
    return data;
};

// ============================================
// INVITE CODES
// ============================================
export const getInviteCodes = async (classroomId = null) => {
    try {
        const user = await getActiveUser();
        if (!user) return [];
        const { data: profile } = await supabase.from('profiles').select('classroom_id, role').eq('id', user.id).single();
        let query = supabase.from('invite_codes').select('*').order('created_at', { ascending: false });

        if (profile?.role !== 'admin') {
            const targetId = classroomId || profile?.classroom_id;
            if (!targetId) return [];
            query = query.eq('classroom_id', targetId);
        } else if (classroomId) {
            query = query.eq('classroom_id', classroomId);
        }

        const { data, error } = await withTimeout(query);
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error fetching invite codes:', err);
        return [];
    }
};

export const createInviteCode = async (codeData, targetClassroomId) => {
    try {
        const user = await getActiveUser();
        if (!user) throw new Error('Authentication required');
        let classroomId = targetClassroomId;
        const { data: profile } = await supabase.from('profiles').select('classroom_id, role').eq('id', user.id).single();
        if (!classroomId) classroomId = profile?.classroom_id;

        const { data, error } = await withTimeout(
            supabase.from('invite_codes').insert({
                code: codeData,
                classroom_id: classroomId,
                created_by: user.id
            }).select().single()
        );
        if (error) throw error;
        return data;
    } catch (err) {
        console.error('Error creating invite code:', err);
        throw err;
    }
};

export const deleteInviteCode = async (id) => {
    const { error } = await supabase.from('invite_codes').delete().eq('id', id);
    if (error) throw error;
    return true;
};

export const validateInviteCode = async (code) => {
    const { data, error } = await supabase.from('invite_codes').select('*').eq('code', code).eq('is_used', false).single();
    if (error) return null;
    return data;
};

export const useInviteCode = async (code, userId) => {
    const { error } = await supabase.from('invite_codes').update({ is_used: true, used_by: userId }).eq('code', code);
    if (error) throw error;
    return true;
};

// ============================================
// NOTIFICATIONS
// ============================================
export const getNotifications = async (userId) => {
    const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return data || [];
};

export const getUnreadNotificationCount = async (userId) => {
    const { count, error } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false);
    if (error) return 0;
    return count;
};

export const markNotificationRead = async (id) => {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    if (error) throw error;
    return true;
};

export const markAllNotificationsRead = async (userId) => {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    if (error) throw error;
    return true;
};

export const createNotification = async (notification) => {
    await supabase.from('notifications').insert(notification);
    if (notification.user_id) {
        // Get user's push subscription
        const { data: profile } = await supabase
            .from('profiles')
            .select('push_subscription')
            .eq('id', notification.user_id)
            .single();
        
        if (profile?.push_subscription) {
            fetch(`${window.location.origin}/api/native-push`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: profile.push_subscription,
                    title: notification.title,
                    body: notification.message,
                    url: notification.link || '/',
                    data: { type: notification.type }
                })
            }).catch(e => console.warn('[Push] Error:', e));
        }
    }
};

export const notifyClassroom = async (classroomId, notification) => {
    const { data: students } = await supabase.from('profiles').select('id, push_subscription').eq('classroom_id', classroomId).eq('role', 'member');
    if (!students || students.length === 0) return;

    const notifications = students.map(student => ({
        user_id: student.id,
        classroom_id: classroomId,
        title: notification.title,
        message: notification.message,
        type: notification.type || 'info',
        link: notification.link,
        is_read: false
    }));

    await supabase.from('notifications').insert(notifications);
    
    // Send push notifications to students who have subscriptions
    const pushPromises = students
        .filter(s => s.push_subscription)
        .map(student => 
            fetch(`${window.location.origin}/api/native-push`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: student.push_subscription,
                    title: notification.title,
                    body: notification.message,
                    url: notification.link || '/',
                    data: { type: notification.type }
                })
            }).catch(e => console.warn('[Push] Error:', e))
        );
    
    await Promise.allSettled(pushPromises);
};

export const notifyAdmins = async (classroomId, notification) => {
    const { data: admins } = await supabase.from('profiles').select('id, push_subscription').eq('classroom_id', classroomId).eq('role', 'admin');
    if (!admins || admins.length === 0) return;

    const notifications = admins.map(admin => ({
        user_id: admin.id,
        classroom_id: classroomId,
        title: notification.title,
        message: notification.message,
        type: notification.type || 'info',
        link: notification.link,
        is_read: false
    }));

    await supabase.from('notifications').insert(notifications);
    
    // Send push notifications to admins who have subscriptions
    const pushPromises = admins
        .filter(a => a.push_subscription)
        .map(admin => 
            fetch(`${window.location.origin}/api/native-push`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: admin.push_subscription,
                    title: notification.title,
                    body: notification.message,
                    url: notification.link || '/',
                    data: { type: notification.type }
                })
            }).catch(e => console.warn('[Push] Error:', e))
        );
    
    await Promise.allSettled(pushPromises);
};

export const checkDeadlines = async (userId) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const { data: profile } = await supabase.from('profiles').select('classroom_id').eq('id', userId).single();
    if (!profile?.classroom_id) return;

    const { data: tasks } = await supabase.from('tasks').select('*').eq('classroom_id', profile.classroom_id).gt('due_date', new Date().toISOString()).lt('due_date', tomorrow.toISOString());
    if (!tasks || tasks.length === 0) return;

    for (const task of tasks) {
        await createNotification({
            user_id: userId,
            classroom_id: profile.classroom_id,
            title: `Deadline Approaching: ${task.title}`,
            message: `Task "${task.title}" is due in less than 24 hours!`,
            type: 'warning',
            link: `/tasks`
        });
    }
};

// ============================================
// CLASSROOMS
// ============================================
export const getClassroom = async () => {
    const user = await getActiveUser();
    if (!user) return null;
    const { data: profile } = await supabase.from('profiles').select('classroom_id').eq('id', user.id).single();
    if (!profile?.classroom_id) return null;
    const { data } = await supabase.from('classrooms').select('*').eq('id', profile.classroom_id).single();
    return data;
};

export const getClassrooms = async () => {
    const { data, error } = await supabase.from('classrooms').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const createClassroom = async (name, description) => {
    const user = await getActiveUser();
    const { data, error } = await supabase.from('classrooms').insert({ name, description, created_by: user.id }).select().single();
    if (error) throw error;
    return data;
};

export const switchClassroom = async (classroomId) => {
    const user = await getActiveUser();
    const { data, error } = await supabase.from('profiles').update({ classroom_id: classroomId }).eq('id', user.id).select().single();
    if (error) throw error;
    return data;
};

// ============================================
// ANNOUNCEMENTS
// ============================================
export const getAnnouncements = async () => {
    const user = await getActiveUser();
    if (!user) return [];
    const { data: profile } = await supabase.from('profiles').select('classroom_id, role').eq('id', user.id).single();
    let query = supabase.from('announcements').select('*, profiles(*)').order('created_at', { ascending: false });
    if (profile?.classroom_id) query = query.eq('classroom_id', profile.classroom_id);
    const { data } = await query.limit(20);
    return data || [];
};

export const createAnnouncement = async (announcement) => {
    const user = await getActiveUser();
    const { data, error } = await supabase.from('announcements').insert({ ...announcement, created_by: user.id }).select('*, profiles(*)').single();
    if (error) throw error;
    await notifyClassroom(announcement.classroom_id, { title: 'New Announcement', message: announcement.content.substring(0, 50), type: 'info', link: '/dashboard' });
    return data;
};

// ============================================
// KNOWLEDGE BASE & NOTES
// ============================================
export const getKnowledgeBase = async (classroomId = null) => {
    let query = supabase.from('knowledge_base').select('*').order('created_at', { ascending: false });
    if (classroomId) query = query.eq('classroom_id', classroomId);
    const { data } = await query;
    return data || [];
};

export const getStudyNotes = async (userId) => {
    const { data } = await supabase.from('study_notes').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
    return data || [];
};

export const addStudyNote = async (note) => {
    const user = await getActiveUser();
    const { data, error } = await supabase.from('study_notes').insert({ user_id: user.id, ...note }).select().single();
    if (error) throw error;
    return data;
};

export const updateStudyNote = async (id, updates) => {
    const { data, error } = await supabase.from('study_notes').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw error;
    return data;
};

export const deleteStudyNote = async (id) => {
    await supabase.from('study_notes').delete().eq('id', id);
    return true;
};
