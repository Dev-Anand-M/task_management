import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, Avatar, Modal } from '../../components/common';
import ImageCropper from '../../components/common/ImageCropper';
import {
    User,
    Mail,
    Award,
    Trophy,
    Target,
    HelpCircle,
    Edit2,
    Camera,
    Save,
    Shield,
    Zap,
    CheckCircle,
    Flame,
    TrendingUp
} from 'lucide-react';
import * as db from '../../services/database';
import { useMiniReload } from '../../hooks/useMiniReload';
import { formatDate, formatRelativeTime } from '../../utils/constants';

const Profile = ({ userId = null, readonly = false }) => {
    const { user: authUser, updateProfile, refreshUser } = useAuth();
    const [profileData, setProfileData] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(true);
    const [isZoomed, setIsZoomed] = useState(false);
    const [isXPHistoryOpen, setIsXPHistoryOpen] = useState(false);
    const [xpTimeline, setXpTimeline] = useState([]);
    const [xpStats, setXpStats] = useState({ quizXP: 0, taskXP: 0 });
    const [stats, setStats] = useState({
        tasksCompleted: 0,
        quizzesPassed: 0,
        avgScore: 0
    });
    const [cropImageSrc, setCropImageSrc] = useState(null);
    const fileInputRef = useRef(null);

    // Determine which user ID to use
    // If userId prop is passed, use that (Admin View). Otherwise use logged-in user (Self View).
    const targetUserId = userId || authUser?.id;

    const loadProfileData = useCallback(async (isRefresh = false) => {
        if (!targetUserId) {
            setLoading(false);
            return;
        }

        
        try {
            if (!isRefresh) setLoading(true);
            
            // Safety timeout within the fetch logic itself
            const fetchPromise = (async () => {
                let data = null;
                if (!userId) {
                    data = authUser;
                } else {
                    data = await db.getProfileById(userId);
                }

                if (!data) throw new Error('Profile not found');

                setProfileData(data);
                if (data.name) setName(data.name);

                // Load Stats
                const [submissions, quizAttempts, tasks] = await Promise.all([
                    db.getSubmissionsByUser(targetUserId),
                    db.getQuizAttemptsByUser(targetUserId),
                    db.getTasks()
                ]);

                const approved = submissions.filter(s => s.status === 'approved');
                const passed = quizAttempts.filter(a => a.passed);
                const scoredSubmissions = approved.filter(s => s.score);
                const avgScore = scoredSubmissions.length > 0
                    ? Math.round(scoredSubmissions.reduce((sum, s) => sum + s.score, 0) / scoredSubmissions.length)
                    : 0;

                const taskMap = new Map(tasks.map(t => [t.id, t]));
                const categoryCounts = {};
                const difficultyCounts = {};

                approved.forEach(sub => {
                    const task = taskMap.get(sub.task_id);
                    if (task) {
                        const cat = task.category || 'Uncategorized';
                        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
                        const diff = task.difficulty || 'Normal';
                        difficultyCounts[diff] = (difficultyCounts[diff] || 0) + 1;
                    }
                });

                const categoryStats = Object.entries(categoryCounts)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5);

                // Format Task XP for timeline
                const taskHistory = submissions
                    .filter(s => s.status === 'approved' && s.score !== null)
                    .map(s => {
                        const points = s.tasks?.points ?? 100;
                        const xpEarned = Math.round((s.score / 100) * points);
                        return {
                            id: `task-${s.id}`,
                            type: 'task',
                            title: s.tasks?.title || 'Task Completion',
                            date: s.submitted_at,
                            xp: xpEarned,
                            score: s.score,
                            total: 100
                        };
                    });

                // Format Quiz XP for timeline
                const quizHistory = quizAttempts
                    .filter(a => a.metadata?.finalized === true)
                    .map(a => ({
                        id: `quiz-${a.id}`,
                        type: 'quiz',
                        title: a.quizzes?.title || 'Quiz Completion',
                        date: a.completed_at || a.created_at,
                        xp: a.xp_earned || a.metadata?.xp_earned || 0,
                        score: a.score,
                        total: 100
                    }));

                const combinedTimeline = [...taskHistory, ...quizHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
                setXpTimeline(combinedTimeline);

                const quizXP = quizHistory.reduce((sum, item) => sum + item.xp, 0);
                const taskXP = taskHistory.reduce((sum, item) => sum + item.xp, 0);
                setXpStats({ quizXP, taskXP });

                setStats({
                    tasksCompleted: approved.length,
                    quizzesPassed: passed.length,
                    avgScore,
                    categoryStats,
                    difficultyStats: difficultyCounts
                });
            })();

            // Wait for fetch or timeout
            await Promise.race([
                fetchPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 8000))
            ]);

        } catch (error) {
            console.error('[Profile] Error loading profile:', error);
        } finally {
            setLoading(false);
        }
    }, [userId, targetUserId, authUser]);

    useEffect(() => {
        loadProfileData();
    }, [loadProfileData]);

    // Refresh on tab switch
    useMiniReload(() => loadProfileData(true));

    // Safety timeout to prevent infinite loading state
    useEffect(() => {
        if (loading) {
            const timer = setTimeout(() => {
                console.warn('Profile loading safety timeout triggered');
                setLoading(false);
            }, 8000);
            return () => clearTimeout(timer);
        }
    }, [loading]);

    const handleSave = async () => {
        if (readonly) return;
        // Only update if it's the current user
        if (!userId) {
            await updateProfile({ name });
            await refreshUser();
            setIsEditing(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            alert('File is too large. Max 10MB.');
            return;
        }

        const src = URL.createObjectURL(file);
        setCropImageSrc(src);
        e.target.value = '';
    };

    const handleCropComplete = async (croppedBlob) => {
        try {
            const activeUid = authUser?.id || profileData?.id || targetUserId;
            if (!activeUid) {
                alert('User session not found. Please log in again.');
                return;
            }
            const croppedFile = new File([croppedBlob], `avatar-${Date.now()}.jpg`, { type: 'image/jpeg' });
            const url = await db.uploadAvatar(activeUid, croppedFile);

            if (updateProfile) {
                await updateProfile({ avatar_url: url });
            }
            if (refreshUser) {
                await refreshUser();
            }

            setProfileData(prev => ({ ...prev, avatar_url: url }));
            setCropImageSrc(null);
        } catch (err) {
            console.error('Avatar upload error:', err);
            alert(`Failed to upload avatar: ${err?.message || 'Unknown error'}`);
        }
    };

    if (loading) return <div className="p-xl text-center">Loading profile...</div>;
    if (!profileData) return <div className="p-xl text-center">Profile not found.</div>;

    return (
        <div className="animate-fade-in">
            {/* Profile Header */}
            <Card style={{
                marginBottom: 'var(--space-xl)',
                background: 'var(--gradient-primary)',
                color: 'white',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Background decoration */}
                <div style={{
                    position: 'absolute',
                    right: '-100px',
                    top: '-100px',
                    width: '300px',
                    height: '300px',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '50%'
                }} />

                <div className="flex items-center gap-xl" style={{ position: 'relative' }}>
                    {/* Avatar */}
                    <div style={{ position: 'relative' }}>
                        <div 
                            onClick={() => setIsZoomed(true)} 
                            style={{ cursor: 'zoom-in', display: 'inline-block', borderRadius: '50%' }}
                            title="View profile picture"
                        >
                            <Avatar
                                name={profileData.name}
                                image={profileData.avatar_url}
                                size="xl"
                                className="ring-4 ring-white/20 shadow-xl transition-transform hover:scale-105"
                            />
                        </div>

                        {!readonly && (
                            <>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                    accept="image/*"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        right: 0,
                                        width: '32px',
                                        height: '32px',
                                        background: 'white',
                                        border: 'none',
                                        borderRadius: '50%',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: 'var(--shadow-md)'
                                    }}
                                >
                                    <Camera size={16} style={{ color: 'var(--primary-500)' }} />
                                </button>
                            </>
                        )}
                    </div>

                    {/* Edit/Action Button Top Right */}
                    <div style={{ position: 'absolute', top: 0, right: 0 }}>
                        {!readonly && !isEditing && (
                            <button
                                onClick={() => setIsEditing(true)}
                                title="Edit name"
                                style={{
                                    background: 'rgba(255,255,255,0.2)',
                                    border: 'none',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '0.5rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    color: 'white',
                                    backdropFilter: 'blur(4px)'
                                }}
                            >
                                <Edit2 size={16} />
                            </button>
                        )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1 }}>
                        {isEditing && !readonly ? (
                            <div className="flex items-center gap-md mb-sm">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    style={{
                                        background: 'rgba(255,255,255,0.2)',
                                        border: '1px solid rgba(255,255,255,0.3)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: '0.5rem 1rem',
                                        color: 'white',
                                        fontSize: 'var(--text-xl)',
                                        fontWeight: 600
                                    }}
                                />
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    icon={Save}
                                    onClick={handleSave}
                                    style={{ background: 'white', color: 'var(--primary-500)' }}
                                >
                                    Save
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-md mb-xs">
                                <h2 style={{ margin: 0, color: 'white' }}>{profileData.name}</h2>
                            </div>
                        )}
                        <p style={{ margin: 0, color: 'rgba(255,255,255,0.9)' }}>{profileData.email}</p>
                        <div className="flex gap-md mt-lg">
                            {readonly ? (
                                authUser?.role === 'admin' ? (
                                    <div 
                                        onClick={() => setIsXPHistoryOpen(true)}
                                        style={{
                                            background: 'rgba(0,0,0,0.3)',
                                            color: '#ffffff',
                                            fontWeight: 600,
                                            border: '1px solid rgba(255,255,255,0.3)',
                                            borderRadius: '9999px',
                                            padding: '0.25rem 0.75rem',
                                            fontSize: '0.75rem',
                                            backdropFilter: 'blur(4px)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                        title="Click to view detailed XP history"
                                    >
                                        <Award size={14} />
                                        {profileData.xp?.toLocaleString() || 0} XP (View Details)
                                    </div>
                                ) : (
                                    <div 
                                        style={{
                                            background: 'rgba(0,0,0,0.3)',
                                            color: '#ffffff',
                                            fontWeight: 600,
                                            border: '1px solid rgba(255,255,255,0.3)',
                                            borderRadius: '9999px',
                                            padding: '0.25rem 0.75rem',
                                            fontSize: '0.75rem',
                                            backdropFilter: 'blur(4px)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <Award size={14} />
                                        {profileData.xp?.toLocaleString() || 0} XP
                                    </div>
                                )
                            ) : (
                                <Link to="/xp-history" style={{ textDecoration: 'none' }}>
                                    <div style={{
                                        background: 'rgba(0,0,0,0.3)',
                                        color: '#ffffff',
                                        fontWeight: 600,
                                        border: '1px solid rgba(255,255,255,0.3)',
                                        borderRadius: '9999px',
                                        padding: '0.25rem 0.75rem',
                                        fontSize: '0.75rem',
                                        backdropFilter: 'blur(4px)',
                                        cursor: 'pointer'
                                    }}>
                                        {profileData.xp?.toLocaleString() || 0} XP →
                                    </div>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Stats Grid */}
            <div className={`grid grid-cols-3 ${readonly ? 'gap-md' : 'mb-xl'}`}>
                {[
                    { label: 'Tasks Completed', value: stats.tasksCompleted, icon: Target, color: 'var(--primary-500)' },
                    { label: 'Quizzes Passed', value: stats.quizzesPassed, icon: HelpCircle, color: 'var(--accent-500)' },
                    { label: 'Avg Score', value: `${stats.avgScore}%`, icon: Trophy, color: 'var(--success-500)' }
                ].map((stat, index) => (
                    <Card key={index} style={{ textAlign: 'center' }}>
                        <stat.icon
                            size={28}
                            style={{ color: stat.color, marginBottom: 'var(--space-sm)' }}
                        />
                        <h3 style={{ margin: 0, fontSize: 'var(--text-2xl)' }}>{stat.value}</h3>
                        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                            {stat.label}
                        </p>
                    </Card>
                ))}
            </div>

            {/* Advanced Stats */}
            <div className="grid grid-cols-2 gap-lg mb-xl advanced-stats-grid">
                {/* Skill Breakdown */}
                <Card>
                    <h3 style={{ marginTop: 0, marginBottom: 'var(--space-lg)' }}>Skill Breakdown</h3>
                    <div className="flex flex-col gap-md">
                        {stats.categoryStats?.length > 0 ? (
                            stats.categoryStats.map((cat, i) => (
                                <div key={i}>
                                    <div className="flex justify-between mb-xs text-sm">
                                        <span>{cat.name}</span>
                                        <span className="text-muted">{cat.count} Tasks</span>
                                    </div>
                                    <div style={{
                                        width: '100%',
                                        height: '8px',
                                        background: 'var(--border)',
                                        borderRadius: '4px',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            width: `${(cat.count / stats.tasksCompleted) * 100}%`,
                                            height: '100%',
                                            background: `var(--primary-${500 - (i * 100)})`, // Gradient effect
                                            borderRadius: '4px',
                                            transition: 'width 1s ease-out'
                                        }} />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-muted text-center py-lg">No task data available.</p>
                        )}
                    </div>
                </Card>

                {/* Difficulty Mastery */}
                <Card>
                    <h3 style={{ marginTop: 0, marginBottom: 'var(--space-lg)' }}>Difficulty Mastery</h3>
                    <div className="flex flex-col gap-md">
                        {stats.difficultyStats && Object.entries(stats.difficultyStats).map(([diff, count]) => (
                            <div key={diff} className="flex items-center gap-md">
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    background: diff === 'Expert' ? 'var(--error-100)' : diff === 'Medium' ? 'var(--warning-100)' : 'var(--success-100)',
                                    color: diff === 'Expert' ? 'var(--error-600)' : diff === 'Medium' ? 'var(--warning-600)' : 'var(--success-600)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700
                                }}>
                                    {count}
                                </div>
                                <div>
                                    <p style={{ margin: 0, fontWeight: 500 }}>{diff}</p>
                                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                        Tasks Completed
                                    </p>
                                </div>
                            </div>
                        ))}
                        {(!stats.difficultyStats || Object.keys(stats.difficultyStats).length === 0) && (
                            <p className="text-muted text-center py-lg">No data available.</p>
                        )}
                    </div>
                </Card>
            </div>

            {/* Avatar Zoom Modal */}
            {isZoomed && (
                <div 
                    onClick={() => setIsZoomed(false)}
                    style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(0, 0, 0, 0.88)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 99999,
                        cursor: 'pointer',
                        padding: '20px'
                    }}
                    title="Click anywhere to close"
                >
                    {profileData?.avatar_url ? (
                        <img 
                            src={profileData.avatar_url} 
                            alt={profileData.name} 
                            style={{ 
                                width: 'min(320px, 80vw)', 
                                height: 'min(320px, 80vw)', 
                                borderRadius: '50%',
                                objectFit: 'cover',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.9), 0 0 0 4px #10b981, 0 0 35px rgba(16,185,129,0.5)',
                                border: '4px solid #10b981'
                            }} 
                        />
                    ) : (
                        <div style={{
                            width: '260px',
                            height: '260px',
                            background: 'var(--gradient-primary)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '6rem',
                            fontWeight: 700,
                            borderRadius: '50%',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.9), 0 0 0 4px #10b981'
                        }}>
                            {profileData?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                    )}
                </div>
            )}

            {/* Image Cropper Modal */}
            {cropImageSrc && (
                <ImageCropper
                    imageSrc={cropImageSrc}
                    onCrop={handleCropComplete}
                    onCancel={() => setCropImageSrc(null)}
                />
            )}

            {/* XP History Modal */}
            <Modal 
                isOpen={isXPHistoryOpen} 
                onClose={() => setIsXPHistoryOpen(false)} 
                title={`${profileData.name}'s XP History`}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', maxHeight: '70vh', overflowY: 'auto', paddingRight: 'var(--space-xs)' }}>
                    {/* Stats Overview */}
                    <div className="xp-history-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: 'var(--space-sm)',
                        marginBottom: 'var(--space-md)'
                    }}>
                        <div style={{ textAlign: 'center', background: 'var(--gradient-primary)', color: 'white', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)' }}>
                            <TrendingUp size={20} style={{ marginBottom: '4px', display: 'inline-block' }} />
                            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>{(profileData.xp || 0).toLocaleString()}</div>
                            <div style={{ fontSize: '10px', opacity: 0.8 }}>Total XP</div>
                        </div>
                        <div style={{ textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)' }}>
                            <HelpCircle size={20} style={{ color: 'var(--primary-500)', marginBottom: '4px', display: 'inline-block' }} />
                            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>{xpStats.quizXP.toLocaleString()}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>From Quizzes</div>
                        </div>
                        <div style={{ textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)' }}>
                            <CheckCircle size={20} style={{ color: 'var(--success-500)', marginBottom: '4px', display: 'inline-block' }} />
                            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>{xpStats.taskXP.toLocaleString()}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>From Tasks</div>
                        </div>
                        <div style={{ textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)' }}>
                            <Flame size={20} style={{ color: 'var(--warning-500)', marginBottom: '4px', display: 'inline-block' }} />
                            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>{profileData.streak || 0}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Streak</div>
                        </div>
                    </div>

                    {/* Timeline List */}
                    <div>
                        <h4 style={{ margin: '0 0 var(--space-md) 0', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                            <Zap size={18} style={{ color: 'var(--warning-500)' }} />
                            Reward Timeline
                        </h4>

                        {xpTimeline.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
                                <Award size={36} style={{ color: 'var(--border)', marginBottom: 'var(--space-sm)' }} />
                                <p style={{ margin: 0 }}>No XP earned yet.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                {xpTimeline.map((item) => (
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
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: 'var(--radius-md)',
                                            background: item.type === 'quiz' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            {item.type === 'quiz' ? (
                                                <HelpCircle size={18} style={{ color: 'var(--primary-500)' }} />
                                            ) : (
                                                <CheckCircle size={18} style={{ color: 'var(--success-500)' }} />
                                            )}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                                <h5 style={{ margin: 0, fontSize: 'var(--text-sm)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.title}</h5>
                                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
                                                    {formatDate(item.date)}
                                                </span>
                                            </div>
                                            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {item.type === 'quiz' ? 'Quiz completed' : 'Task approved'} • Score: {item.score}%
                                            </p>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <div style={{
                                                fontSize: 'var(--text-md)',
                                                fontWeight: 700,
                                                color: 'var(--primary-500)'
                                            }}>
                                                +{item.xp} XP
                                            </div>
                                            <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)' }}>
                                                {formatRelativeTime(item.date)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            <style>{`
        @media (max-width: 768px) {
          .grid-cols-3, .advanced-stats-grid {
            grid-template-columns: repeat(1, 1fr) !important;
          }
        }
        @media (max-width: 480px) {
          .xp-history-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
        </div >
    );
};

export default Profile;
