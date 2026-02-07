import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, Badge, Avatar, Button, ProgressBar } from '../../components/common';
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
    Star
} from 'lucide-react';
import * as db from '../../services/database';
import {
    formatDate,
    formatRelativeTime,
    getDifficultyColor,
    getStatusColor
} from '../../utils/constants';

const MemberDashboard = () => {
    const { user, refreshUser } = useAuth();
    const [stats, setStats] = useState({
        assignedTasks: 0,
        completedTasks: 0,
        pendingQuizzes: 0,
        totalXP: 0
    });
    const [activeTasks, setActiveTasks] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [upcomingQuizzes, setUpcomingQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadDashboardData = useCallback(async () => {
        if (!user?.id) return;

        try {
            // Only set loading true if we aren't already loading (though we initialized to true, 
            // this is for re-fetches or if we change logic later). 
            // Actually, simply setting it ensures the spinner shows.
            setLoading(true);

            const [tasks, submissions, quizzes, quizAttempts] = await Promise.all([
                db.getTasks().catch(err => { console.error('Error loading tasks:', err); return []; }),
                db.getSubmissionsByUser(user.id).catch(err => { console.error('Error loading submissions:', err); return []; }),
                db.getQuizzes().catch(err => { console.error('Error loading quizzes:', err); return []; }),
                db.getQuizAttemptsByUser(user.id).catch(err => { console.error('Error loading quiz attempts:', err); return []; })
            ]);

            // Get tasks assigned to current user (or global tasks)
            const myTasks = tasks.filter(t => !t.assigned_to || t.assigned_to.length === 0 || t.assigned_to.includes(user.id));
            const completedTaskIds = submissions.filter(s => s.status === 'approved').map(s => s.task_id);
            const pendingTaskIds = submissions.map(s => s.task_id);

            // Stats
            setStats({
                assignedTasks: myTasks.length,
                completedTasks: completedTaskIds.length,
                pendingQuizzes: quizzes.filter(q =>
                    (!q.assigned_to || q.assigned_to.length === 0 || q.assigned_to.includes(user.id)) &&
                    !quizAttempts.some(a => a.quiz_id === q.id)
                ).length,
                totalXP: user.xp || 0
            });

            // Active tasks (not yet submitted)
            const active = myTasks
                .filter(t => !pendingTaskIds.includes(t.id))
                .slice(0, 3);
            setActiveTasks(active);

            // Recent activity (recent submissions)
            const recent = submissions
                .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
                .slice(0, 5);
            setRecentActivity(recent);

            // Upcoming quizzes
            const upcoming = quizzes
                .filter(q =>
                    q.assigned_to?.includes(user.id) &&
                    !quizAttempts.some(a => a.quiz_id === q.id)
                )
                .slice(0, 3);
            setUpcomingQuizzes(upcoming);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.id]); // Only recreate if user ID changes

    useEffect(() => {
        if (user?.id) {
            loadDashboardData();
        }
    }, [loadDashboardData, user?.id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
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
            <Card
                variant="gradient"
                style={{
                    marginBottom: 'var(--space-xl)',
                    background: 'var(--gradient-primary)',
                    color: 'white',
                    position: 'relative',
                    overflow: 'hidden'
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
                            <p style={{ margin: 0, fontSize: 'var(--text-lg)', opacity: 0.9 }}>Total XP Earned</p>
                            <h2 style={{ margin: 0, fontSize: 'var(--text-5xl)', fontWeight: 800 }}>
                                {user?.xp || 0} XP
                            </h2>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 mb-xl">
                {[
                    { label: 'Assigned Tasks', value: stats.assignedTasks, icon: ListTodo, color: 'var(--primary-500)' },
                    { label: 'Completed', value: stats.completedTasks, icon: CheckCircle, color: 'var(--success-500)' },
                    { label: 'Pending Quizzes', value: stats.pendingQuizzes, icon: HelpCircle, color: 'var(--warning-500)' },
                    { label: 'Total XP', value: (user?.xp || 0).toLocaleString(), icon: Award, color: 'var(--accent-500)' }
                ].map((stat, index) => (
                    <Card key={index} style={{ textAlign: 'center' }}>
                        <stat.icon
                            size={24}
                            style={{ color: stat.color, marginBottom: 'var(--space-sm)' }}
                        />
                        <h3 style={{
                            fontSize: 'var(--text-2xl)',
                            margin: 0
                        }}>
                            {stat.value}
                        </h3>
                        <p style={{
                            fontSize: 'var(--text-sm)',
                            color: 'var(--text-muted)',
                            margin: 0
                        }}>
                            {stat.label}
                        </p>
                    </Card>
                ))}
            </div>

            {/* Main Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
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
                                                <span><Clock size={12} /> Due {formatDate(task.deadline)}</span>
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
                                key={activity.id}
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
                                    {activity.status === 'approved' ? (
                                        <CheckCircle size={20} style={{ color: 'var(--success-500)' }} />
                                    ) : activity.status === 'rejected' ? (
                                        <Target size={20} style={{ color: 'var(--error-500)' }} />
                                    ) : (
                                        <Clock size={20} style={{ color: 'var(--warning-500)' }} />
                                    )}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, fontWeight: 500, fontSize: 'var(--text-sm)' }}>
                                        {activity.tasks?.title}
                                    </p>
                                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                        {activity.status === 'approved' && activity.score
                                            ? `Approved with ${activity.score}/100`
                                            : activity.status === 'pending'
                                                ? 'Awaiting review'
                                                : 'Revision requested'}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <Badge variant={getStatusColor(activity.status)}>
                                        {activity.status}
                                    </Badge>
                                    <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                        {formatRelativeTime(activity.submitted_at)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <style>{`
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--border);
          border-top-color: var(--primary-500);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @media (max-width: 900px) {
          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
        </div>
    );
};

export default MemberDashboard;
