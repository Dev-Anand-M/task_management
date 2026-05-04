import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
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
    X
} from 'lucide-react';
import Avatar from '../common/Avatar';

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
        { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
        { to: '/settings', icon: Settings, label: 'Settings' }
    ];

    const memberLinks = [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', exact: true },
        { to: '/tasks', icon: ListTodo, label: 'Tasks' },
        { to: '/quizzes', icon: HelpCircle, label: 'Quizzes' },
        { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
        { to: '/profile', icon: User, label: 'Profile' },
        { to: '/settings', icon: Settings, label: 'Settings' }
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

            <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
                {/* Logo */}
                <div style={{
                    padding: 'var(--space-lg)',
                    borderBottom: '1px solid rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-sm)'
                }}>
                    <div className="flex items-center gap-sm">
                        <div style={{
                            width: '32px',
                            height: '32px',
                            background: 'rgba(255,255,255,0.2)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Zap size={18} color="white" />
                        </div>
                        <div>
                            <h2 style={{
                                fontSize: 'var(--text-base)',
                                fontWeight: 700,
                                margin: 0,
                                color: 'white',
                                letterSpacing: '-0.02em'
                            }}>
                                Zenith
                            </h2>
                            <span style={{
                                fontSize: '10px',
                                color: 'rgba(255,255,255,0.75)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                {isAdmin ? 'Admin' : 'Member'}
                            </span>
                        </div>
                    </div>

                    <button 
                        className="mobile-close-btn"
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            color: 'white',
                            padding: '8px',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            display: 'none' // Hidden by default (CSS handles mobile)
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav style={{ flex: 1, padding: 'var(--space-sm)', overflowY: 'auto' }}>
                    {isAdmin && (
                        <div style={{ position: 'relative', margin: '0 var(--space-sm) var(--space-md)' }}>
                            <div
                                onClick={() => setShowClassroomMenu(!showClassroomMenu)}
                                style={{
                                    padding: 'var(--space-sm)',
                                    background: 'rgba(255,255,255,0.1)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    cursor: 'pointer',
                                    transition: 'background var(--transition-fast)'
                                }}
                                className="classroom-selector"
                            >
                                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.05em', marginBottom: '4px' }}>
                                    Current Classroom
                                </div>
                                <div className="flex items-center justify-between text-white font-medium text-sm">
                                    <div className="flex items-center gap-xs truncate">
                                        <School size={14} className="text-yellow-400" />
                                        {user?.classroom_id ? classrooms.find(c => c.id === user.classroom_id)?.name : 'All Classrooms'}
                                    </div>
                                    <ChevronRight size={14} style={{ transform: showClassroomMenu ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                                </div>
                            </div>

                            {showClassroomMenu && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    marginTop: '4px',
                                    background: '#292524',
                                    border: '1px solid rgba(255,255,255,0.1)',
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
                                            color: !user?.classroom_id ? '#fef3c7' : 'rgba(255,255,255,0.8)',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid rgba(255,255,255,0.1)'
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
                                                color: user?.classroom_id === c.id ? '#fef3c7' : 'rgba(255,255,255,0.8)',
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
                        color: 'rgba(255,255,255,0.6)',
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
                                    onClick={onClose}
                                    style={({ isActive }) => ({
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-sm)',
                                        padding: '0.625rem var(--space-md)',
                                        borderRadius: 'var(--radius-md)',
                                        color: isActive ? '#fef3c7' : 'rgba(255,255,255,0.8)',
                                        background: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                                        textDecoration: 'none',
                                        fontSize: 'var(--text-sm)',
                                        fontWeight: isActive ? 600 : 500,
                                        transition: 'all var(--transition-fast)',
                                        borderLeft: isActive ? '2px solid #fef3c7' : '2px solid transparent',
                                        marginLeft: '0'
                                    })}
                                >
                                    <link.icon size={18} />
                                    <span style={{ flex: 1 }}>{link.label}</span>
                                </NavLink>
                            </li>
                        ))}
                    </ul>

                    {/* AI Tools Section */}
                    <div
                        onClick={() => setShowAiTools(!showAiTools)}
                        style={{
                            fontSize: '10px',
                            color: 'rgba(255,255,255,0.6)',
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
                            background: 'rgba(167, 139, 250, 0.05)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid rgba(167, 139, 250, 0.1)'
                        }}>
                            {aiLinks.map(link => (
                                <li key={link.to}>
                                    <NavLink
                                        to={link.to}
                                        onClick={onClose}
                                        style={({ isActive }) => ({
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-sm)',
                                            padding: '0.75rem var(--space-md)',
                                            borderRadius: 'var(--radius-md)',
                                            color: isActive ? 'white' : 'rgba(255,255,255,0.7)',
                                            background: isActive ? 'linear-gradient(135deg, #a78bfa, #8b5cf6)' : 'transparent',
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
                    )}
                </nav>

                {/* User Profile Section */}
                <div style={{
                    padding: 'var(--space-md)',
                    borderTop: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(0,0,0,0.15)'
                }}>
                    <div className="flex items-center gap-sm">
                        <Avatar name={user?.name} size="sm" />
                        <Link 
                            to="/profile" 
                            onClick={onClose}
                            style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}
                        >
                            <p style={{
                                fontWeight: 600,
                                fontSize: 'var(--text-sm)',
                                color: 'white',
                                margin: 0,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}>
                                {user?.name}
                            </p>
                            <p style={{
                                fontSize: '10px',
                                color: 'rgba(255,255,255,0.75)',
                                margin: 0,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}>
                                {user?.email}
                            </p>
                        </Link>
                        <button
                            onClick={() => setShowLogoutConfirm(true)}
                            style={{
                                background: 'rgba(255,255,255,0.15)',
                                border: '1px solid rgba(255,255,255,0.25)',
                                color: 'white',
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
            {showLogoutConfirm && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 300,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div className="animate-slide-up" style={{
                        background: '#1c1917',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '16px',
                        padding: '24px',
                        width: '90%',
                        maxWidth: '320px',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                    }}>
                        <h3 style={{ color: 'white', marginTop: 0, marginBottom: '8px', fontSize: '18px', fontWeight: 600 }}>Sign Out?</h3>
                        <p style={{ color: '#a8a29e', marginBottom: '24px', fontSize: '14px', lineHeight: '1.5' }}>
                            Are you sure you want to sign out of your account?
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setShowLogoutConfirm(false)}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(255,255,255,0.05)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    fontSize: '14px',
                                    transition: 'background 0.2s'
                                }}
                                onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                                onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowLogoutConfirm(false);
                                    logout();
                                }}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: 'linear-gradient(to right, #ea580c, #d97706)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '14px',
                                    boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)',
                                    transition: 'transform 0.2s, box-shadow 0.2s'
                                }}
                                onMouseOver={(e) => {
                                    e.target.style.transform = 'translateY(-1px)';
                                    e.target.style.boxShadow = '0 6px 16px rgba(234, 88, 12, 0.4)';
                                }}
                                onMouseOut={(e) => {
                                    e.target.style.transform = 'none';
                                    e.target.style.boxShadow = '0 4px 12px rgba(234, 88, 12, 0.3)';
                                }}
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Sidebar;
