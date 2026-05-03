import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import * as db from '../../services/database';
import { Menu, Sun, Moon, Bell, X, Clock, CheckCircle, Award, AlertCircle, Info, ArrowRight, User, LogOut, Settings, LayoutDashboard } from 'lucide-react';
import { Button, SearchBar, Avatar } from '../common';

const Header = ({ onMenuClick, title }) => {
  const { isDark, toggleTheme } = useTheme();
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  // Fetch counts and latest notifs
  const loadNotificationData = async () => {
    if (!user) return;
    try {
      const count = await db.getUnreadNotificationCount(user.id);
      setUnreadCount(count || 0);

      // Only fetch full list if we need a preview, but to keep it simple locally
      // we can fetch the top 5 for dropdown preview
      const recent = await db.getNotifications(user.id);
      setNotifications(recent.slice(0, 5));
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const [tickerItems, setTickerItems] = useState([]);

  useEffect(() => {
    if (user && !isAdmin) {
      loadNotificationData();
      loadTickerData();
      const interval = setInterval(() => {
        loadNotificationData();
        loadTickerData();
      }, 60000);
      return () => clearInterval(interval);
    } else if (user) {
      // Just notifications for admins
      loadNotificationData();
      const interval = setInterval(loadNotificationData, 60000);
      return () => clearInterval(interval);
    }
  }, [user, isAdmin]);

  const loadTickerData = async () => {
    try {
      const [tasks, submissions] = await Promise.all([
        db.getTasks(),
        db.getSubmissionsByUser(user.id)
      ]);

      const now = new Date();

      // Filter tasks assigned to user
      const myTasks = tasks.filter(t => !t.assigned_to || t.assigned_to.length === 0 || t.assigned_to.includes(user.id));

      // Filter for actionable tasks (No submission or Rejected status)
      const actionItems = myTasks.filter(task => {
        const sub = submissions.find(s => s.task_id === task.id);
        // If no submission, it's pending.
        // If rejected, it's pending (needs fix).
        // If pending (waiting review) or approved, it is NOT pending for the student (no action needed right now).
        if (!sub) return true;
        return sub.status === 'rejected';
      });

      const pendingCount = actionItems.length;

      // Count deadlines only for these actionable items
      const upcomingDeadlines = actionItems.filter(t => {
        if (!t.deadline) return false;
        const d = new Date(t.deadline);
        const diffDays = (d - now) / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 3;
      }).length;

      const items = [];
      if (pendingCount > 0) items.push(`${pendingCount} Pending Task${pendingCount === 1 ? '' : 's'}`);
      if (upcomingDeadlines > 0) items.push(`${upcomingDeadlines} Deadline${upcomingDeadlines === 1 ? '' : 's'} Soon`);

      setTickerItems(items);
    } catch (e) {
      console.error("Ticker load error", e);
    }
  };

  const handleThemeToggle = () => {
    toggleTheme();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id) => {
    try {
      await db.markNotificationRead(id);
      // Update local state
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking read:', error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle size={16} style={{ color: 'var(--success-500)' }} />;
      case 'award': return <Award size={16} style={{ color: 'var(--primary-500)' }} />;
      case 'warning': return <AlertCircle size={16} style={{ color: 'var(--warning-500)' }} />;
      case 'error': return <AlertCircle size={16} style={{ color: 'var(--error-500)' }} />;
      default: return <Info size={16} style={{ color: 'var(--primary-500)' }} />;
    }
  };

  const formatTime = (isoString) => {
    // Simple relative time or just time string
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <header className="header">
      <div className="flex items-center gap-md">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="menu-button"
          style={{ display: 'none' }}
        >
          <Menu size={20} />
        </Button>

        <h1 style={{
          fontSize: 'var(--text-xl)',
          fontWeight: 600,
          margin: 0,
          whiteSpace: 'nowrap'
        }}>
          {title}
        </h1>

        {!isAdmin && (
          <div className="flex flex-col justify-center overflow-hidden" style={{ height: '40px', marginLeft: '1rem' }}>
            <div className="ticker-container">
              <div className="ticker-wrapper">
                {tickerItems.length > 0 ? (
                  tickerItems.map((item, i) => (
                    <span key={i} className="ticker-item text-sm text-muted font-medium flex items-center gap-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="ticker-item text-sm text-muted font-medium flex items-center gap-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    You completed everything! 🎉
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .ticker-container {
          width: 300px;
          overflow: hidden;
          position: relative;
          mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }
        .ticker-wrapper {
          display: flex;
          align-items: center;
          white-space: nowrap;
          animation: marquee 20s linear infinite;
        }
        .ticker-item {
          display: inline-flex;
          align-items: center;
          padding: 0 16px;
        }
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>

      <div className="flex items-center gap-sm">
        {/* Global Search */}
        <div className="header-search hidden md:block">
          <SearchBar
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search platform..."
            className="w-64"
          />
        </div>

        {/* Notifications */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <Button
            variant="ghost"
            size="icon"
            style={{ position: 'relative' }}
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications) loadNotificationData();
            }}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                minWidth: '16px',
                height: '16px',
                background: 'var(--error-500)',
                borderRadius: '50%',
                fontSize: '10px',
                fontWeight: 600,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px'
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 12px)',
              right: 0,
              width: '380px',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-2xl)',
              boxShadow: 'var(--shadow-xl)',
              zIndex: 1000,
              overflow: 'hidden',
              animation: 'slideInUp 0.3s var(--transition-bounce)'
            }}>
              {/* Header */}
              <div style={{
                padding: 'var(--space-md) var(--space-lg)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'color-mix(in srgb, var(--surface), transparent 50%)',
                backdropFilter: 'blur(10px)'
              }}>
                <h4 style={{ margin: 0, fontWeight: 700, color: 'var(--text)', fontSize: 'var(--text-base)' }}>Notifications</h4>
                <button
                  onClick={() => setShowNotifications(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px',
                    color: 'var(--text-muted)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Notifications List */}
              <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Bell size={48} style={{ opacity: 0.2, marginBottom: 'var(--space-md)' }} />
                    <p style={{ margin: 0, fontWeight: 500 }}>No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        if (!notif.is_read) markAsRead(notif.id);
                        if (notif.link) {
                          navigate(notif.link);
                          setShowNotifications(false);
                        }
                      }}
                      style={{
                        padding: 'var(--space-md) var(--space-lg)',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        gap: 'var(--space-md)',
                        background: notif.is_read ? 'transparent' : 'color-mix(in srgb, var(--primary-500), transparent 94%)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                        position: 'relative'
                      }}
                      className="hover:bg-primary-500/5"
                    >
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: 'var(--radius-lg)',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        {getNotificationIcon(notif.type)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          margin: 0,
                          fontWeight: 700,
                          fontSize: 'var(--text-sm)',
                          color: 'var(--text)'
                        }}>
                          {notif.title}
                        </p>
                        <p style={{
                          margin: '2px 0 0',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-muted)',
                          lineHeight: 1.4
                        }}>
                          {notif.message}
                        </p>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '6px'
                        }}>
                          <Clock size={12} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {formatTime(notif.created_at)}
                          </span>
                        </div>
                      </div>
                      {!notif.is_read && (
                        <div style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: 'var(--primary-500)',
                          flexShrink: 0,
                          marginTop: '4px',
                          boxShadow: '0 0 10px var(--primary-500)'
                        }} />
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div style={{
                padding: 'var(--space-md) var(--space-lg)',
                borderTop: '1px solid var(--border)',
                textAlign: 'center',
                background: 'color-mix(in srgb, var(--surface), transparent 80%)'
              }}>
                <button
                  onClick={() => {
                    setShowNotifications(false);
                    navigate('/notifications');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary-500)',
                    fontWeight: 700,
                    fontSize: 'var(--text-sm)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    width: '100%',
                    padding: '8px',
                    borderRadius: 'var(--radius-md)',
                    transition: 'all 0.2s'
                  }}
                  className="hover:underline"
                >
                  View All Notifications <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <Button variant="ghost" size="icon" onClick={handleThemeToggle}>
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </Button>

        {/* Profile Dropdown */}
        <div ref={profileRef} style={{ position: 'relative' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowProfileMenu(!showProfileMenu);
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              borderRadius: 'var(--radius-lg)',
              transition: 'transform var(--transition-fast)'
            }}
            className="hover:scale-105 active:scale-95"
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid var(--border)'
                }}
              />
            ) : (
              <Avatar name={user?.name} size="sm" />
            )}
          </button>

          {showProfileMenu && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 12px)',
              right: 0,
              width: '240px',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-xl)',
              zIndex: 1000,
              overflow: 'hidden',
              animation: 'slideInUp 0.2s ease-out'
            }}>
              {/* User Info Header */}
              <div style={{
                padding: 'var(--space-md)',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface)',
                backdropFilter: 'blur(10px)'
              }}>
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--text)' }}>{user?.name}</p>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{user?.email}</p>
                <div style={{
                  display: 'inline-block',
                  marginTop: '8px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: 'var(--primary-100)',
                  color: 'var(--primary-700)',
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase'
                }}>
                  {isAdmin ? 'Admin' : 'Member'}
                </div>
              </div>

              {/* Menu Items */}
              <div style={{ padding: 'var(--space-xs)', background: 'var(--card)' }}>
                {!isAdmin && (
                  <button
                    onClick={() => {
                      navigate('/profile');
                      setShowProfileMenu(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      border: 'none',
                      background: 'none',
                      color: 'var(--text)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 500,
                      textAlign: 'left'
                    }}
                    className="hover:bg-surface-hover"
                  >
                    <User size={16} /> My Profile
                  </button>
                )}
                <button
                  onClick={() => {
                    navigate(isAdmin ? '/admin' : '/dashboard');
                    setShowProfileMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    border: 'none',
                    background: 'none',
                    color: 'var(--text)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    textAlign: 'left'
                  }}
                  className="hover:bg-surface-hover"
                >
                  <LayoutDashboard size={16} /> Dashboard
                </button>
                <button
                  onClick={() => {
                    navigate('/settings');
                    setShowProfileMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    border: 'none',
                    background: 'none',
                    color: 'var(--text)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    textAlign: 'left'
                  }}
                  className="hover:bg-surface-hover"
                >
                  <Settings size={16} /> Settings
                </button>

                <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />

                <button
                  onClick={() => {
                    logout();
                    setShowProfileMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    border: 'none',
                    background: 'none',
                    color: 'var(--error-500)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    textAlign: 'left'
                  }}
                  className="hover:bg-error-500/10"
                >
                  <LogOut size={16} /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .menu-button {
            display: flex !important;
          }
        }
        @media (min-width: 768px) {
          .header-search {
            display: block !important;
          }
        }
      `}</style>
    </header>
  );
};

export default Header;
