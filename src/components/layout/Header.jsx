import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import * as db from '../../services/database';
import { Capacitor } from '@capacitor/core';
import { Menu, Bell, Search, User, LogOut, Settings, Clock, Check, ChevronRight, LayoutDashboard, Database, HelpCircle, ArrowRight, ArrowLeft, Sun, Moon, CheckCircle, Award, AlertCircle, Info, X, RefreshCw, Zap, Sparkles } from 'lucide-react';
import { Button, SearchBar, Avatar } from '../common';

const Header = ({ onMenuClick, title }) => {
  const { isDark, toggleTheme } = useTheme();
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifTab, setNotifTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const loadTickerData = async () => {
    try {
      const classroomId = user?.classroom_id;
      const [tasks, submissions, quizzes, attempts, sprintRes] = await Promise.all([
        db.getTasks().catch(() => []),
        user?.id ? db.getSubmissionsByUser(user.id).catch(() => []) : Promise.resolve([]),
        db.getQuizzes().catch(() => []),
        user?.id ? db.getQuizAttemptsByUser(user.id).catch(() => []) : Promise.resolve([]),
        classroomId 
          ? supabase.from('sprint_templates').select('*').eq('classroom_id', classroomId).order('week_number', { ascending: true })
          : supabase.from('sprint_templates').select('*').order('week_number', { ascending: true })
      ]);

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const items = [];

      // 1. Include Active & Upcoming Sprint Weeks in Marquee
      const sprintWeeks = sprintRes?.data || [];
      sprintWeeks.forEach(w => {
        const startStr = w.start_date ? w.start_date.split('T')[0] : null;
        const endStr = w.end_date ? w.end_date.split('T')[0] : null;
        const title = w.title || `Week ${w.week_number}`;

        if (startStr && endStr && todayStr >= startStr && todayStr <= endStr) {
          items.push(`⚡ Week ${w.week_number}: ${title} is Active!`);
        } else if (startStr && todayStr < startStr) {
          const startDt = new Date(startStr);
          const diffDays = Math.ceil((startDt - now) / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays <= 7) {
            items.push(`🚀 Week ${w.week_number}: ${title} starts in ${diffDays} day${diffDays === 1 ? '' : 's'}!`);
          }
        }
      });

      // 2. Include Pending Tasks and Quizzes for member
      if (user?.id) {
        const myTasks = tasks.filter(t => !t.assigned_to || t.assigned_to.length === 0 || t.assigned_to.includes(user.id));
        const actionItems = myTasks.filter(task => {
          const sub = submissions.find(s => s.task_id === task.id);
          if (sub && (sub.status === 'approved' || sub.status === 'submitted' || sub.status === 'pending')) return false;
          if (task.deadline && new Date(task.deadline) < now) return false;
          if (!sub) return true;
          return sub.status === 'rejected';
        });

        const pendingTasksCount = actionItems.length;
        const pendingQuizzesCount = quizzes.filter(q => !attempts.some(a => a.quiz_id === q.id)).length;

        if (pendingTasksCount > 0) items.push(`📋 ${pendingTasksCount} Pending Task${pendingTasksCount === 1 ? '' : 's'}`);
        if (pendingQuizzesCount > 0) items.push(`📝 ${pendingQuizzesCount} Pending Quiz${pendingQuizzesCount === 1 ? '' : 'zes'}`);
      }

      setTickerItems(items);
    } catch (e) {
      console.error("Ticker load error", e);
    }
  };

  useEffect(() => {
    if (user) {
      loadNotificationData();
      loadTickerData();
      
      const channel = supabase
          .channel(`header-updates-${user.id}`)
          .on('postgres_changes', { 
              event: '*', 
              schema: 'public', 
              table: 'notifications', 
              filter: `user_id=eq.${user.id}` 
          }, () => {
              loadNotificationData();
          })
          .subscribe();

      return () => {
          supabase.removeChannel(channel);
      };
    }
  }, [user, isAdmin]);

  const handleThemeToggle = () => {
    toggleTheme();
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      // Don't close if clicking inside the dropdown (especially important for portaled mobile dropdowns)
      if (event.target.closest('.header-dropdown')) {
        return;
      }
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

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      await db.markAllNotificationsRead(user.id);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all read:', error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'eval':
      case 'award':
        return <Trophy size={16} style={{ color: '#f59e0b' }} />;
      case 'vault':
      case 'code':
        return <Code size={16} style={{ color: '#3b82f6' }} />;
      case 'sprint':
        return <Zap size={16} style={{ color: '#ec4899' }} />;
      case 'success':
        return <CheckCircle size={16} style={{ color: 'var(--success-500)' }} />;
      case 'warning':
      case 'error':
        return <AlertCircle size={16} style={{ color: 'var(--error-500)' }} />;
      default:
        return <Info size={16} style={{ color: 'var(--primary-500)' }} />;
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <header className="header" style={{ 
      height: 'calc(72px + var(--safe-area-top))', 
      minHeight: 'calc(72px + var(--safe-area-top))', 
      background: 'var(--card)', 
      borderBottom: '1px solid var(--border)',
      padding: 'var(--safe-area-top) var(--space-lg) 0',
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
          className="sandwich-menu-btn visible-mobile hidden-desktop"
          aria-label="Toggle Sidebar Mobile"
        >
          <Menu size={22} />
        </button>

        {/* Desktop Menu Button */}
        <button
          onClick={onMenuClick}
          className="sandwich-menu-btn hidden-mobile visible-desktop"
          aria-label="Toggle Sidebar Desktop"
        >
          <Menu size={22} />
        </button>



        <div className="flex items-center gap-sm" style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <h1 style={{
            fontSize: isMobile ? 'var(--text-lg)' : 'var(--text-xl)',
            fontWeight: 600,
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {title}
          </h1>

          <div className="header-ticker hidden-mobile visible-desktop" style={{ height: '36px', marginLeft: '1.25rem', overflow: 'hidden', flexShrink: 1 }}>
            <div className="ticker-container" style={{ width: 'min(480px, 35vw)', overflow: 'hidden' }}>
              <div className="ticker-wrapper">
                {tickerItems.length > 0 ? (
                  // Repeat items 4x to guarantee a long seamless scrolling track with zero blank gaps
                  [...tickerItems, ...tickerItems, ...tickerItems, ...tickerItems].map((item, i) => (
                    <span 
                      key={i} 
                      onClick={() => {
                        if (item.includes('Sprint') || item.includes('Week')) navigate('/sprint-tracker');
                        else if (item.includes('Task')) navigate('/tasks');
                        else if (item.includes('Quiz')) navigate('/quizzes');
                      }}
                      className="ticker-item text-xs font-medium flex items-center gap-xs cursor-pointer hover:text-primary-400"
                      style={{ whiteSpace: 'nowrap', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="ticker-item text-xs text-muted font-medium flex items-center gap-xs" style={{ whiteSpace: 'nowrap' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    All clear for now ✨
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .ticker-container {
          width: min(480px, 35vw);
          overflow: hidden;
          position: relative;
          mask-image: linear-gradient(to right, transparent, black 8px, black calc(100% - 8px), transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 8px, black calc(100% - 8px), transparent);
        }
        .ticker-wrapper {
          display: flex;
          align-items: center;
          white-space: nowrap;
          animation: marquee 12s linear infinite;
        }
        .ticker-wrapper:hover {
          animation-play-state: paused;
        }
        .ticker-item {
          display: inline-flex;
          align-items: center;
          padding: 0 20px;
          transition: color 0.2s ease;
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      <div className="flex items-center gap-sm">
        <div className="header-search hidden-mobile visible-desktop">
          <SearchBar
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search platform..."
            className="w-72 lg:w-[380px]"
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
            (() => {
              const dropdown = (
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h4 style={{ margin: 0, fontWeight: 700, color: 'var(--text)', fontSize: 'var(--text-base)' }}>Notifications</h4>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--primary-400)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}
                          className="hover:underline"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
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

                  {/* Category Filter Tabs */}
                  <div style={{
                    display: 'flex',
                    gap: '4px',
                    padding: '8px 16px',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--surface-hover)'
                  }}>
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'sprint', label: '🏆 Sprints & Vault' },
                      { id: 'system', label: '🔔 System' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setNotifTab(tab.id)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer',
                          background: notifTab === tab.id ? 'var(--primary-500)' : 'transparent',
                          color: notifTab === tab.id ? '#ffffff' : 'var(--text-muted)'
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ 
                    flex: 1,
                    overflowY: 'auto',
                    minHeight: '100px',
                    paddingBottom: 'var(--space-xl)'
                  }}>
                    {(() => {
                      const filteredNotifs = notifications.filter(n => {
                        const isSprintRelated = ['sprint', 'eval', 'vault'].includes(n.type) || (n.title && n.title.toLowerCase().includes('sprint'));
                        if (notifTab === 'sprint') return isSprintRelated;
                        if (notifTab === 'system') return !isSprintRelated;
                        return true;
                      });

                      if (filteredNotifs.length === 0) {
                        return (
                          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Bell size={48} style={{ opacity: 0.2, marginBottom: 'var(--space-md)' }} />
                            <p style={{ margin: 0, fontWeight: 500 }}>No {notifTab === 'all' ? '' : notifTab} notifications</p>
                          </div>
                        );
                      }

                      return filteredNotifs.map((notif) => (
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
                          className="dropdown-hover-item"
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
                      ));
                    })()}
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
                        navigate('/notifications');
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
              );

              if (isMobile) {
                return createPortal(
                  <>
                    <div 
                      className="mobile-backdrop"
                      onClick={() => setShowNotifications(false)}
                    />
                    {dropdown}
                  </>,
                  document.body
                );
              }

              return dropdown;
            })()
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
              borderRadius: '50%',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform var(--transition-fast)'
            }}
            className="hover:scale-105 active:scale-95"
          >
            <Avatar name={user?.name} image={user?.avatar_url} size="md" />
          </button>
          
          {showProfileMenu && (
            (() => {
              const dropdown = (
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
                        navigate('/profile');
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
                      className="dropdown-hover-item"
                    >
                      <User size={18} /> My Profile
                    </button>
                    <button
                      onClick={() => {
                        navigate(isAdmin ? '/admin' : '/dashboard');
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
                      className="dropdown-hover-item"
                    >
                      <LayoutDashboard size={18} /> Dashboard
                    </button>
                    <button
                      onClick={() => {
                        navigate('/settings');
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
                      className="dropdown-hover-item"
                    >
                      <Settings size={18} /> Settings
                    </button>
                    {Capacitor.isNativePlatform() && (
                      <button
                        onClick={() => {
                          window.location.reload();
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
                        className="dropdown-hover-item"
                      >
                        <RefreshCw size={18} /> Reload App
                      </button>
                    )}

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
                      className="dropdown-hover-item hover:bg-error-50/10"
                    >
                      <LogOut size={18} /> Sign Out
                    </button>
                  </div>
                </div>
              );

              if (isMobile) {
                return createPortal(
                  <>
                    <div 
                      className="mobile-backdrop"
                      onClick={() => setShowProfileMenu(false)}
                    />
                    {dropdown}
                  </>,
                  document.body
                );
              }

              return dropdown;
            })()
          )}
        </div>
      </div>

      <style>{`
        .sandwich-menu-btn {
          background: transparent;
          border: none;
          padding: 8px;
          cursor: pointer;
          color: var(--text);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-md, 10px);
          transition: background 0.2s ease, color 0.2s ease;
        }

        .sandwich-menu-btn:hover {
          background: var(--surface-hover, rgba(255, 255, 255, 0.1)) !important;
          color: var(--primary-500, #6366f1) !important;
        }

        .sandwich-menu-btn:active {
          opacity: 0.8;
        }

        html[data-theme="light"] .sandwich-menu-btn:hover {
          background: rgba(15, 23, 42, 0.06) !important;
          color: var(--primary-600, #4f46e5) !important;
        }

        /* Dropdown Hover Effects (Quick Access, Notifications, Profile) */
        .dropdown-hover-item {
          transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }

        .dropdown-hover-item:hover {
          transform: translateX(4px) !important;
          background: color-mix(in srgb, var(--primary-500, #f59e0b) 14%, transparent) !important;
        }

        .dropdown-hover-item:hover svg {
          transform: scale(1.12) rotate(3deg) !important;
          color: var(--primary-500, #f59e0b) !important;
          transition: transform 0.2s ease, color 0.2s ease !important;
        }

        html[data-theme="light"] .dropdown-hover-item:hover {
          background: color-mix(in srgb, var(--primary-500, #f59e0b) 10%, transparent) !important;
        }

        html[data-theme="light"] .dropdown-hover-item:hover svg {
          color: var(--primary-600, #d97706) !important;
        }
      `}</style>
    </header>
  );
};

export default Header;
