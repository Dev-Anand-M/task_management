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
    Award,
    Zap,
    Target,
    Shield,
    Swords
} from 'lucide-react';
import * as db from '../services/database';
import { calculateLevel, calculateLevelProgress, BADGES } from '../utils/constants';

const RANK_TIERS = {
    1: { label: 'Gold', color: '#FFD700', bg: 'linear-gradient(135deg, #FFD700, #FFA500)', emoji: '🥇' },
    2: { label: 'Silver', color: '#C0C0C0', bg: 'linear-gradient(135deg, #C0C0C0, #808080)', emoji: '🥈' },
    3: { label: 'Bronze', color: '#CD7F32', bg: 'linear-gradient(135deg, #CD7F32, #8B4513)', emoji: '🥉' }
};

const Leaderboard = () => {
    const { user } = useAuth();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState(user?.role === 'admin' ? 'all' : (user?.classroom_id ? 'classroom' : 'all')); // 'all', 'classroom'

    useEffect(() => {
        loadLeaderboard();
    }, []);

    const loadLeaderboard = async () => {
        try {
            setLoading(true);
            const safetyTimeout = setTimeout(() => setLoading(false), 8000);

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
                    const level = calculateLevel(u.xp || 0);
                    const levelProgress = calculateLevelProgress(u.xp || 0);
                    
                    // Calculate earned badges
                    const earnedBadges = [];
                    if (userSubs.length >= 1) earnedBadges.push(BADGES.find(b => b.id === 'first_task'));
                    if (userQuizzes.length >= 5) earnedBadges.push(BADGES.find(b => b.id === 'quiz_master'));
                    if ((u.xp || 0) >= 5000) earnedBadges.push(BADGES.find(b => b.id === 'legend'));
                    if (userSubs.some(s => s.score === 100)) earnedBadges.push(BADGES.find(b => b.id === 'perfect_score'));

                    return {
                        ...u,
                        tasksCompleted: userSubs.length,
                        quizzesPassed: userQuizzes.length,
                        level,
                        levelProgress,
                        earnedBadges: earnedBadges.filter(Boolean)
                    };
                });

            enriched.sort((a, b) => (b.xp || 0) - (a.xp || 0));
            setMembers(enriched);
            clearTimeout(safetyTimeout);
        } catch (error) {
            console.error('Error loading leaderboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const displayMembers = filter === 'classroom' && user?.classroom_id 
        ? members.filter(m => m.classroom_id === user.classroom_id) 
        : members;

    const currentUserRank = displayMembers.findIndex(m => m.id === user?.id) + 1;
    const topThree = displayMembers.slice(0, 3);
    const currentUserData = displayMembers.find(m => m.id === user?.id);

    const getRankIcon = (rank) => {
        if (rank === 1) return <Crown size={24} style={{ color: '#FFD700' }} />;
        if (rank === 2) return <Medal size={24} style={{ color: '#C0C0C0' }} />;
        if (rank === 3) return <Medal size={24} style={{ color: '#CD7F32' }} />;
        return null;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div className="animate-fade-in" style={{ paddingBottom: 'var(--space-2xl)' }}>
            {/* Hero Header */}
            <div style={{
                background: 'var(--gradient-primary)',
                borderRadius: 'var(--radius-2xl)',
                padding: 'var(--space-2xl)',
                marginBottom: 'var(--space-xl)',
                color: 'white',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{
                    position: 'absolute', right: '-40px', top: '-40px',
                    width: '200px', height: '200px',
                    background: 'rgba(255,255,255,0.08)', borderRadius: '50%'
                }} />
                <div style={{
                    position: 'absolute', right: '80px', bottom: '-60px',
                    width: '150px', height: '150px',
                    background: 'rgba(255,255,255,0.05)', borderRadius: '50%'
                }} />

                <div className="flex flex-mobile-col justify-between items-center" style={{ position: 'relative', zIndex: 1 }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 'var(--text-3xl)', fontWeight: 800 }}>
                            🏆 Leaderboard
                        </h2>
                        <p style={{ margin: '8px 0 0', opacity: 0.85, fontSize: 'var(--text-sm)' }}>
                            Compete, climb ranks, and unlock badges
                        </p>
                    </div>
                    {user?.role === 'admin' && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: 'var(--space-md)' }}>
                            <button
                                onClick={() => setFilter('all')}
                                style={{
                                    padding: '8px 16px', borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
                                    fontWeight: 700, fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em',
                                    background: filter === 'all' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                                    color: 'white', transition: 'all 0.2s'
                                }}
                            >All</button>
                            <button
                                onClick={() => setFilter('classroom')}
                                style={{
                                    padding: '8px 16px', borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
                                    fontWeight: 700, fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em',
                                    background: filter === 'classroom' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                                    color: 'white', transition: 'all 0.2s'
                                }}
                            >My Classroom</button>
                        </div>
                    )}
                </div>

                {/* Quick Stats Row */}
                <div className="grid grid-cols-3 grid-3-mobile-1" style={{ gap: 'var(--space-md)', marginTop: 'var(--space-xl)' }}>
                    <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-lg)', textAlign: 'center' }}>
                        <Trophy size={28} style={{ marginBottom: '4px' }} />
                        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>{displayMembers.length}</div>
                        <div style={{ fontSize: '10px', opacity: 0.8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Participants</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-lg)', textAlign: 'center' }}>
                        <Zap size={28} style={{ marginBottom: '4px' }} />
                        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>{displayMembers.reduce((s, m) => s + (m.xp || 0), 0).toLocaleString()}</div>
                        <div style={{ fontSize: '10px', opacity: 0.8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total XP</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-lg)', textAlign: 'center' }}>
                        <Star size={28} style={{ marginBottom: '4px' }} />
                        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>#{currentUserRank || '-'}</div>
                        <div style={{ fontSize: '10px', opacity: 0.8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Rank</div>
                    </div>
                </div>
            </div>

            {/* Your Card */}
            {currentUserData && (
                <Card style={{
                    marginBottom: 'var(--space-xl)',
                    border: '2px solid var(--primary-500)',
                    background: 'rgba(99, 102, 241, 0.05)',
                    position: 'relative', overflow: 'hidden'
                }}>
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
                        background: RANK_TIERS[currentUserRank]?.bg || 'transparent'
                    }} />
                    <div className="flex flex-mobile-col items-center gap-lg" style={{ padding: 'var(--space-sm)' }}>
                        <Avatar name={currentUserData.name} image={currentUserData.avatar_url} size="xl" />
                        <div style={{ flex: 1 }}>
                            <div className="flex items-center gap-sm" style={{ flexWrap: 'wrap' }}>
                                <h3 style={{ margin: 0 }}>{currentUserData.name}</h3>
                                <Badge variant="primary">#{currentUserRank}</Badge>
                                {RANK_TIERS[currentUserRank] && (
                                    <span style={{
                                        fontSize: '11px', fontWeight: 800, padding: '2px 10px',
                                        borderRadius: 'var(--radius-full)',
                                        background: RANK_TIERS[currentUserRank].bg, color: 'white'
                                    }}>{RANK_TIERS[currentUserRank].emoji} {RANK_TIERS[currentUserRank].label}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-md" style={{ marginTop: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                    Level {currentUserData.level} • {(currentUserData.xp || 0).toLocaleString()} XP
                                </span>
                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                    {currentUserData.tasksCompleted} tasks • {currentUserData.quizzesPassed} quizzes
                                </span>
                            </div>
                            <div style={{ marginTop: '8px', maxWidth: '300px' }}>
                                <ProgressBar value={currentUserData.levelProgress} size="sm" color="var(--primary-500)" />
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                    {Math.round(currentUserData.levelProgress)}% to Level {currentUserData.level + 1}
                                </span>
                            </div>
                        </div>
                        {currentUserData.earnedBadges.length > 0 && (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {currentUserData.earnedBadges.map(badge => (
                                    <span key={badge.id} title={badge.name + ': ' + badge.description} style={{
                                        fontSize: '24px', cursor: 'help',
                                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
                                    }}>{badge.icon}</span>
                                ))}
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {/* Podium */}
            {topThree.length >= 3 && (
                <div className="leaderboard-podium">
                    {/* 2nd Place */}
                    <div className="podium-item">
                        <div className="podium-avatar">
                            <Avatar name={topThree[1].name} image={topThree[1].avatar_url} size="lg" />
                        </div>
                        <h4 style={{ margin: '0 0 4px', fontSize: 'var(--text-sm)' }}>{topThree[1].name}</h4>
                        <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 8px', borderRadius: 'var(--radius-full)', background: RANK_TIERS[2].bg, color: 'white' }}>
                            {RANK_TIERS[2].emoji} {RANK_TIERS[2].label}
                        </span>
                        <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                            {topThree[1].xp?.toLocaleString() || 0} XP
                        </p>
                        <div className="podium-rank silver">
                            <Medal size={32} style={{ color: '#C0C0C0' }} />
                            <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>2</span>
                        </div>
                    </div>
                    {/* 1st Place */}
                    <div className="podium-item">
                        <div className="podium-avatar">
                            <div className="podium-crown">👑</div>
                            <Avatar name={topThree[0].name} image={topThree[0].avatar_url} size="xl" />
                        </div>
                        <h4 style={{ margin: '0 0 4px' }}>{topThree[0].name}</h4>
                        <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 8px', borderRadius: 'var(--radius-full)', background: RANK_TIERS[1].bg, color: 'white' }}>
                            {RANK_TIERS[1].emoji} {RANK_TIERS[1].label}
                        </span>
                        <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--primary-400)', fontWeight: 600 }}>
                            {topThree[0].xp?.toLocaleString() || 0} XP
                        </p>
                        <div className="podium-rank gold">
                            <Trophy size={32} style={{ color: '#FFD700' }} />
                            <span style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: '#FFD700' }}>1</span>
                        </div>
                    </div>
                    {/* 3rd Place */}
                    <div className="podium-item">
                        <div className="podium-avatar">
                            <Avatar name={topThree[2].name} image={topThree[2].avatar_url} size="lg" />
                        </div>
                        <h4 style={{ margin: '0 0 4px', fontSize: 'var(--text-sm)' }}>{topThree[2].name}</h4>
                        <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 8px', borderRadius: 'var(--radius-full)', background: RANK_TIERS[3].bg, color: 'white' }}>
                            {RANK_TIERS[3].emoji} {RANK_TIERS[3].label}
                        </span>
                        <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                            {topThree[2].xp?.toLocaleString() || 0} XP
                        </p>
                        <div className="podium-rank bronze">
                            <Medal size={32} style={{ color: '#CD7F32' }} />
                            <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>3</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Full Rankings */}
            <Card style={{ padding: 0 }}>
                <div style={{ padding: 'var(--space-lg)', borderBottom: '1px solid var(--border)' }}>
                    <h3 style={{ margin: 0 }}>
                        <Flame size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                        Full Rankings
                    </h3>
                </div>

                <div>
                    {displayMembers.map((member, index) => {
                        const rank = index + 1;
                        const isCurrentUser = member.id === user?.id;

                        return (
                            <div
                                key={member.id}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                                    padding: 'var(--space-md) var(--space-lg)',
                                    borderBottom: '1px solid var(--border)',
                                    background: isCurrentUser ? 'rgba(99, 102, 241, 0.06)' : 'transparent',
                                    transition: 'background var(--transition-fast)'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = isCurrentUser ? 'rgba(99, 102, 241, 0.1)' : 'var(--surface)'}
                                onMouseLeave={e => e.currentTarget.style.background = isCurrentUser ? 'rgba(99, 102, 241, 0.06)' : 'transparent'}
                            >
                                {/* Rank */}
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
                                    background: rank <= 3
                                        ? (rank === 1 ? 'linear-gradient(135deg, #FFD700, #FFA500)' : rank === 2 ? 'linear-gradient(135deg, #C0C0C0, #A0A0A0)' : 'linear-gradient(135deg, #CD7F32, #8B4513)')
                                        : 'var(--card)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 700, color: rank <= 3 ? 'white' : 'var(--text-muted)',
                                    fontSize: 'var(--text-sm)'
                                }}>
                                    {rank <= 3 ? getRankIcon(rank) : `#${rank}`}
                                </div>

                                {/* Avatar & Name */}
                                <div className="flex items-center gap-md" style={{ flex: 1, minWidth: 0 }}>
                                    <Avatar name={member.name} image={member.avatar_url} size="md" />
                                    <div style={{ minWidth: 0 }}>
                                        <div className="flex items-center gap-sm" style={{ flexWrap: 'wrap' }}>
                                            <p style={{ margin: 0, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {member.name}
                                            </p>
                                            {isCurrentUser && <Badge variant="primary" style={{ fontSize: '9px' }}>You</Badge>}
                                            {RANK_TIERS[rank] && (
                                                <span style={{
                                                    fontSize: '9px', fontWeight: 800, padding: '1px 6px',
                                                    borderRadius: 'var(--radius-full)',
                                                    background: RANK_TIERS[rank].bg, color: 'white'
                                                }}>{RANK_TIERS[rank].emoji} {RANK_TIERS[rank].label}</span>
                                            )}
                                        </div>
                                        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                            Lv.{member.level} • {member.tasksCompleted} tasks • {member.quizzesPassed} quizzes
                                        </p>
                                    </div>
                                </div>

                                {/* Badges */}
                                <div style={{ display: 'flex', gap: '2px' }}>
                                    {member.earnedBadges.slice(0, 3).map(b => (
                                        <span key={b.id} title={b.name} style={{ fontSize: '16px' }}>{b.icon}</span>
                                    ))}
                                </div>

                                {/* XP */}
                                <div style={{ textAlign: 'right', minWidth: '80px' }}>
                                    <p style={{ margin: 0, fontWeight: 700, color: 'var(--primary-400)', fontSize: 'var(--text-lg)' }}>
                                        {(member.xp || 0).toLocaleString()}
                                    </p>
                                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>XP</p>
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
