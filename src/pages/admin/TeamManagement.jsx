import { useState, useEffect } from 'react';
import { Card, Button, Badge, Avatar, Modal, Input, ProgressBar } from '../../components/common';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    Search,
    UserPlus,
    Mail,
    Award,
    ListTodo,
    HelpCircle,
    Eye,
    Edit2,
    Trash2,
    Trophy,
    Key
} from 'lucide-react';
import * as db from '../../services/database';
import { formatDate, BADGES } from '../../utils/constants';
import { useMiniReload } from '../../hooks/useMiniReload';
import { PlatformService } from '../../services/infrastructure/PlatformService';

const TeamManagement = () => {
    const navigate = useNavigate();
    const { user, isAdmin } = useAuth();
    const [members, setMembers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMember, setSelectedMember] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [resetting, setResetting] = useState(false);

    useEffect(() => {
        loadMembers();

        // GOD COMMAND: REALTIME UPDATES
        const channel = supabase
            .channel('team-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                loadMembers();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => {
                loadMembers();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_attempts' }, () => {
                loadMembers();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    useMiniReload(() => loadMembers());

    const handleResetPassword = async (email) => {
        if (!window.confirm(`Are you sure you want to send a password reset email to ${email}?`)) {
            return;
        }

        try {
            const result = await db.sendPasswordResetEmail(email);
            if (result.success) {
                alert(`Password reset email has been sent to ${email}`);
            } else {
                alert(`Failed to send reset email: ${result.error}`);
            }
        } catch (error) {
            console.error('Reset password error:', error);
            alert('An unexpected error occurred while sending the reset email.');
        }
    };

    const handleDirectReset = async () => {
        if (!newPassword || newPassword.length < 6) {
            alert('Password must be at least 6 characters.');
            return;
        }

        setResetting(true);
        try {
            // Note: This requires a Supabase Edge Function or Admin API access
            // For now, we call the database service which will handle the logic
            const result = await db.adminResetPassword(selectedMember.id, newPassword);
            
            if (result.success) {
                alert(`Password for ${selectedMember.name} has been updated successfully!`);
                setShowPasswordModal(false);
                setNewPassword('');
            } else {
                alert(`Error: ${result.error || 'Failed to update password. You may need to enable the Admin Edge Function.'}`);
            }
        } catch (error) {
            console.error('Reset error:', error);
            alert('An unexpected error occurred.');
        } finally {
            setResetting(false);
        }
    };

    const loadMembers = async () => {
        try {
            setLoading(true);
            const [membersData, submissionsData, attemptsData] = await Promise.all([
                db.getMembers(),
                db.getSubmissions(),
                db.getQuizAttempts()
            ]);

            const enrichedMembers = membersData.map(user => {
                const userSubmissions = submissionsData.filter(s => s.user_id === user.id);
                const userQuizzes = attemptsData.filter(a => a.user_id === user.id);

                return {
                    ...user,
                    tasksCompleted: userSubmissions.filter(s => s.status === 'approved').length,
                    tasksPending: userSubmissions.filter(s => s.status === 'pending').length,
                    quizzesTaken: userQuizzes.length
                };
            });

            setMembers(enrichedMembers);
        } catch (error) {
            console.error('Error loading members:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredMembers = members.filter(member =>
        member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
            <div className="flex flex-mobile-col justify-between items-center mb-lg">
                <p style={{ color: 'var(--text-muted)' }}>
                    {isAdmin ? 'View and manage your team members' : 'View the members in your classroom'}
                </p>
                {isAdmin && (
                    <Button icon={UserPlus} onClick={() => navigate('/admin/invite-codes')}>
                        Manage Invites
                    </Button>
                )}
            </div>

            {/* Search */}
            <Card style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-md)' }}>
                <Input
                    placeholder="Search members..."
                    icon={Search}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </Card>

            {/* Stats Bar */}
            <div className="team-stats-grid mb-lg">
                <Card style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
                    <h3 style={{ fontSize: 'var(--text-2xl)', margin: 0 }}>{members.length}</h3>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, marginTop: '4px' }}>
                        Total Members
                    </p>
                </Card>
                <Card style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
                    <h3 style={{ fontSize: 'var(--text-2xl)', margin: 0 }}>
                        {members.reduce((sum, m) => sum + m.tasksCompleted, 0)}
                    </h3>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, marginTop: '4px' }}>
                        Tasks Completed
                    </p>
                </Card>
                <Card style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
                    <h3 style={{ fontSize: 'var(--text-2xl)', margin: 0 }}>
                        {members.reduce((sum, m) => sum + m.quizzesTaken, 0)}
                    </h3>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, marginTop: '4px' }}>
                        Quizzes Taken
                    </p>
                </Card>
                <Card style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
                    <h3 style={{ fontSize: 'var(--text-2xl)', margin: 0 }}>
                        {members.reduce((sum, m) => sum + (m.xp || 0), 0).toLocaleString()}
                    </h3>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, marginTop: '4px' }}>
                        Total XP Earned
                    </p>
                </Card>
            </div>

            {/* Desktop Members Table */}
            <div className="desktop-team-view">
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Member</th>
                                    <th>XP</th>
                                    <th>Tasks</th>
                                    <th>Quizzes</th>
                                    <th>Badges</th>
                                    <th>Joined</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMembers.map(member => (
                                    <tr key={member.id}>
                                        <td>
                                            <div className="flex items-center gap-md">
                                                <Avatar name={member.name} image={member.avatar_url} size="md" />
                                                <div>
                                                    <p style={{ margin: 0, fontWeight: 500 }}>{member.name}</p>
                                                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                                        {member.email}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ color: 'var(--primary-400)', fontWeight: 600 }}>
                                                {(member.xp || 0).toLocaleString()}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-xs">
                                                <span style={{ color: 'var(--success-500)' }}>{member.tasksCompleted}</span>
                                                {member.tasksPending > 0 && (
                                                    <Badge variant="warning" style={{ fontSize: '10px' }}>
                                                        {member.tasksPending} pending
                                                    </Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td>{member.quizzesTaken}</td>
                                        <td>
                                            <div className="flex gap-xs">
                                                {member.badges?.slice(0, 3).map(badgeId => {
                                                    const badge = BADGES.find(b => b.id === badgeId);
                                                    return badge ? (
                                                        <span key={badgeId} title={badge.name} style={{ fontSize: '18px' }}>
                                                            {badge.icon}
                                                        </span>
                                                    ) : null;
                                                })}
                                                {(member.badges?.length || 0) > 3 && (
                                                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                                        +{member.badges.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                                            {formatDate(member.created_at)}
                                        </td>
                                        <td className="flex justify-end items-center gap-xs">
                                            {isAdmin && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        setSelectedMember(member);
                                                        setShowPasswordModal(true);
                                                    }}
                                                    title="Directly Set New Password"
                                                    style={{ color: 'var(--warning-500)' }}
                                                >
                                                    <Key size={16} />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => navigate(isAdmin ? `/admin/member/${member.id}` : `/profile/${member.id}`)}
                                                title="View Details"
                                            >
                                                <Eye size={16} />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            {/* Mobile Members List */}
            <div className="mobile-team-view">
                <div className="flex flex-col gap-md">
                    {filteredMembers.map(member => (
                        <Card key={member.id} className="mobile-member-card" style={{ padding: 'var(--space-md)' }}>
                            <div className="flex justify-between items-start mb-md">
                                <div className="flex items-center gap-md">
                                    <Avatar name={member.name} image={member.avatar_url} size="md" />
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 600, fontSize: '1rem' }}>{member.name}</p>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{member.email}</p>
                                    </div>
                                </div>
                                <span style={{ color: 'var(--primary-400)', fontWeight: 700, fontSize: '1.1rem' }}>
                                    {(member.xp || 0).toLocaleString()} XP
                                </span>
                            </div>

                            <div className="mobile-member-stats">
                                <div className="stat-pill">
                                    <span className="stat-label">Tasks</span>
                                    <div className="flex items-center gap-xs">
                                        <span className="stat-val text-success">{member.tasksCompleted}</span>
                                        {member.tasksPending > 0 && <span className="stat-warn">({member.tasksPending} pend)</span>}
                                    </div>
                                </div>
                                <div className="stat-pill">
                                    <span className="stat-label">Quizzes</span>
                                    <span className="stat-val">{member.quizzesTaken}</span>
                                </div>
                                <div className="stat-pill">
                                    <span className="stat-label">Badges</span>
                                    <div className="flex gap-xs items-center">
                                        {member.badges?.slice(0, 3).map(badgeId => {
                                            const badge = BADGES.find(b => b.id === badgeId);
                                            return badge ? <span key={badgeId} style={{ fontSize: '16px' }}>{badge.icon}</span> : null;
                                        })}
                                        {(member.badges?.length || 0) > 3 && (
                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>+{member.badges.length - 3}</span>
                                        )}
                                        {(!member.badges || member.badges.length === 0) && <span className="stat-val">0</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center mt-md pt-md border-t">
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Joined {formatDate(member.created_at)}</span>
                                <div className="flex gap-sm">
                                    {isAdmin && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setSelectedMember(member);
                                                setShowPasswordModal(true);
                                            }}
                                            style={{ color: 'var(--warning-500)', padding: '0.5rem' }}
                                        >
                                            <Key size={16} />
                                        </Button>
                                    )}
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => navigate(isAdmin ? `/admin/member/${member.id}` : `/profile/${member.id}`)}
                                        style={{ padding: '0.5rem 1rem' }}
                                    >
                                        View Profile
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Password Reset Modal */}
            <Modal
                isOpen={showPasswordModal}
                onClose={() => setShowPasswordModal(false)}
                title={`Set Password for ${selectedMember?.name}`}
                size="sm"
            >
                <div className="flex flex-col gap-md">
                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                        Since you are using fake emails, this will directly update the password in the system.
                    </p>
                    <Input
                        type="password"
                        label="New Password"
                        placeholder="Min 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                    />
                    <div className="flex gap-sm mt-md">
                        <Button
                            variant="secondary"
                            onClick={() => setShowPasswordModal(false)}
                            style={{ flex: 1 }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDirectReset}
                            loading={resetting}
                            style={{ flex: 1 }}
                        >
                            Update Password
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Invite Modal */}
            <Modal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                title="Invite Team Member"
                size="sm"
            >
                <div className="flex flex-col gap-md">
                    <p style={{ color: 'var(--text-muted)' }}>
                        Share this link with new team members to invite them to join Zenith.
                    </p>
                    <div style={{
                        padding: 'var(--space-md)',
                        background: 'var(--card)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        wordBreak: 'break-all',
                        fontSize: 'var(--text-sm)'
                    }}>
                        {PlatformService.getApiUrl()}/register
                    </div>
                    <Button
                        onClick={() => {
                            navigator.clipboard.writeText(`${PlatformService.getApiUrl()}/register`);
                            alert('Link copied to clipboard!');
                        }}
                    >
                        Copy Invite Link
                    </Button>
                </div>
            </Modal>

            <style>{`
                .team-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: var(--space-md);
                }
                
                .mobile-team-view {
                    display: none;
                }
                
                .desktop-team-view {
                    display: block;
                }
                
                .border-t {
                    border-top: 1px solid var(--border);
                }

                @media (max-width: 768px) {
                    .team-stats-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                    
                    .desktop-team-view {
                        display: none;
                    }
                    
                    .mobile-team-view {
                        display: block;
                    }
                    
                    .mobile-member-card {
                        transition: transform 0.2s, box-shadow 0.2s;
                    }
                    
                    .mobile-member-card:active {
                        transform: scale(0.98);
                    }

                    .mobile-member-stats {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: var(--space-sm);
                        background: var(--background);
                        padding: var(--space-sm);
                        border-radius: var(--radius-md);
                        margin-bottom: var(--space-sm);
                    }

                    .stat-pill {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        text-align: center;
                    }

                    .stat-label {
                        font-size: 0.65rem;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        color: var(--text-muted);
                        margin-bottom: 2px;
                    }

                    .stat-val {
                        font-weight: 600;
                        font-size: 0.9rem;
                    }
                    
                    .text-success {
                        color: var(--success-500);
                    }
                    
                    .stat-warn {
                        color: var(--warning-500);
                        font-size: 0.7rem;
                        font-weight: 500;
                    }
                }
            `}</style>
        </div>
    );
};

export default TeamManagement;
