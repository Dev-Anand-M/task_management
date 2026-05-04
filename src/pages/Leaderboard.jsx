import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, Badge, Avatar, ProgressBar } from '../components/common';
import {
    Trophy,
    Medal,
    Crown,
    Flame,
    Star,
    TrendingUp,
    Award
} from 'lucide-react';
import * as db from '../services/database';


const Leaderboard = () => {
    const { user } = useAuth();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLeaderboard();
    }, []);

    const loadLeaderboard = async () => {
        try {
            setLoading(true);
            const [profiles, submissions, quizAttempts] = await Promise.all([
                db.getMembers(),
                db.getSubmissions(),
                db.getQuizAttempts()
            ]);

            const enriched = profiles
                .filter(p => p.role !== 'admin')
                .map(u => {
                    const userSubs = submissions.filter(s => s.user_id === u.id && s.status === 'approved');
                    const userQuizzes = quizAttempts.filter(q => q.user_id === u.id && q.passed);
                    return {
                        ...u,
                        tasksCompleted: userSubs.length,
                        quizzesPassed: userQuizzes.length
                    };
                });

            // Sort by XP
            enriched.sort((a, b) => (b.xp || 0) - (a.xp || 0));

            setMembers(enriched);
        } catch (error) {
            console.error('Error loading leaderboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const currentUserRank = members.findIndex(m => m.id === user?.id) + 1;
    const topThree = members.slice(0, 3);

    const getRankIcon = (rank) => {
        if (rank === 1) return <Crown size={24} style={{ color: '#FFD700' }} />;
        if (rank === 2) return <Medal size={24} style={{ color: '#C0C0C0' }} />;
        if (rank === 3) return <Medal size={24} style={{ color: '#CD7F32' }} />;
        return null;
    };

    const getRankColor = (rank) => {
        if (rank === 1) return 'linear-gradient(135deg, #FFD700, #FFA500)';
        if (rank === 2) return 'linear-gradient(135deg, #C0C0C0, #A0A0A0)';
        if (rank === 3) return 'linear-gradient(135deg, #CD7F32, #8B4513)';
        return 'var(--gradient-primary)';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            {/* Header Stats */}
            <div className="grid grid-cols-3 grid-3-mobile-1 mb-xl" style={{ gap: 'var(--space-md)' }}>
                <Card style={{
                    textAlign: 'center',
                    background: 'var(--gradient-primary)',
                    color: 'white'
                }}>
                    <Trophy size={32} style={{ marginBottom: 'var(--space-sm)' }} />
                    <h3 style={{ margin: 0, fontSize: 'var(--text-3xl)' }}>
                        {members.length}
                    </h3>
                    <p style={{ margin: 0, opacity: 0.9 }}>Total Participants</p>
                </Card>
                <Card style={{ textAlign: 'center' }}>
                    <TrendingUp size={32} style={{ color: 'var(--primary-400)', marginBottom: 'var(--space-sm)' }} />
                    <h3 style={{ margin: 0, fontSize: 'var(--text-3xl)' }}>
                        {members.reduce((sum, m) => sum + (m.xp || 0), 0).toLocaleString()}
                    </h3>
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>Classroom Total XP</p>
                </Card>
                <Card style={{ textAlign: 'center' }}>
                    <Star size={32} style={{ color: 'var(--warning-500)', marginBottom: 'var(--space-sm)' }} />
                    <h3 style={{ margin: 0, fontSize: 'var(--text-3xl)' }}>
                        #{currentUserRank || '-'}
                    </h3>
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>Your Rank</p>
                </Card>
            </div>

            {/* Podium */}
            {topThree.length >= 3 && (
                <div className="leaderboard-podium">
                    {/* 2nd Place */}
                    <div className="podium-item">
                        <div className="podium-avatar">
                            <Avatar name={topThree[1].name} image={topThree[1].avatar_url} size="lg" />
                        </div>
                        <h4 style={{ margin: '0 0 4px', fontSize: 'var(--text-sm)' }}>
                            {topThree[1].name}
                        </h4>
                        <p style={{
                            margin: 0,
                            fontSize: 'var(--text-sm)',
                            color: 'var(--text-muted)'
                        }}>
                            {topThree[1].xp?.toLocaleString() || 0} XP
                        </p>
                        <div className="podium-rank silver">
                            <Medal size={32} style={{ color: '#C0C0C0' }} />
                            <span style={{
                                fontSize: 'var(--text-2xl)',
                                fontWeight: 800
                            }}>
                                2
                            </span>
                        </div>
                    </div>

                    {/* 1st Place */}
                    <div className="podium-item">
                        <div className="podium-avatar">
                            <div className="podium-crown">👑</div>
                            <Avatar name={topThree[0].name} image={topThree[0].avatar_url} size="xl" />
                        </div>
                        <h4 style={{ margin: '0 0 4px' }}>{topThree[0].name}</h4>
                        <p style={{
                            margin: 0,
                            fontSize: 'var(--text-sm)',
                            color: 'var(--primary-400)',
                            fontWeight: 600
                        }}>
                            {topThree[0].xp?.toLocaleString() || 0} XP
                        </p>
                        <div className="podium-rank gold">
                            <Trophy size={32} style={{ color: '#FFD700' }} />
                            <span style={{
                                fontSize: 'var(--text-3xl)',
                                fontWeight: 800,
                                color: '#FFD700'
                            }}>
                                1
                            </span>
                        </div>
                    </div>

                    {/* 3rd Place */}
                    <div className="podium-item">
                        <div className="podium-avatar">
                            <Avatar name={topThree[2].name} image={topThree[2].avatar_url} size="lg" />
                        </div>
                        <h4 style={{ margin: '0 0 4px', fontSize: 'var(--text-sm)' }}>
                            {topThree[2].name}
                        </h4>
                        <p style={{
                            margin: 0,
                            fontSize: 'var(--text-sm)',
                            color: 'var(--text-muted)'
                        }}>
                            {topThree[2].xp?.toLocaleString() || 0} XP
                        </p>
                        <div className="podium-rank bronze">
                            <Medal size={32} style={{ color: '#CD7F32' }} />
                            <span style={{
                                fontSize: 'var(--text-2xl)',
                                fontWeight: 800
                            }}>
                                3
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Rest of Leaderboard */}
            <Card style={{ padding: 0 }}>
                <div style={{
                    padding: 'var(--space-lg)',
                    borderBottom: '1px solid var(--border)'
                }}>
                    <h3 style={{ margin: 0 }}>
                        <Flame size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                        Full Rankings
                    </h3>
                </div>

                <div>
                    {members.map((member, index) => {
                        const rank = index + 1;
                        const isCurrentUser = member.id === user?.id;

                        return (
                            <div
                                key={member.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-md)',
                                    padding: 'var(--space-md) var(--space-lg)',
                                    borderBottom: '1px solid var(--border)',
                                    background: isCurrentUser ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                                    transition: 'background var(--transition-fast)'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--card)'}
                                onMouseLeave={e => e.currentTarget.style.background = isCurrentUser ? 'rgba(99, 102, 241, 0.05)' : 'transparent'}
                            >
                                {/* Rank */}
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: 'var(--radius-md)',
                                    background: rank <= 3 ? getRankColor(rank) : 'var(--card)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    color: rank <= 3 ? 'white' : 'var(--text-muted)'
                                }}>
                                    {rank <= 3 ? getRankIcon(rank) : `#${rank}`}
                                </div>

                                {/* Avatar & Name */}
                                <div className="flex items-center gap-md" style={{ flex: 1, minWidth: 0 }}>
                                    <Avatar name={member.name} image={member.avatar_url} size="md" />
                                    <div style={{ minWidth: 0 }}>
                                        <div className="flex items-center gap-sm">
                                            <p style={{
                                                margin: 0,
                                                fontWeight: 600,
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}>
                                                {member.name}
                                                {isCurrentUser && (
                                                    <Badge variant="primary" style={{ marginLeft: '8px' }}>You</Badge>
                                                )}
                                            </p>
                                        </div>
                                        <p style={{
                                            margin: 0,
                                            fontSize: 'var(--text-xs)',
                                            color: 'var(--text-muted)'
                                        }}>
                                            {member.tasksCompleted} tasks • {member.quizzesPassed} quizzes
                                        </p>
                                    </div>
                                </div>

                                {/* XP */}
                                <div style={{
                                    textAlign: 'right',
                                    minWidth: '80px'
                                }}>
                                    <p style={{
                                        margin: 0,
                                        fontWeight: 700,
                                        color: 'var(--primary-400)',
                                        fontSize: 'var(--text-lg)'
                                    }}>
                                        {(member.xp || 0).toLocaleString()}
                                    </p>
                                    <p style={{
                                        margin: 0,
                                        fontSize: 'var(--text-xs)',
                                        color: 'var(--text-muted)'
                                    }}>
                                        XP
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>

        </div>
    );
};

export default Leaderboard;
