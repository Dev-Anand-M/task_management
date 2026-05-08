import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, Badge, Avatar, Button, ProgressBar } from '../../components/common';
import {
    ListTodo,
    ClipboardCheck,
    Users,
    Trophy,
    TrendingUp,
    Clock,
    CheckCircle,
    AlertCircle,
    ArrowRight,
    Plus
} from 'lucide-react';
import * as db from '../../services/database';
import { formatRelativeTime, getStatusColor, calculateLevelProgress, calculateLevel } from '../../utils/constants';
import { useMiniReload } from '../../hooks/useMiniReload';

const AdminDashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        totalTasks: 0,
        pendingReviews: 0,
        completionRate: 0,
        teamMembers: 0
    });
    const [recentSubmissions, setRecentSubmissions] = useState([]);
    const [teamProgress, setTeamProgress] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, []);

    // MINI RELOAD: Listen for global refresh events
    useMiniReload(loadDashboardData);

    const loadDashboardData = async () => {
        try {
            setLoading(true);

            // Fetch data from Supabase
            // functions in database.js now handle "no-classroom" (Global) case for admins automatically
            const [tasks, submissions, members, quizAttempts] = await Promise.all([
                db.getTasks(),
                db.getSubmissions(),
                db.getMembers(),
                db.getQuizAttempts()
            ]);

            // Calculate stats
            const pendingSubmissions = submissions.filter(s => s.status === 'pending').length;
            const pendingQuizzes = quizAttempts.filter(q => q.status === 'pending').length;
            const pendingReviews = pendingSubmissions + pendingQuizzes;

            const approvedSubmissions = submissions.filter(s => s.status === 'approved').length;
            const completionRate = submissions.length > 0
                ? Math.round((approvedSubmissions / submissions.length) * 100)
                : 0;

            // Filter out admins for stats and progress
            const filteredMembers = members.filter(m => m.role !== 'admin');

            setStats({
                totalTasks: tasks.filter(t => t.status === 'active').length,
                pendingReviews,
                completionRate,
                teamMembers: filteredMembers.length
            });

            // Recent submissions with joined data
            setRecentSubmissions(submissions.slice(0, 5));

            // Team progress (sorted by XP)
            const progress = filteredMembers
                .sort((a, b) => (b.xp || 0) - (a.xp || 0))
                .slice(0, 5)
                .map(m => {
                    const memberSubmissions = submissions.filter(s => s.user_id === m.id);
                    const completed = memberSubmissions.filter(s => s.status === 'approved').length;
                    return {
                        ...m,
                        tasksCompleted: completed,
                        totalTasks: memberSubmissions.length
                    };
                });
            setTeamProgress(progress);
        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const statCards = [
        {
            label: 'Active Tasks',
            value: stats.totalTasks,
            icon: ListTodo,
            color: 'var(--primary-500)',
            bg: 'rgba(99, 102, 241, 0.1)'
        },
        {
            label: 'Pending Reviews',
            value: stats.pendingReviews,
            icon: ClipboardCheck,
            color: 'var(--warning-500)',
            bg: 'rgba(245, 158, 11, 0.1)'
        },
        {
            label: 'Completion Rate',
            value: `${stats.completionRate}%`,
            icon: TrendingUp,
            color: 'var(--success-500)',
            bg: 'rgba(16, 185, 129, 0.1)'
        },
        {
            label: 'Team Members',
            value: stats.teamMembers,
            icon: Users,
            color: 'var(--accent-500)',
            bg: 'rgba(6, 182, 212, 0.1)'
        }
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            {/* Welcome Section */}
            <div style={{ marginBottom: 'var(--space-xl)' }}>
                <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-xs)' }}>
                    Welcome back, {user?.name?.split(' ')[0]}! 👋
                </h2>
                <p style={{ color: 'var(--text-muted)' }}>
                    Here's what's happening with your team today.
                </p>
            </div>

            {/* Stats Grid */}
            <div className="stat-card-grid" style={{ marginBottom: 'var(--space-xl)' }}>
                {statCards.map((stat) => (
                    <Card
                        key={stat.label}
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 'var(--space-md)'
                        }}
                    >
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: 'var(--radius-lg)',
                            background: stat.bg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: stat.color
                        }}>
                            <stat.icon size={24} />
                        </div>
                        <div>
                            <h3 style={{
                                fontSize: 'var(--text-3xl)',
                                fontWeight: 700,
                                marginBottom: '2px',
                                color: 'var(--text)'
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
                        </div>
                    </Card>
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="dashboard-grid">
                {/* Recent Submissions */}
                <Card>
                    <div className="flex justify-between items-center mb-lg">
                        <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>
                            Recent Submissions
                        </h3>
                        <Link to="/admin/evaluations">
                            <Button variant="ghost" size="sm" icon={ArrowRight} iconPosition="right">
                                View All
                            </Button>
                        </Link>
                    </div>

                    {recentSubmissions.length === 0 ? (
                        <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
                            <div className="empty-state-icon">
                                <ClipboardCheck size={32} />
                            </div>
                            <h4>No submissions yet</h4>
                            <p>Submissions will appear here once team members start completing tasks.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                            {recentSubmissions.map((sub) => (
                                <Link
                                    key={sub.id}
                                    to={`/admin/evaluations/${sub.id}`}
                                    style={{ textDecoration: 'none' }}
                                >
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-md)',
                                        padding: 'var(--space-md)',
                                        background: 'var(--surface)',
                                        borderRadius: 'var(--radius-lg)',
                                        border: '1px solid var(--border)',
                                        transition: 'all var(--transition-fast)',
                                        cursor: 'pointer'
                                    }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.borderColor = 'var(--primary-500)';
                                            e.currentTarget.style.transform = 'translateX(4px)';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.borderColor = 'var(--border)';
                                            e.currentTarget.style.transform = 'translateX(0)';
                                        }}
                                    >
                                        <Avatar name={sub.profiles?.name} image={sub.profiles?.avatar_url} size="sm" />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{
                                                margin: 0,
                                                fontWeight: 500,
                                                fontSize: 'var(--text-sm)',
                                                color: 'var(--text)'
                                            }}>
                                                {sub.profiles?.name}
                                            </p>
                                            <p style={{
                                                margin: 0,
                                                fontSize: 'var(--text-xs)',
                                                color: 'var(--text-muted)',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}>
                                                {sub.tasks?.title}
                                            </p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <Badge variant={getStatusColor(sub.status)}>
                                                {sub.status}
                                            </Badge>
                                            <p style={{
                                                margin: '4px 0 0',
                                                fontSize: 'var(--text-xs)',
                                                color: 'var(--text-muted)'
                                            }}>
                                                {formatRelativeTime(sub.submitted_at)}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Team Progress */}
                <Card>
                    <div className="flex justify-between items-center mb-lg">
                        <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>
                            Team Performance
                        </h3>
                        <Link to="/leaderboard">
                            <Button variant="ghost" size="sm" icon={Trophy}>
                                Leaderboard
                            </Button>
                        </Link>
                    </div>

                    {teamProgress.length === 0 ? (
                        <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
                            <div className="empty-state-icon">
                                <Users size={32} />
                            </div>
                            <h4>No team members yet</h4>
                            <p>Team members will appear here once they join the platform.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                            {teamProgress.map((member, index) => (
                                <div
                                    key={member.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-md)'
                                    }}
                                >
                                    <span style={{
                                        width: '24px',
                                        fontSize: 'var(--text-sm)',
                                        color: 'var(--text-muted)',
                                        textAlign: 'center'
                                    }}>
                                        #{index + 1}
                                    </span>
                                    <Avatar name={member.name} image={member.avatar_url} size="sm" />
                                    <div style={{ flex: 1 }}>
                                        <div className="flex justify-between items-center mb-xs">
                                            <span style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>
                                                {member.name}
                                            </span>
                                            <span style={{
                                                fontSize: 'var(--text-xs)',
                                                color: 'var(--primary-400)'
                                            }}>
                                                {member.xp || 0} XP
                                            </span>
                                        </div>
                                        <ProgressBar
                                            value={calculateLevelProgress(member.xp || 0)}
                                            size="sm"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div >

            <div style={{ marginTop: 'var(--space-xl)' }}>
                <h3 style={{ marginBottom: 'var(--space-md)' }}>Quick Actions</h3>
                <div className="flex flex-mobile-col gap-md">
                    <Link to="/admin/tasks/new">
                        <Button icon={Plus}>Create New Task</Button>
                    </Link>
                    <Link to="/admin/quizzes/new">
                        <Button variant="secondary" icon={Plus}>Create Quiz</Button>
                    </Link>
                    <Link to="/admin/evaluations">
                        <Button variant="secondary" icon={ClipboardCheck}>
                            Review Submissions ({stats.pendingReviews})
                        </Button>
                    </Link>
                </div>
            </div >

        </div >
    );
};

export default AdminDashboard;
