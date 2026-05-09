import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import * as db from '../../services/database';
import { Menu, Bell, Search, User, LogOut, Settings, Clock, Check, ChevronRight, LayoutDashboard, Database, HelpCircle, ArrowRight, ArrowLeft, Sun, Moon, CheckCircle, Award, AlertCircle, Info, X, RefreshCw } from 'lucide-react';
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

      const recent = await db.getNotifications(user.id);
      setNotifications(recent.slice(0, 5));
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const [tickerItems, setTickerItems] = useState([]);

  useEffect(() => {
    if (user) {
      loadNotificationData();
      if (!isAdmin) loadTickerData();
      
      const channel = supabase
          .channel(`header-updates-${user.id}`)
          .on('postgres_changes', { 
              event: '*', 
              schema: 'public', 
              table: 'notifications', 
              filter: `user_id=eq.${user.id}` 
          }, () => {
              console.log('Realtime: Notification update detected');
              loadNotificationData();
          })
          .subscribe();

      return () => {
          supabase.removeChannel(channel);
      };
    }
  }, [user, isAdmin]);

  const loadTickerData = async () => {
    try {
      const [tasks, submissions, quizzes, attempts] = await Promise.all([
        db.getTasks(),
        db.getSubmissionsByUser(user.id),
        db.getQuizzes(),
        db.getQuizAttemptsByUser(user.id)
      ]);

      const now = new Date();
      const myTasks = tasks.filter(t => !t.assigned_to || t.assigned_to.length === 0 || t.assigned_to.includes(user.id));
      const actionItems = myTasks.filter(task => {
        const sub = submissions.find(s => s.task_id === task.id);
        if (!sub) return true;
        return sub.status === 'rejected';
      });

      const pendingTasksCount = actionItems.length;
      const pendingQuizzesCount = quizzes.filter(q => !attempts.some(a => a.quiz_id === q.id)).length;
      const upcomingDeadlines = actionItems.filter(t => {
        if (!t.deadline) return false;
        const d = new Date(t.deadline);
        const diffDays = (d - now) / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 3;
      }).length;

      const items = [];
      if (pendingTasksCount > 0) items.push(`${pendingTasksCount} Pending Task${pendingTasksCount === 1 ? '' : 's'}`);
      if (pendingQuizzesCount > 0) items.push(`${pendingQuizzesCount} Pending Quiz${pendingQuizzesCount === 1 ? '' : 'zes'}`);
      if (upcomingDeadlines > 0) items.push(`${upcomingDeadlines} Deadline${upcomingDeadlines === 1 ? '' : 's'} Soon`);

      setTickerItems(items);
    } catch (e) {
      console.error("Ticker load error", e);
    }
  };

  const handleThemeToggle = () => {
    toggleTheme();
  };

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
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <header style={{ 
      height: '72px', 
      minHeight: '72px', 
      background: 'var(--card)', 
      borderBottom: '1px solid var(--border)',
      padding: '0 var(--space-lg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      flexShrink: 0
    }}>
      <div className="flex items-center gap-md" style={{ flex: 1, minWidth: 0 }}>
        {/* Mobile Menu Button */}
        <button
          onClick={(e) => {
            if (onMenuClick) onMenuClick(e);
          }}
          style={{
            background: 'none',
            border: 'none',
            padding: '8px',
            cursor: 'pointer',
            color: 'var(--text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-md)',
            transition: 'background 0.2s'
          }}
          className="hover:bg-surface active:scale-95 visible-mobile hidden-desktop"
          aria-label="Toggle Sidebar Mobile"
        >
          <Menu size={24} />
        </button>

        {/* Desktop Menu Button */}
        <button
          onClick={onMenuClick}
          className="hidden-mobile visible-desktop p-2 rounded-xl text-muted hover:text-text hover:bg-surface transition-all"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          aria-label="Toggle Sidebar Desktop"
        >
          <Menu size={24} />
        </button>



        <div className="flex items-center gap-sm">
          <h1 style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 600,
            margin: 0,
            whiteSpace: 'nowrap'
          }}>
            {title}
          </h1>

          {!isAdmin && (
            <div className="header-ticker hidden-mobile visible-desktop" style={{ height: '40px', marginLeft: '1rem' }}>
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
        <div className="header-search hidden-mobile visible-desktop">
          <SearchBar
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search platform..."
            className="w-64"
            isAdmin={isAdmin}
          />
        </div>
        <div ref={notifRef} style={{ position: 'relative', zIndex: 10000 }}>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={(e) => {
              e.stopPropagation();
              setShowNotifications(!showNotifications);
              if (!showNotifications) loadNotificationData();
            }}
            style={{ 
              position: 'relative',
              width: '44px',
              height: '44px',
              padding: '10px'
            }}
          >
            <Bell size={28} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                minWidth: '18px',
                height: '18px',
                background: 'var(--error-500)',
                borderRadius: '50%',
                fontSize: '11px',
                fontWeight: 600,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                zIndex: 1
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
          
          {showNotifications && (
            <div 
              className="mobile-backdrop"
              onClick={() => setShowNotifications(false)}
            />
          )}

          {showNotifications && (
            <div 
              className="header-dropdown notification-dropdown animate-scale-in"
              style={{ zIndex: 10001 }}
            >
              <div className="mobile-handle md:hidden" />
              <div style={{
                padding: 'var(--space-md) var(--space-lg)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'color-mix(in srgb, var(--surface), transparent 50%)',
                backdropFilter: 'blur(10px)',
                flexShrink: 0
              }}>
                <h4 style={{ margin: 0, fontWeight: 700, color: 'var(--text)', fontSize: 'var(--text-base)' }}>Notifications</h4>
                <button
                  onClick={() => setShowNotifications(false)}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    padding: '8px',
                    color: 'var(--text)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px'
                  }}
                  className="hover:scale-105 active:scale-95"
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ 
                flex: 1,
                overflowY: 'auto',
                minHeight: '100px',
                paddingBottom: 'var(--space-xl)'
              }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Bell size={48} style={{ opacity: 0.2, marginBottom: 'var(--space-md)' }} />
                    <p style={{ margin: 0, fontWeight: 500 }}>No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!notif.is_read) markAsRead(notif.id);
                        if (notif.link) {
                          if (notif.link.includes('/dashboard')) {
                            window.location.href = notif.link;
                          } else {
                            navigate(notif.link);
                          }
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
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text)' }}>{notif.title}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.4 }}>{notif.message}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                          <Clock size={12} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>{formatTime(notif.created_at)}</span>
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

              <div style={{
                padding: 'var(--space-md) var(--space-lg)',
                borderTop: '1px solid var(--border)',
                textAlign: 'center',
                background: 'var(--surface)',
                marginTop: 'auto',
                flexShrink: 0
              }}>
                <button
                  onClick={() => {
                    setShowNotifications(false);
                    navigate('/notifications', { replace: true });
                  }}
                  style={{
                    background: 'var(--primary-500)',
                    border: 'none',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: 'var(--text-sm)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    transition: 'all 0.2s',
                    boxShadow: 'var(--shadow-md)'
                  }}
                  className="hover:scale-[1.02] active:scale-[0.98]"
                >
                  View All Notifications <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>


        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleThemeToggle}
          style={{ width: '44px', height: '44px', padding: '10px' }}
        >
          {isDark ? <Sun size={28} /> : <Moon size={28} />}
        </Button>

        <div ref={profileRef} style={{ position: 'relative', zIndex: 10000 }}>
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
            <Avatar name={user?.name} image={user?.avatar_url} size="md" />
          </button>
          
          {showProfileMenu && (
            <div 
              className="mobile-backdrop"
              onClick={() => setShowProfileMenu(false)}
            />
          )}

          {showProfileMenu && (
            <div 
              className="header-dropdown profile-dropdown animate-scale-in"
              style={{ zIndex: 10001 }}
            >
              <div className="mobile-handle md:hidden" />
              <div style={{
                padding: 'var(--space-lg) var(--space-md)',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                position: 'relative',
                flexShrink: 0
              }}>
                <button
                  onClick={() => setShowProfileMenu(false)}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    padding: '8px',
                    color: 'var(--text)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px'
                  }}
                  className="hover:scale-105"
                >
                  <X size={20} />
                </button>

                <Avatar name={user?.name} image={user?.avatar_url} size="lg" style={{ marginBottom: 'var(--space-sm)' }} />
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--text)', fontSize: 'var(--text-lg)' }}>{user?.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{user?.email}</p>
                <div style={{
                  display: 'inline-block',
                  marginTop: '12px',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  background: 'var(--primary-500)',
                  color: 'white',
                  fontSize: '10px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  {isAdmin ? '🛡️ Administrator' : '🎓 Member'}
                </div>
              </div>

              <div style={{ padding: 'var(--space-sm)', background: 'var(--card)', flex: 1, overflowY: 'auto' }}>
                <button
                  onClick={() => {
                    navigate('/profile', { replace: true });
                    setShowProfileMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    border: 'none',
                    background: 'none',
                    color: 'var(--text)',
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    textAlign: 'left'
                  }}
                  className="hover:bg-surface"
                >
                  <User size={18} /> My Profile
                </button>
                <button
                  onClick={() => {
                    navigate(isAdmin ? '/admin' : '/dashboard', { replace: true });
                    setShowProfileMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    border: 'none',
                    background: 'none',
                    color: 'var(--text)',
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    textAlign: 'left'
                  }}
                  className="hover:bg-surface"
                >
                  <LayoutDashboard size={18} /> Dashboard
                </button>
                <button
                  onClick={() => {
                    navigate('/settings', { replace: true });
                    setShowProfileMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    border: 'none',
                    background: 'none',
                    color: 'var(--text)',
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    textAlign: 'left'
                  }}
                  className="hover:bg-surface"
                >
                  <Settings size={18} /> Settings
                </button>

                <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />

                <button
                  onClick={() => {
                    logout();
                    setShowProfileMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    border: 'none',
                    background: 'none',
                    color: 'var(--error-500)',
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    textAlign: 'left'
                  }}
                  className="hover:bg-error-50/10"
                >
                  <LogOut size={18} /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
