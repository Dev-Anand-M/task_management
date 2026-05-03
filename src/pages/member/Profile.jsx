import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, Avatar, Modal } from '../../components/common';
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
    Shield
} from 'lucide-react';
import * as db from '../../services/database';

const Profile = ({ userId = null, readonly = false }) => {
    const { user: authUser, updateProfile, refreshUser } = useAuth();
    const [profileData, setProfileData] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        tasksCompleted: 0,
        quizzesPassed: 0,
        avgScore: 0
    });
    const fileInputRef = useRef(null);

    // Determine which user ID to use
    // If userId prop is passed, use that (Admin View). Otherwise use logged-in user (Self View).
    const targetUserId = userId || authUser?.id;

    const loadProfileData = useCallback(async () => {
        if (!targetUserId) return;
        setLoading(true);
        try {
            // If viewing self, use authUser which is already loaded (mostly), but simple getProfileById ensures fresh data
            // If viewing others, must fetch
            let data = null;
            if (!userId) {
                data = authUser;
            } else {
                data = await db.getProfileById(userId);
            }
            // Ensure we use the latest avatar_url if available
            if (!userId && authUser) {
                // Refresh handled by auth context usually, but ensure we have latest
                // data = ...
            }

            setProfileData(data);
            if (data?.name) setName(data.name);

            // Load Stats
            const [submissions, quizAttempts, tasks] = await Promise.all([
                db.getSubmissionsByUser(targetUserId),
                db.getQuizAttemptsByUser(targetUserId),
                db.getTasks() // Need tasks for category/difficulty info
            ]);

            const approved = submissions.filter(s => s.status === 'approved');
            const passed = quizAttempts.filter(a => a.passed);
            const scoredSubmissions = approved.filter(s => s.score);
            const avgScore = scoredSubmissions.length > 0
                ? Math.round(scoredSubmissions.reduce((sum, s) => sum + s.score, 0) / scoredSubmissions.length)
                : 0;

            // Aggregate Category & Difficulty Stats
            // Create map of tasks for quick lookup
            const taskMap = new Map(tasks.map(t => [t.id, t]));

            const categoryCounts = {};
            const difficultyCounts = {};

            approved.forEach(sub => {
                const task = taskMap.get(sub.task_id);
                if (task) {
                    // Category
                    const cat = task.category || 'Uncategorized';
                    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

                    // Difficulty
                    const diff = task.difficulty || 'Normal';
                    difficultyCounts[diff] = (difficultyCounts[diff] || 0) + 1;
                }
            });

            const categoryStats = Object.entries(categoryCounts)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5); // Top 5 categories

            setStats({
                tasksCompleted: approved.length,
                quizzesPassed: passed.length,
                avgScore,
                categoryStats,
                difficultyStats: difficultyCounts
            });

        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            setLoading(false);
        }
    }, [userId, authUser, targetUserId]);

    useEffect(() => {
        loadProfileData();
    }, [loadProfileData]);

    const handleSave = async () => {
        if (readonly) return;
        // Only update if it's the current user
        if (!userId) {
            await updateProfile({ name });
            await refreshUser();
            setIsEditing(false);
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert('File is too large. Max 5MB.');
            return;
        }

        try {
            // Optimistic update or loading state could be here
            const url = await db.uploadAvatar(authUser.id, file);
            await updateProfile({ avatar_url: url });
            await refreshUser();

            // Update local state temporarily to show immediate change
            setProfileData(prev => ({ ...prev, avatar_url: url }));
        } catch (err) {
            console.error('Avatar upload error:', err);
            alert('Failed to upload avatar. Please try again.');
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
                        {profileData.avatar_url ? (
                            <img
                                src={profileData.avatar_url}
                                alt={profileData.name}
                                style={{
                                    width: '96px',
                                    height: '96px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: '4px solid rgba(255,255,255,0.2)'
                                }}
                            />
                        ) : (
                            <Avatar name={profileData.name} size="xl" />
                        )}

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

            <style>{`
        @media (max-width: 768px) {
          .grid-cols-3, .advanced-stats-grid {
            grid-template-columns: repeat(1, 1fr) !important;
          }
        }
      `}</style>
        </div >
    );
};

export default Profile;
