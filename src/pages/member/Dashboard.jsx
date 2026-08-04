import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, Badge, Avatar, Button, ProgressBar } from '../../components/common';
import { supabase } from '../../lib/supabase';
import { ProgressRing } from '../../components/common/Progress';
import {
    ListTodo,
    HelpCircle,
    Trophy,
    Award,
    Target,
    Flame,
    Clock,
    ArrowRight,
    CheckCircle,
    Star,
    Zap,
    Calendar,
    Lock,
    Unlock
} from 'lucide-react';
import * as db from '../../services/database';
import {
    formatDate,
    formatDeadline,
    formatRelativeTime,
    getDifficultyColor,
    getStatusColor
} from '../../utils/constants';
import { useMiniReload } from '../../hooks/useMiniReload';

const MemberDashboard = () => {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        assignedTasks: 0,
        completedTasks: 0,
        pendingQuizzes: 0,
        totalXP: 0
    });
    const [activeTasks, setActiveTasks] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [upcomingQuizzes, setUpcomingQuizzes] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sprintWeek, setSprintWeek] = useState(null); // { weekNum, title, start_date, end_date, isLocked }

    const loadDashboardData = useCallback(async (silent = false) => {
        if (!user?.id) return;

        try {
            if (!silent) setLoading(true);

            // Robust timeout protection
            const fetchPromise = Promise.all([
                db.getTasks().catch(err => { console.error('Error loading tasks:', err); return []; }),
                db.getSubmissionsByUser(user.id).catch(err => { console.error('Error loading submissions:', err); return []; }),
                db.getQuizzes().catch(err => { console.error('Error loading quizzes:', err); return []; }),
                db.getQuizAttemptsByUser(user.id).catch(err => { console.error('Error loading quiz attempts:', err); return []; }),
                db.getAnnouncements().catch(err => { console.error('Error loading announcements:', err); return []; }),
                refreshUser().catch(err => { console.error('Error refreshing user on load:', err); })
            ]);

            const [tasks, submissions, quizzes, quizAttempts, ann] = await Promise.race([
                fetchPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000))
            ]);

            // Get tasks assigned to current user (or global tasks)
            const myTasks = (tasks || []).filter(t => !t.assigned_to || t.assigned_to.length === 0 || t.assigned_to.includes(user.id));
            const completedTaskIds = (submissions || []).filter(s => s.status === 'approved').map(s => s.task_id);
            const pendingTaskIds = (submissions || []).map(s => s.task_id);

            // Calculate actual XP from history
            const taskXP = (submissions || [])
                .filter(s => s.status === 'approved' && s.score !== null)
                .reduce((sum, s) => {
                    const points = s.tasks?.points ?? 100;
                    return sum + Math.round((s.score / 100) * points);
                }, 0);

            const quizXP = (quizAttempts || [])
                .filter(a => a.metadata?.finalized === true)
                .reduce((sum, a) => sum + (a.xp_earned || a.metadata?.xp_earned || 0), 0);

            const calculatedTotal = taskXP + quizXP;

            // Automatically correct/sync database XP if there is a mismatch
            if (user?.xp !== undefined && user.xp !== calculatedTotal) {
                console.log(`[XP Sync] Correcting profile XP from ${user.xp} to match history total of ${calculatedTotal}`);
                db.updateProfile(user.id, { xp: calculatedTotal }).catch(err => {
                    console.error('[XP Sync] Database update failed:', err);
                });
                refreshUser().catch(err => {
                    console.error('[XP Sync] Context refresh failed:', err);
                });
            }

            // Stats
            setStats({
                assignedTasks: myTasks.length,
                completedTasks: completedTaskIds.length,
                pendingQuizzes: (quizzes || []).filter(q =>
                    !(quizAttempts || []).some(a => a.quiz_id === q.id)
                ).length,
                totalXP: calculatedTotal
            });

            // Active tasks (not yet submitted)
            const active = myTasks
                .filter(t => !pendingTaskIds.includes(t.id))
                .slice(0, 3);
            setActiveTasks(active);

            // Combine Tasks and Quizzes for Recent Activity
            const combinedActivity = [
                ...(submissions || []).map(s => ({
                    id: s.id,
                    type: 'task',
                    title: s.tasks?.title || 'Task Submission',
                    status: s.status,
                    score: s.score,
                    date: s.submitted_at
                })),
                ...(quizAttempts || []).map(a => ({
                    id: a.id,
                    type: 'quiz',
                    title: a.quizzes?.title || 'Quiz Attempt',
                    status: a.passed ? 'approved' : 'rejected',
                    score: a.score,
                    date: a.completed_at || a.created_at
                }))
            ]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

            setRecentActivity(combinedActivity);

            // Upcoming quizzes
            const upcoming = (quizzes || [])
                .filter(q =>
                    !(quizAttempts || []).some(a => a.quiz_id === q.id)
                )
                .slice(0, 3);
            setUpcomingQuizzes(upcoming);
            setAnnouncements(ann || []);

            // Sprint current-week card
            if (user?.classroom_id) {
                try {
                    const today = new Date();
                    const todayStr = today.toISOString().split('T')[0];

                    // Find the week whose date window contains today
                    const { data: templates } = await supabase
                        .from('sprint_templates')
                        .select('week_number, title, start_date, end_date')
                        .eq('classroom_id', user.classroom_id)
                        .order('week_number', { ascending: true });

                    if (templates && templates.length > 0) {
                        // Find week that contains today
                        let activeWeek = templates.find(w =>
                            w.start_date && w.end_date &&
                            todayStr >= w.start_date && todayStr <= w.end_date
                        );
                        // Fallback: most recent week by start_date before today
                        if (!activeWeek) {
                            const past = templates.filter(w => w.start_date && w.start_date <= todayStr);
                            activeWeek = past[past.length - 1] || templates[0];
                        }

                        if (activeWeek) {
                            const { data: lockRow } = await supabase
                                .from('sprint_locks')
                                .select('is_locked')
                                .eq('classroom_id', user.classroom_id)
                                .eq('week_number', activeWeek.week_number)
                                .maybeSingle();

                            const startIso = activeWeek.start_date ? (activeWeek.start_date.includes('T') ? activeWeek.start_date : `${activeWeek.start_date}T00:00:00`) : null;
                            const endIso = activeWeek.end_date ? (activeWeek.end_date.includes('T') ? activeWeek.end_date : `${activeWeek.end_date}T23:59:59`) : null;
                            const now = new Date();
                            const startDt = startIso ? new Date(startIso) : null;
                            const endDt = endIso ? new Date(endIso) : null;

                            let isStarted = false;
                            let isEnded = false;
                            let timerText = '';
                            let statusLabel = 'INACTIVE';

                            if (startDt && now < startDt) {
                                isStarted = false;
                                isEnded = false;
                                statusLabel = 'INACTIVE';
                                const diff = startDt - now;
                                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                const parts = [];
                                if (days > 0) parts.push(`${days}d`);
                                if (hours > 0 || days > 0) parts.push(`${hours}h`);
                                parts.push(`${minutes}m`);
                                timerText = `Will start in ${parts.join(' ')}`;
                            } else if (endDt && now > endDt) {
                                isStarted = true;
                                isEnded = true;
                                statusLabel = 'ENDED';
                                timerText = 'Time Ended';
                            } else if (endDt && now <= endDt) {
                                isStarted = true;
                                isEnded = false;
                                statusLabel = 'ACTIVE';
                                const diff = endDt - now;
                                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                const parts = [];
                                if (days > 0) parts.push(`${days}d`);
                                if (hours > 0 || days > 0) parts.push(`${hours}h`);
                                parts.push(`${minutes}m`);
                                timerText = `Will end in ${parts.join(' ')}`;
                            }

                            if (isStarted && !isEnded) {
                                db.notifySprintWeekStart(user.classroom_id, activeWeek.week_number, activeWeek.title);
                            }

                            const isLocked = lockRow ? lockRow.is_locked : (!isStarted || isEnded);

                            setSprintWeek({
                                weekNum: activeWeek.week_number,
                                title: activeWeek.title,
                                start_date: activeWeek.start_date,
                                end_date: activeWeek.end_date,
                                isLocked,
                                isStarted,
                                isEnded,
                                timerText,
                                statusLabel
                            });
                        }
                    }
                } catch (e) {
                    console.error('[Dashboard] Sprint week fetch error:', e);
                }
            }
        } catch (error) {
            console.error('[Dashboard] Error loading dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    // MINI RELOAD: Listen for global refresh events
    useMiniReload(() => loadDashboardData(false));

    useEffect(() => {
        if (user?.id) {
            loadDashboardData(true);

            // GOD COMMAND: REALTIME UPDATES
            const channel = supabase
                .channel(`dashboard-${user.id}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
                    loadDashboardData(true);
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions', filter: `user_id=eq.${user.id}` }, () => {
                    loadDashboardData(true);
                    refreshUser(); // Update XP if approved
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_attempts', filter: `user_id=eq.${user.id}` }, () => {
                    loadDashboardData(true);
                    refreshUser(); // Update XP if passed
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, () => {
                    refreshUser();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [loadDashboardData, user?.id, refreshUser]);

    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div className="animate-fade-in" style={{ paddingBottom: 'var(--space-2xl)' }}>
            {/* Welcome Header */}
            <div style={{ marginBottom: 'var(--space-xl)' }}>
                <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-xs)' }}>
                    Welcome back, {user?.name?.split(' ')[0]}! 🚀
                </h2>
                <p style={{ color: 'var(--text-muted)' }}>
                    Keep up the great work! You're making excellent progress.
                </p>
            </div>

            {/* No Classroom Warning */}
            {!user?.classroom_id && !user?.is_global_admin && (
                <Card style={{ marginBottom: 'var(--space-xl)', borderColor: 'var(--warning-500)', background: 'rgba(245, 158, 11, 0.1)' }}>
                    <div className="flex items-center gap-md">
                        <div style={{ padding: 'var(--space-sm)', background: 'var(--warning-500)', borderRadius: '50%', color: 'white' }}>
                            <HelpCircle size={24} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>No Classroom Assigned</h3>
                            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
                                You are not currently assigned to any classroom. You won't see any tasks or quizzes until an admin adds you to a classroom.
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            {/* Achievements Card - Replaces Level Card */}
            <Link to="/xp-history" style={{ textDecoration: 'none' }}>
                <Card
                    variant="gradient"
                    style={{
                        marginBottom: 'var(--space-xl)',
                        background: 'var(--gradient-primary)',
                        color: 'white',
                        position: 'relative',
                        overflow: 'hidden',
                        cursor: 'pointer'
                    }}
                >
                    <div style={{
                        position: 'absolute',
                        right: '-50px',
                        top: '-50px',
                        width: '200px',
                        height: '200px',
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '50%'
                    }} />

                    <div className="flex justify-center items-center" style={{ position: 'relative', height: '100%' }}>
                        <div className="flex flex-col items-center gap-md">
                            <div style={{
                                width: '80px',
                                height: '80px',
                                background: 'rgba(255,255,255,0.2)',
                                borderRadius: 'var(--radius-xl)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '40px',
                                marginBottom: 'var(--space-sm)'
                            }}>
                                🏆
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700, color: '#ffffff', letterSpacing: '0.02em' }}>
                                    Total XP Earned
                                </p>
                                <h2 style={{ margin: '4px 0 0', fontSize: 'var(--text-5xl)', fontWeight: 900, color: '#ffffff', textShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>
                                    {user?.xp || 0} XP
                                </h2>
                                <p style={{ margin: 'var(--space-xs) 0 0', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'rgba(255, 255, 255, 0.95)', textShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
                                    Click to view history →
                                </p>
                            </div>
                        </div>
                    </div>
                </Card>
            </Link>

            {/* Sprint Week Card */}
            {sprintWeek && (
                <div
                    onClick={() => navigate('/sprint-tracker')}
                    style={{
                        marginBottom: 'var(--space-xl)',
                        padding: 'var(--space-md) var(--space-lg)',
                        borderRadius: 'var(--radius-xl)',
                        background: sprintWeek.isLocked
                            ? 'linear-gradient(135deg, rgba(100,116,139,0.15), rgba(71,85,105,0.1))'
                            : 'linear-gradient(135deg, rgba(16,185,129,0.14), rgba(5,150,105,0.08))',
                        border: `1px solid ${sprintWeek.isLocked ? 'rgba(100,116,139,0.3)' : 'rgba(16,185,129,0.35)'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 'var(--space-md)',
                        flexWrap: 'wrap',
                        transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', minWidth: 0 }}>
                        {/* Icon */}
                        <div style={{
                            width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                            background: sprintWeek.isLocked ? 'rgba(100,116,139,0.2)' : 'rgba(16,185,129,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: sprintWeek.isLocked ? 'var(--text-muted)' : '#10b981'
                        }}>
                            <Zap size={22} />
                        </div>
                        {/* Text */}
                        <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: sprintWeek.isStarted && !sprintWeek.isEnded ? '#10b981' : 'var(--text-muted)' }}>
                                    Sprint · Week {sprintWeek.weekNum}
                                </span>
                                {sprintWeek.isStarted && !sprintWeek.isEnded && (
                                    <span style={{
                                        padding: '1px 6px',
                                        borderRadius: '999px',
                                        background: 'rgba(16, 185, 129, 0.2)',
                                        color: '#10b981',
                                        fontSize: '9px',
                                        fontWeight: 800,
                                        letterSpacing: '0.04em'
                                    }}>
                                        🟢 ACTIVE
                                    </span>
                                )}
                                {!sprintWeek.isStarted && (
                                    <span style={{
                                        padding: '1px 6px',
                                        borderRadius: '999px',
                                        background: 'rgba(245, 158, 11, 0.2)',
                                        color: '#f59e0b',
                                        fontSize: '9px',
                                        fontWeight: 800,
                                        letterSpacing: '0.04em'
                                    }}>
                                        ⏳ INACTIVE
                                    </span>
                                )}
                                {sprintWeek.isEnded && (
                                    <span style={{
                                        padding: '1px 6px',
                                        borderRadius: '999px',
                                        background: 'rgba(100, 116, 139, 0.2)',
                                        color: 'var(--text-muted)',
                                        fontSize: '9px',
                                        fontWeight: 700
                                    }}>
                                        🔒 ENDED
                                    </span>
                                )}
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {sprintWeek.title}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '2px', flexWrap: 'wrap' }}>
                                {(sprintWeek.start_date || sprintWeek.end_date) && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Calendar size={11} />
                                        <span>{sprintWeek.start_date ? new Date(sprintWeek.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</span>
                                        <span>→</span>
                                        <span>{sprintWeek.end_date ? new Date(sprintWeek.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</span>
                                    </div>
                                )}
                                {sprintWeek.timerText && !sprintWeek.isEnded && (
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '1px 7px',
                                        borderRadius: '6px',
                                        background: sprintWeek.isStarted ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                                        color: sprintWeek.isStarted ? '#10b981' : '#f59e0b',
                                        fontSize: '11px',
                                        fontWeight: 700
                                    }}>
                                        <Clock size={11} className="animate-spin-slow" />
                                        ⏳ {sprintWeek.timerText}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Status + Arrow */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexShrink: 0 }}>
                        <span style={{
                            display: 'flex', alignItems: 'center', gap: '5px',
                            fontSize: 'var(--text-xs)', fontWeight: 700,
                            padding: '4px 10px', borderRadius: '20px',
                            background: sprintWeek.isLocked ? 'rgba(100,116,139,0.2)' : 'rgba(16,185,129,0.15)',
                            color: sprintWeek.isLocked ? 'var(--text-muted)' : '#10b981',
                        }}>
                            {sprintWeek.isLocked ? <><Lock size={11} /> Locked</> : <><Unlock size={11} /> Open</>}
                        </span>
                        <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
                    </div>
                </div>
            )}

            {/* Quick Stats */}
            <div className="stat-card-grid mb-xl">
                {[
                    { label: 'Assigned Tasks', value: stats.assignedTasks, icon: ListTodo, color: 'var(--primary-500)' },
                    { label: 'Completed Tasks', value: stats.completedTasks, icon: CheckCircle, color: 'var(--success-500)' },
                    { label: 'Pending Quizzes', value: stats.pendingQuizzes, icon: HelpCircle, color: 'var(--warning-500)' },
                    { label: 'Total XP', value: (user?.xp || 0).toLocaleString(), icon: Award, color: 'var(--accent-500)' }
                ].map((stat, index) => (
                    <Card key={index} style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        textAlign: 'center', 
                        padding: 'var(--space-md)',
                        height: '100%',
                        minHeight: '110px'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '100%' }}>
                            <stat.icon
                                size={20}
                                style={{ color: stat.color }}
                            />
                            <h3 style={{
                                fontSize: 'var(--text-xl)',
                                margin: 0,
                                lineHeight: 1.2
                            }}>
                                {stat.value}
                            </h3>
                        </div>
                        <p style={{
                            fontSize: '10px',
                            color: 'var(--text-muted)',
                            margin: '8px 0 0',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                            lineHeight: 1.2,
                            minHeight: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%'
                        }}>
                            {stat.label}
                        </p>
                    </Card>
                ))}
            </div>

            {/* Announcements Section */}
            {announcements.length > 0 && (
                <div style={{ marginBottom: 'var(--space-xl)' }}>
                    <div className="flex justify-between items-center mb-md">
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Badge variant="primary" style={{ padding: '4px' }}><Star size={14} /></Badge>
                            Announcements
                        </h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        {announcements.slice(0, 2).map(ann => (
                            <Card key={ann.id} style={{ borderLeft: '4px solid var(--primary-500)', background: 'var(--surface)' }}>
                                <div className="flex gap-md">
                                    <Avatar name={ann.profiles?.name} image={ann.profiles?.avatar_url} size="sm" />
                                    <div style={{ flex: 1 }}>
                                        <div className="flex justify-between items-center mb-xs">
                                            <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{ann.profiles?.name || 'Admin'}</span>
                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{formatRelativeTime(ann.created_at)}</span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>{ann.content}</p>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Grid */}
            <div className="dashboard-grid">
                {/* Active Tasks */}
                <Card>
                    <div className="flex justify-between items-center mb-lg">
                        <h3 style={{ margin: 0 }}>
                            <Target size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            Active Tasks
                        </h3>
                        <Link to="/tasks">
                            <Button variant="ghost" size="sm" icon={ArrowRight} iconPosition="right">
                                View All
                            </Button>
                        </Link>
                    </div>

                    {activeTasks.length === 0 ? (
                        <div className="empty-state" style={{ padding: 'var(--space-lg)' }}>
                            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                                No active tasks. Great job! 🎉
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                            {activeTasks.map(task => (
                                <Link key={task.id} to={`/tasks/${task.id}`} style={{ textDecoration: 'none' }}>
                                    <div style={{
                                        padding: 'var(--space-md)',
                                        background: 'var(--surface)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border)',
                                        transition: 'all var(--transition-fast)'
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary-500)'}
                                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                                    >
                                        <div className="flex justify-between items-start mb-sm">
                                            <h4 style={{ margin: 0, fontSize: 'var(--text-sm)' }}>{task.title}</h4>
                                            <Badge variant={getDifficultyColor(task.difficulty)} style={{ flexShrink: 0 }}>
                                                {task.difficulty}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-md" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                            <span><Award size={12} /> {task.points} pts</span>
                                            {task.deadline && (
                                                <span><Clock size={12} /> Due {formatDeadline(task.deadline)}</span>
                                            )}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Upcoming Quizzes */}
                <Card>
                    <div className="flex justify-between items-center mb-lg">
                        <h3 style={{ margin: 0 }}>
                            <HelpCircle size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            Pending Quizzes
                        </h3>
                        <Link to="/quizzes">
                            <Button variant="ghost" size="sm" icon={ArrowRight} iconPosition="right">
                                View All
                            </Button>
                        </Link>
                    </div>

                    {upcomingQuizzes.length === 0 ? (
                        <div className="empty-state" style={{ padding: 'var(--space-lg)' }}>
                            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                                All quizzes completed! 🎓
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                            {upcomingQuizzes.map(quiz => (
                                <Link key={quiz.id} to={`/quizzes/${quiz.id}`} style={{ textDecoration: 'none' }}>
                                    <div style={{
                                        padding: 'var(--space-md)',
                                        background: 'var(--surface)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border)',
                                        transition: 'all var(--transition-fast)'
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary-500)'}
                                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                                    >
                                        <div className="flex justify-between items-start mb-sm">
                                            <h4 style={{ margin: 0, fontSize: 'var(--text-sm)' }}>{quiz.title}</h4>
                                            <Badge variant={getDifficultyColor(quiz.difficulty)} style={{ flexShrink: 0 }}>
                                                {quiz.difficulty}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-md" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                            <span><HelpCircle size={12} /> {quiz.questions?.length} questions</span>
                                            <span><Clock size={12} /> {quiz.time_limit} min</span>
                                            <span><Award size={12} /> {quiz.points} pts</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </Card>
            </div>

            {/* Recent Activity */}
            <Card style={{ marginTop: 'var(--space-lg)' }}>
                <h3 style={{ marginBottom: 'var(--space-md)' }}>
                    <Flame size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    Recent Activity
                </h3>

                {recentActivity.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>
                        No activity yet. Start completing tasks to see your progress here!
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        {recentActivity.map(activity => (
                            <div
                                key={`${activity.type}-${activity.id}`}
                                className="flex items-center gap-md"
                                style={{
                                    padding: 'var(--space-md)',
                                    background: 'var(--surface)',
                                    borderRadius: 'var(--radius-md)'
                                }}
                            >
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: 'var(--radius-md)',
                                    background: activity.status === 'approved'
                                        ? 'rgba(16, 185, 129, 0.1)'
                                        : activity.status === 'rejected'
                                            ? 'rgba(239, 68, 68, 0.1)'
                                            : 'rgba(245, 158, 11, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {activity.type === 'quiz' ? (
                                        <HelpCircle size={20} style={{ color: activity.status === 'approved' ? 'var(--success-500)' : 'var(--error-500)' }} />
                                    ) : activity.status === 'approved' ? (
                                        <CheckCircle size={20} style={{ color: 'var(--success-500)' }} />
                                    ) : activity.status === 'rejected' ? (
                                        <Target size={20} style={{ color: 'var(--error-500)' }} />
                                    ) : (
                                        <Clock size={20} style={{ color: 'var(--warning-500)' }} />
                                    )}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, fontWeight: 500, fontSize: 'var(--text-sm)' }}>
                                        {activity.title}
                                    </p>
                                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                        {activity.type === 'quiz' 
                                            ? `${activity.status === 'approved' ? 'Passed' : 'Failed'} with ${activity.score}%`
                                            : activity.status === 'approved' && activity.score
                                                ? `Approved with ${activity.score}/100`
                                                : activity.status === 'pending'
                                                    ? 'Awaiting review'
                                                    : 'Revision requested'}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <Badge variant={activity.type === 'quiz' ? (activity.status === 'approved' ? 'success' : 'error') : getStatusColor(activity.status)}>
                                        {activity.type === 'quiz' ? (activity.status === 'approved' ? 'Passed' : 'Failed') : activity.status}
                                    </Badge>
                                    <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                        {formatRelativeTime(activity.date)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

        </div>
    );
};

export default MemberDashboard;
