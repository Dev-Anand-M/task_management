import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, Avatar, Modal } from '../../components/common';
import { Camera, Save, Edit2, Shield, Mail, Activity } from 'lucide-react';
import * as db from '../../services/database';
import { useMiniReload } from '../../hooks/useMiniReload';

const AdminProfile = () => {
    const { user: authUser, updateProfile, refreshUser } = useAuth();
    const [profileData, setProfileData] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(true);
    const [isZoomed, setIsZoomed] = useState(false);
    const fileInputRef = useRef(null);

    // For admins, we just load their basic profile and maybe some quick stats
    const [adminStats, setAdminStats] = useState({
        classrooms: 0,
        members: 0
    });

    const loadProfileData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const data = await db.getProfileById(authUser.id);
            if (data) {
                setProfileData(data);
                setName(data.name || '');
            }

            // Quick stats
            const classrooms = await db.getClassrooms();
            const members = await db.getMembers();
            setAdminStats({
                classrooms: classrooms?.length || 0,
                members: members?.length || 0
            });
        } catch (error) {
            console.error('[AdminProfile] Error loading profile:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (authUser?.id) {
            loadProfileData();
        }
    }, [authUser]);

    useMiniReload(() => loadProfileData(true));

    const handleSave = async () => {
        await updateProfile({ name });
        await refreshUser();
        setIsEditing(false);
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert('File is too large. Max 5MB.');
            return;
        }

        try {
            const url = await db.uploadAvatar(authUser.id, file);
            await updateProfile({ avatar_url: url });
            await refreshUser();
            setProfileData(prev => ({ ...prev, avatar_url: url }));
        } catch (err) {
            console.error('Avatar upload error:', err);
            alert('Failed to upload avatar.');
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
                    </div>

                    {/* Edit/Action Button Top Right */}
                    <div style={{ position: 'absolute', top: 0, right: 0 }}>
                        {!isEditing && (
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
                                    transition: 'all 0.2s'
                                }}
                                className="hover:bg-white/30"
                            >
                                <Edit2 size={16} />
                            </button>
                        )}
                    </div>

                    <div style={{ flex: 1 }}>
                        {isEditing ? (
                            <div className="flex items-center gap-sm" style={{ marginBottom: '0.5rem' }}>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    style={{
                                        background: 'rgba(255,255,255,0.2)',
                                        border: '1px solid rgba(255,255,255,0.4)',
                                        color: 'white',
                                        padding: '0.5rem 1rem',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 'var(--text-xl)',
                                        fontWeight: 700,
                                        outline: 'none',
                                        width: '100%',
                                        maxWidth: '300px'
                                    }}
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                />
                                <button
                                    onClick={handleSave}
                                    style={{
                                        background: 'white',
                                        color: 'var(--primary-600)',
                                        border: 'none',
                                        padding: '0.5rem 1rem',
                                        borderRadius: 'var(--radius-md)',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    <Save size={16} /> Save
                                </button>
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        setName(profileData.name || '');
                                    }}
                                    style={{
                                        background: 'transparent',
                                        color: 'white',
                                        border: '1px solid rgba(255,255,255,0.4)',
                                        padding: '0.5rem 1rem',
                                        borderRadius: 'var(--radius-md)',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <h2 style={{ fontSize: 'var(--text-3xl)', margin: '0 0 0.5rem 0', fontWeight: 800 }}>
                                {profileData.name || 'Admin User'}
                            </h2>
                        )}

                        <div style={{ display: 'flex', gap: '1rem', color: 'rgba(255,255,255,0.9)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Mail size={16} /> {profileData.email}
                            </span>
                        </div>
                        
                        <div style={{ display: 'inline-block', marginTop: 'var(--space-sm)' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'rgba(255,255,255,0.2)',
                                padding: '4px 12px',
                                borderRadius: '20px',
                                fontSize: 'var(--text-sm)',
                                fontWeight: 700,
                                letterSpacing: '0.05em'
                            }}>
                                <Shield size={14} /> ADMINISTRATOR
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-lg)' }}>
                {/* Admin Quick Stats */}
                <Card>
                    <div className="flex items-center gap-md mb-md">
                        <div style={{ padding: '8px', background: 'var(--primary-100)', color: 'var(--primary-600)', borderRadius: 'var(--radius-md)' }}>
                            <Activity size={20} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>System Overview</h3>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 'var(--space-sm)', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Active Classrooms</span>
                            <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text)' }}>{adminStats.classrooms}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Total Members</span>
                            <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text)' }}>{adminStats.members}</span>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Avatar Zoom Modal */}
            <Modal isOpen={isZoomed} onClose={() => setIsZoomed(false)} title="Profile Picture">
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 'var(--space-md)' }}>
                    {profileData?.avatar_url ? (
                        <img 
                            src={profileData.avatar_url} 
                            alt={profileData.name} 
                            style={{ 
                                maxWidth: '100%', 
                                maxHeight: '70vh', 
                                borderRadius: 'var(--radius-lg)',
                                objectFit: 'contain',
                                boxShadow: 'var(--shadow-xl)'
                            }} 
                        />
                    ) : (
                        <div style={{
                            width: '250px',
                            height: '250px',
                            background: 'var(--gradient-primary)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '6rem',
                            fontWeight: 700,
                            borderRadius: '50%',
                            boxShadow: 'var(--shadow-xl)'
                        }}>
                            {profileData?.name?.charAt(0)?.toUpperCase() || 'A'}
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default AdminProfile;
