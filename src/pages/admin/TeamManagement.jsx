import { useState, useEffect } from 'react';
import { Card, Button, Badge, Avatar, Modal, Input, ProgressBar } from '../../components/common';
import { useNavigate } from 'react-router-dom';
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
import { formatDate, calculateLevel, calculateLevelProgress, BADGES } from '../../utils/constants';

const TeamManagement = () => {
    const navigate = useNavigate();
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
    }, []);

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
                    View and manage your team members
                </p>
                <Button icon={UserPlus} onClick={() => navigate('/admin/invite-codes')}>
                    Manage Invites
                </Button>
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
            <div className="grid grid-cols-4 stat-card-grid mb-lg" style={{ gap: 'var(--space-md)' }}>
                <Card style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
                    <h3 style={{ fontSize: 'var(--text-2xl)', margin: 0 }}>{members.length}</h3>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>
                        Total Members
                    </p>
                </Card>
                <Card style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
                    <h3 style={{ fontSize: 'var(--text-2xl)', margin: 0 }}>
                        {members.reduce((sum, m) => sum + m.tasksCompleted, 0)}
                    </h3>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>
                        Tasks Completed
                    </p>
                </Card>
                <Card style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
                    <h3 style={{ fontSize: 'var(--text-2xl)', margin: 0 }}>
                        {members.reduce((sum, m) => sum + m.quizzesTaken, 0)}
                    </h3>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>
                        Quizzes Taken
                    </p>
                </Card>
                <Card style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
                    <h3 style={{ fontSize: 'var(--text-2xl)', margin: 0 }}>
                        {members.reduce((sum, m) => sum + (m.xp || 0), 0).toLocaleString()}
                    </h3>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>
                        Total XP Earned
                    </p>
                </Card>
            </div>

            {/* Members Table */}
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
                            {filteredMembers.map(member => {
                                // calculateLevelProgress might still be used if we wanted a progress bar, but user asked to remove Level.
                                // If we remove the Level column, we should check if we want to keep the progress bar.
                                // User said "remove level from everything".

                                return (
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
                                                        <span
                                                            key={badgeId}
                                                            title={badge.name}
                                                            style={{ fontSize: '18px' }}
                                                        >
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
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => navigate(`/admin/member/${member.id}`)}
                                                title="View Details"
                                            >
                                                <Eye size={16} />
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>



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
                        {window.location.origin}/register
                    </div>
                    <Button
                        onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/register`);
                            alert('Link copied to clipboard!');
                        }}
                    >
                        Copy Invite Link
                    </Button>
                </div>
            </Modal>

        </div>
    );
};

export default TeamManagement;
