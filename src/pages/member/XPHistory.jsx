import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, Avatar } from '../../components/common';
import {
    Award,
    Trophy,
    CheckCircle,
    HelpCircle,
    ArrowLeft,
    Flame,
    Zap,
    TrendingUp
} from 'lucide-react';
import * as db from '../../services/database';
import { formatDate, formatRelativeTime } from '../../utils/constants';

const XPHistory = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalXP: 0,
        quizXP: 0,
        taskXP: 0,
        streak: 0
    });

    const loadXPHistory = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const [submissions, quizAttempts] = await Promise.all([
                db.getSubmissionsByUser(user.id),
                db.getQuizAttemptsByUser(user.id)
            ]);

            // Format Task XP
            const taskHistory = submissions
                .filter(s => s.status === 'approved' && s.score !== null)
                .map(s => {
                    const points = s.tasks?.points || 100;
                    const xpEarned = Math.round((s.score / 100) * points);
                    return {
                        id: `task-${s.id}`,
                        type: 'task',
                        title: s.tasks?.title || 'Task Completion',
                        date: s.submitted_at,
                        xp: xpEarned,
                        score: s.score,
                        total: 100,
                        icon: <CheckCircle size={20} style={{ color: 'var(--success-500)' }} />
                    };
                });

            // Format Quiz XP
            const quizHistory = quizAttempts
                .filter(a => a.metadata?.finalized === true)
                .map(a => ({
                    id: `quiz-${a.id}`,
                    type: 'quiz',
                    title: a.quizzes?.title || 'Quiz Completion',
                    date: a.completed_at || a.created_at,
                    xp: a.xp_earned || a.metadata?.xp_earned || 0,
                    score: a.score,
                    total: 100,
                    icon: <HelpCircle size={20} style={{ color: 'var(--primary-500)' }} />
                }));

            const combined = [...taskHistory, ...quizHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
            setHistory(combined);

            // Calculate Stats
            const quizXP = quizHistory.reduce((sum, item) => sum + item.xp, 0);
            const taskXP = taskHistory.reduce((sum, item) => sum + item.xp, 0);
            
            setStats({
                totalXP: user.xp || (quizXP + taskXP),
                quizXP,
                taskXP,
                streak: user.streak || 0
            });

        } catch (error) {
            console.error('Error loading XP history:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.id, user.xp, user.streak]);

    useEffect(() => {
        loadXPHistory();
    }, [loadXPHistory]);

    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-md mb-xl">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft size={20} />
                </Button>
                <div>
                    <h2 style={{ margin: 0 }}>XP History</h2>
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>Track your growth and achievements</p>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-4 mb-xl">
                <Card style={{ textAlign: 'center', background: 'var(--gradient-primary)', color: 'white' }}>
                    <TrendingUp size={24} style={{ marginBottom: 'var(--space-sm)' }} />
                    <h3 style={{ fontSize: 'var(--text-3xl)', margin: 0 }}>{stats.totalXP.toLocaleString()}</h3>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', opacity: 0.8 }}>Total XP</p>
                </Card>
                <Card style={{ textAlign: 'center' }}>
                    <HelpCircle size={24} style={{ color: 'var(--primary-500)', marginBottom: 'var(--space-sm)' }} />
                    <h3 style={{ fontSize: 'var(--text-2xl)', margin: 0 }}>{stats.quizXP.toLocaleString()}</h3>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>From Quizzes</p>
                </Card>
                <Card style={{ textAlign: 'center' }}>
                    <CheckCircle size={24} style={{ color: 'var(--success-500)', marginBottom: 'var(--space-sm)' }} />
                    <h3 style={{ fontSize: 'var(--text-2xl)', margin: 0 }}>{stats.taskXP.toLocaleString()}</h3>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>From Tasks</p>
                </Card>
                <Card style={{ textAlign: 'center' }}>
                    <Flame size={24} style={{ color: 'var(--warning-500)', marginBottom: 'var(--space-sm)' }} />
                    <h3 style={{ fontSize: 'var(--text-2xl)', margin: 0 }}>{stats.streak}</h3>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Day Streak</p>
                </Card>
            </div>

            {/* History List */}
            <Card>
                <h3 style={{ marginBottom: 'var(--space-lg)' }}>
                    <Zap size={20} style={{ marginRight: '8px', verticalAlign: 'middle', color: 'var(--warning-500)' }} />
                    Reward Timeline
                </h3>

                {history.length === 0 ? (
                    <div className="text-center py-2xl">
                        <Award size={48} style={{ color: 'var(--border)', marginBottom: 'var(--space-md)' }} />
                        <p style={{ color: 'var(--text-muted)' }}>No XP earned yet. Complete tasks and quizzes to start your journey!</p>
                        <Button onClick={() => navigate('/tasks')} style={{ marginTop: 'var(--space-md)' }}>
                            Find a Task
                        </Button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        {history.map((item) => (
                            <div
                                key={item.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-md)',
                                    padding: 'var(--space-md)',
                                    background: 'var(--surface)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border)'
                                }}
                            >
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: 'var(--radius-md)',
                                    background: item.type === 'quiz' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {item.icon}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div className="flex justify-between items-start">
                                        <h4 style={{ margin: 0, fontSize: 'var(--text-sm)' }}>{item.title}</h4>
                                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                            {formatDate(item.date)}
                                        </span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                        {item.type === 'quiz' ? 'Quiz completed' : 'Task approved'} • Score: {item.score}%
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{
                                        fontSize: 'var(--text-lg)',
                                        fontWeight: 700,
                                        color: 'var(--primary-500)'
                                    }}>
                                        +{item.xp} XP
                                    </div>
                                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                        {formatRelativeTime(item.date)}
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
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @media (max-width: 768px) {
                    .grid-cols-4 {
                        grid-template-columns: repeat(2, 1fr) !important;
                        gap: var(--space-md);
                    }
                }
            `}</style>
        </div>
    );
};

export default XPHistory;
