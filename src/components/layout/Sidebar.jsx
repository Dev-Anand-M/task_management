import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import * as db from '../../services/database';
import {
    LayoutDashboard,
    ListTodo,
    HelpCircle,
    Trophy,
    Users,
    ClipboardCheck,
    User,
    LogOut,
    Zap,
    ChevronRight,
    ChevronDown,
    Key,
    Settings,
    School,
    Brain,
    Code,
    GraduationCap,
    MessageSquare,
    Database,
    Calendar,
    Target,
    RefreshCw,
    Power
} from 'lucide-react';
import Avatar from '../common/Avatar';
import { PlatformService } from '../../services/infrastructure/PlatformService';
import { App as CapApp } from '@capacitor/app';

const Sidebar = ({ isOpen, onClose }) => {
    const { user, isAdmin, logout, forceRefresh } = useAuth();
    const [classrooms, setClassrooms] = useState([]);
    const [showClassroomMenu, setShowClassroomMenu] = useState(false);
    const [showAiTools, setShowAiTools] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    useEffect(() => {
        if (isAdmin) {
            db.getClassrooms().then(setClassrooms).catch(console.error);
        }
    }, [isAdmin]);

    const handleSwitchClassroom = async (classroomId) => {
        try {
            await db.switchClassroom(classroomId);
            // Force refresh auth context instead of full page reload
            await forceRefresh();
            // Reload classrooms list
            if (isAdmin) {
                const updatedClassrooms = await db.getClassrooms();
                setClassrooms(updatedClassrooms);
            }
            setShowClassroomMenu(false);
            // Trigger micro-reload so all pages re-fetch data for the new classroom
            window.dispatchEvent(new CustomEvent('zenith-refresh'));
        } catch (error) {
            console.error('Failed to switch classroom:', error);
            alert('Failed to switch classroom. Please try again.');
        }
    };


    const adminLinks = [
        { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
        { to: '/admin/tasks', icon: ListTodo, label: 'Tasks' },
        { to: '/admin/quizzes', icon: HelpCircle, label: 'Quizzes' },
        { to: '/admin/evaluations', icon: ClipboardCheck, label: 'Evaluations' },
        { to: '/admin/team', icon: Users, label: 'Team' },
        { to: '/admin/invite-codes', icon: Key, label: 'Invite Codes' },
        { to: '/admin/classroom', icon: School, label: 'Classroom' },
        { to: '/knowledge-base', icon: Database, label: 'Knowledge Base' },
        { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
        { to: '/settings', icon: Settings, label: 'Settings' }
    ];

    const memberLinks = [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', exact: true },
        { to: '/tasks', icon: ListTodo, label: 'Tasks' },
        { to: '/quizzes', icon: HelpCircle, label: 'Quizzes' },
        { to: '/study-materials', icon: Brain, label: 'Study Materials' },
        { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
        { to: '/team', icon: Users, label: 'Team' },
        { to: '/calendar', icon: Calendar, label: 'Calendar' },
        { to: '/profile', icon: User, label: 'Profile' },
        { to: '/settings', icon: Settings, label: 'Settings' }
    ];

    const consistencyLinks = [
        { to: '/routines', icon: RefreshCw, label: 'Routines' },
        { to: '/timetable', icon: ListTodo, label: 'AI Timetable' },
        { to: '/diary', icon: Target, label: 'Learning Diary' }
    ];

    const memberAiLinks = [
        { to: '/diary?view=mindmap', icon: Brain, label: 'Mindmap' },
        { to: '/ai/assistant', icon: MessageSquare, label: 'AI Assistant' }
    ];

    const aiLinks = [
        { to: '/ai/assistant', icon: MessageSquare, label: 'AI Assistant' },
        { to: '/ai/code-review', icon: Code, label: 'Code Review' },
        { to: '/ai/study-tools', icon: GraduationCap, label: 'Study Tools' },
        { to: '/ai/quiz-generator', icon: Brain, label: 'Quiz Generator' }
    ];

    const links = isAdmin ? adminLinks : memberLinks;

    return (
        <>
            {/* Mobile overlay */}
            {isOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={onClose}
                />
            )}

            <aside className={`sidebar ${isOpen ? 'open' : 'collapsed'}`}>
                {/* Logo */}
                <div style={{
                    padding: 'var(--space-lg)',
                    borderBottom: '1px solid var(--sidebar-border, rgba(255,255,255,0.2))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-sm)'
                }}>
                    <div className="flex items-center gap-sm">
                            <img 
                                src="/zenith.png" 
                                alt="Zenith" 
                                style={{ 
                                    width: '32px', 
                                    height: '32px', 
                                    objectFit: 'contain',
                                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
                                }} 
                            />
                        <div>
                            <h2 style={{
                                fontSize: 'var(--text-base)',
                                fontWeight: 700,
                                margin: 0,
                                color: 'var(--sidebar-text, white)',
                                letterSpacing: '-0.02em'
                            }}>
                                Zenith
                            </h2>
                            <span style={{
                                fontSize: '10px',
                                color: 'var(--sidebar-text-muted, rgba(255,255,255,0.75))',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                {isAdmin ? 'Admin' : 'Member'}
                            </span>
                        </div>
                    </div>
                </div>

                <nav style={{ flex: 1, padding: 'var(--space-sm)', overflowY: 'auto' }}>
                    {/* Get Mobile App promo - Only on web */}
                    {!PlatformService.isNative() && (
                        <div style={{
                            margin: '0 var(--space-xs) var(--space-md)',
                            padding: 'var(--space-sm) var(--space-md)',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px dashed rgba(255, 255, 255, 0.15)',
                            borderRadius: 'var(--radius-lg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 'var(--space-sm)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '18px' }}>🤖</span>
                                <div style={{ textAlign: 'left' }}>
                                    <h4 style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: 'var(--sidebar-text, white)', lineHeight: '1.2' }}>Zenith App</h4>
                                    <p style={{ margin: 0, fontSize: '9px', color: 'var(--sidebar-text-muted, rgba(255,255,255,0.6))', lineHeight: '1.2' }}>Get Android APK</p>
                                </div>
                            </div>
                            <a
                                href="/zenith-v1.0.0.apk"
                                download
                                style={{
                                    padding: '4px 10px',
                                    background: '#10b981',
                                    color: 'white',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    textDecoration: 'none',
                                    transition: 'opacity 0.2s',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                }}
                                className="hover:opacity-90 active:scale-95"
                            >
                                Download
                            </a>
                        </div>
                    )}
                    {isAdmin && (
                        <div style={{ position: 'relative', margin: '0 var(--space-sm) var(--space-sm)' }}>
                            <div
                                onClick={() => setShowClassroomMenu(!showClassroomMenu)}
                                style={{
                                    padding: '8px 12px',
                                    background: 'var(--sidebar-hover, rgba(255,255,255,0.1))',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--sidebar-border, rgba(255,255,255,0.2))',
                                    cursor: 'pointer',
                                    transition: 'background var(--transition-fast)'
                                }}
                                className="classroom-selector"
                            >
                                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--sidebar-text-muted, rgba(255,255,255,0.6))', letterSpacing: '0.05em', marginBottom: '4px' }}>
                                    Current Classroom
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 500, fontSize: '14px', color: 'var(--sidebar-text, white)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                        <School size={14} style={{ color: '#fbbf24', flexShrink: 0 }} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {user?.classroom_id ? classrooms.find(c => c.id === user.classroom_id)?.name : 'All Classrooms'}
                                        </span>
                                    </div>
                                    <ChevronRight size={14} style={{ flexShrink: 0, transform: showClassroomMenu ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                                </div>
                            </div>

                            {showClassroomMenu && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    marginTop: '4px',
                                    background: 'var(--card, #292524)',
                                    backdropFilter: 'var(--glass-blur, blur(12px))',
                                    border: '1px solid var(--sidebar-border, rgba(255,255,255,0.1))',
                                    borderRadius: 'var(--radius-md)',
                                    zIndex: 50,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                    overflow: 'hidden'
                                }}>
                                    <div
                                        onClick={() => handleSwitchClassroom(null)}
                                        style={{
                                            padding: '8px 12px',
                                            fontSize: 'var(--text-sm)',
                                            color: !user?.classroom_id ? 'var(--sidebar-active-text, #fef3c7)' : 'var(--sidebar-text-muted, rgba(255,255,255,0.8))',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid var(--sidebar-border, rgba(255,255,255,0.1))'
                                        }}
                                        className="hover:bg-white/10"
                                    >
                                        All Classrooms
                                    </div>
                                    {classrooms.map(c => (
                                        <div
                                            key={c.id}
                                            onClick={() => handleSwitchClassroom(c.id)}
                                            style={{
                                                padding: '8px 12px',
                                                fontSize: 'var(--text-sm)',
                                                color: user?.classroom_id === c.id ? 'var(--sidebar-active-text, #fef3c7)' : 'var(--sidebar-text-muted, rgba(255,255,255,0.8))',
                                                cursor: 'pointer'
                                            }}
                                            className="hover:bg-white/10"
                                        >
                                            {c.name}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{
                        fontSize: '10px',
                        color: 'var(--sidebar-text-muted, rgba(255,255,255,0.6))',
                        padding: '0 var(--space-sm) var(--space-xs)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        fontWeight: 600
                    }}>
                        Navigation
                    </div>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {links.map(link => (
                            <li key={link.to}>
                                <NavLink
                                    to={link.to}
                                    end={link.exact}
                                    replace={true}
                                    onClick={onClose}
                                    style={({ isActive }) => ({
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-sm)',
                                        padding: '0.625rem var(--space-md)',
                                        borderRadius: 'var(--radius-md)',
                                        color: isActive ? 'var(--sidebar-active-text, #fef3c7)' : 'var(--sidebar-text, rgba(255,255,255,0.8))',
                                        background: isActive ? 'var(--sidebar-active-bg, rgba(255,255,255,0.2))' : 'transparent',
                                        textDecoration: 'none',
                                        fontSize: 'var(--text-sm)',
                                        fontWeight: isActive ? 600 : 500,
                                        transition: 'all var(--transition-fast)',
                                        borderLeft: isActive ? '2px solid var(--sidebar-active-text, #fef3c7)' : '2px solid transparent',
                                        marginLeft: '0'
                                    })}
                                >
                                    <link.icon size={18} />
                                    <span style={{ flex: 1 }}>{link.label}</span>
                                </NavLink>
                            </li>
                        ))}
                    </ul>

                    {!isAdmin && (
                        <>
                            <div style={{
                                fontSize: '10px',
                                color: 'var(--sidebar-text-muted, rgba(255,255,255,0.6))',
                                padding: 'var(--space-md) var(--space-sm) var(--space-xs)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                fontWeight: 600
                            }}>
                                Consistency
                            </div>
                            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {consistencyLinks.map(link => (
                                    <li key={link.to}>
                                        <NavLink
                                            to={link.to}
                                            replace={true}
                                            onClick={onClose}
                                            style={({ isActive }) => ({
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--space-sm)',
                                                padding: '0.625rem var(--space-md)',
                                                borderRadius: 'var(--radius-md)',
                                                color: isActive ? 'var(--sidebar-active-text, #fef3c7)' : 'var(--sidebar-text, rgba(255,255,255,0.8))',
                                                background: isActive ? 'var(--sidebar-active-bg, rgba(255,255,255,0.2))' : 'transparent',
                                                textDecoration: 'none',
                                                fontSize: 'var(--text-sm)',
                                                fontWeight: isActive ? 600 : 500,
                                                transition: 'all var(--transition-fast)',
                                                borderLeft: isActive ? 'var(--sidebar-active-text, #fef3c7)' : '2px solid transparent',
                                                marginLeft: '0'
                                            })}
                                        >
                                            <link.icon size={18} />
                                            <span style={{ flex: 1 }}>{link.label}</span>
                                        </NavLink>
                                    </li>
                                ))}
                            </ul>

                            <div style={{
                                fontSize: '10px',
                                color: 'var(--sidebar-text-muted, rgba(255,255,255,0.6))',
                                padding: 'var(--space-md) var(--space-sm) var(--space-xs)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                fontWeight: 600
                            }}>
                                AI Labs
                            </div>
                            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {memberAiLinks.map(link => (
                                    <li key={link.to}>
                                        <NavLink
                                            to={link.to}
                                            replace={true}
                                            onClick={onClose}
                                            style={({ isActive }) => ({
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--space-sm)',
                                                padding: '0.625rem var(--space-md)',
                                                borderRadius: 'var(--radius-md)',
                                                color: isActive ? 'var(--sidebar-active-text, #fef3c7)' : 'var(--sidebar-text, rgba(255,255,255,0.8))',
                                                background: isActive ? 'var(--sidebar-active-bg, rgba(255,255,255,0.2))' : 'transparent',
                                                textDecoration: 'none',
                                                fontSize: 'var(--text-sm)',
                                                fontWeight: isActive ? 600 : 500,
                                                transition: 'all var(--transition-fast)',
                                                borderLeft: isActive ? 'var(--sidebar-active-text, #fef3c7)' : '2px solid transparent',
                                                marginLeft: '0'
                                            })}
                                        >
                                            <link.icon size={18} />
                                            <span style={{ flex: 1 }}>{link.label}</span>
                                        </NavLink>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}

                    {/* AI Tools Section - Only for Admins to manage or view advanced tools */}
                    {isAdmin && (
                        <>
                            <div
                                onClick={() => setShowAiTools(!showAiTools)}
                                style={{
                                    fontSize: '10px',
                                    color: 'var(--sidebar-text-muted, rgba(255,255,255,0.6))',
                                    padding: 'var(--space-md) var(--space-sm) var(--space-xs)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    cursor: 'pointer',
                                    userSelect: 'none'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                                    <Brain size={12} />
                                    AI Tools
                                    <span style={{
                                        background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
                                        color: 'white',
                                        fontSize: '8px',
                                        padding: '2px 6px',
                                        borderRadius: '10px',
                                        fontWeight: 700,
                                        letterSpacing: '0.05em',
                                        marginLeft: '4px'
                                    }}>
                                        BETA
                                    </span>
                                </div>
                                <ChevronRight
                                    size={14}
                                    style={{
                                        transform: showAiTools ? 'rotate(90deg)' : 'none',
                                        transition: 'transform 0.2s'
                                    }}
                                />
                            </div>

                            {showAiTools && (
                                <ul className="animate-fade-in" style={{ 
                                    listStyle: 'none', 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '4px',
                                    padding: 'var(--space-xs) 0',
                                    margin: '0 var(--space-xs)',
                                    background: 'var(--sidebar-hover, rgba(167, 139, 250, 0.05))',
                                    borderRadius: 'var(--radius-lg)',
                                    border: '1px solid var(--sidebar-border, rgba(167, 139, 250, 0.1))'
                                }}>
                                    {aiLinks.map(link => (
                                        <li key={link.to}>
                                            <NavLink
                                                to={link.to}
                                                replace={true}
                                                onClick={onClose}
                                                style={({ isActive }) => ({
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 'var(--space-sm)',
                                                    padding: '0.75rem var(--space-md)',
                                                    borderRadius: 'var(--radius-md)',
                                                    color: isActive ? 'var(--sidebar-active-text, white)' : 'var(--sidebar-text-muted, rgba(255,255,255,0.7))',
                                                    background: isActive ? 'var(--sidebar-active-bg, linear-gradient(135deg, #a78bfa, #8b5cf6))' : 'transparent',
                                                    textDecoration: 'none',
                                                    fontSize: 'var(--text-sm)',
                                                    fontWeight: isActive ? 600 : 500,
                                                    transition: 'all var(--transition-fast)',
                                                    boxShadow: isActive ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none'
                                                })}
                                            >
                                                <link.icon size={18} />
                                                <span style={{ flex: 1 }}>{link.label}</span>
                                            </NavLink>
                                        </li>
                                    ))}
                                </ul>
                </nav>

                {/* User Profile Section */}
                <div style={{
                    padding: 'var(--space-md)',
                    borderTop: '1px solid var(--sidebar-border, rgba(255,255,255,0.2))',
                    background: 'var(--sidebar-hover, rgba(0,0,0,0.15))'
                }}>
                    <div className="flex items-center gap-sm">
                        <Avatar name={user?.name} image={user?.avatar_url} size="sm" />
                        <Link 
                            to="/profile" 
                            onClick={onClose}
                            style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}
                        >
                            <p style={{
                                fontWeight: 600,
                                fontSize: 'var(--text-sm)',
                                color: 'var(--sidebar-text, white)',
                                margin: 0,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}>
                                {user?.name}
                            </p>
                            <p style={{
                                fontSize: '10px',
                                color: 'var(--sidebar-text-muted, rgba(255,255,255,0.75))',
                                margin: 0,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}>
                                {user?.email}
                            </p>
                        </Link>
                        {PlatformService.isNative() ? (
                            <button
                                onClick={() => setShowLogoutConfirm(true)}
                                style={{
                                    background: 'var(--sidebar-hover, rgba(255,255,255,0.15))',
                                    border: '1px solid var(--sidebar-border, rgba(255,255,255,0.25))',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    padding: 'var(--space-xs)',
                                    borderRadius: 'var(--radius-md)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all var(--transition-fast)'
                                }}
                                title="Exit App"
                            >
                                <Power size={14} />
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowLogoutConfirm(true)}
                                style={{
                                    background: 'var(--sidebar-hover, rgba(255,255,255,0.15))',
                                    border: '1px solid var(--sidebar-border, rgba(255,255,255,0.25))',
                                    color: 'var(--sidebar-text, white)',
                                    cursor: 'pointer',
                                    padding: 'var(--space-xs)',
                                    borderRadius: 'var(--radius-md)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all var(--transition-fast)'
                                }}
                                title="Logout"
                            >
                                <LogOut size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            <style>{`
        @media (max-width: 1024px) {
          .sidebar-overlay {
            display: block !important;
          }
        }
      `}</style>
            {showLogoutConfirm && createPortal(
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 99999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 'var(--space-md)'
                }}>
                    <div className="animate-slide-up" style={{
                        background: 'var(--dark-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '24px',
                        padding: '32px',
                        width: '100%',
                        maxWidth: '360px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        position: 'relative',
                        zIndex: 100000
                    }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '16px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ef4444',
                            marginBottom: '20px'
                        }}>
                            {PlatformService.isNative() ? <Power size={24} /> : <LogOut size={24} />}
                        </div>
                        <h3 style={{ color: 'white', marginTop: 0, marginBottom: '8px', fontSize: '20px', fontWeight: 700 }}>
                            {PlatformService.isNative() ? 'Exit Zenith?' : 'Sign Out?'}
                        </h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '28px', fontSize: '15px', lineHeight: '1.6' }}>
                            {PlatformService.isNative() 
                                ? 'Are you sure you want to close the app?' 
                                : "Are you sure you want to end your session? You'll need to log back in to access your dashboard."
                            }
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setShowLogoutConfirm(false)}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border)',
                                    background: 'transparent',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '14px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {PlatformService.isNative() ? 'Cancel' : 'Stay'}
                            </button>
                            <button
                                onClick={() => {
                                    setShowLogoutConfirm(false);
                                    if (PlatformService.isNative()) {
                                        CapApp.exitApp();
                                    } else {
                                        logout();
                                    }
                                }}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: '14px',
                                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {PlatformService.isNative() ? 'Exit' : 'Sign Out'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default Sidebar;
