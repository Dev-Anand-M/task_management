import { useState, useEffect } from 'react';
import { Card, Button, Badge, Modal } from '../components/common';
import { useAuth } from '../context/AuthContext';
import * as db from '../services/database';
import { supabase } from '../lib/supabase';
import {
    Bell,
    CheckCircle,
    Award,
    AlertCircle,
    Info,
    Check,
    Trash2,
    Calendar,
    ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Notifications = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            loadNotifications(true);

            // Subscribe to realtime notification updates
            const channel = supabase
                .channel(`notifications-page-${user.id}`)
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'notifications', 
                    filter: `user_id=eq.${user.id}` 
                }, () => {
                    loadNotifications(false);
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [user]);

    const loadNotifications = async (showSpinner = true) => {
        if (showSpinner) setLoading(true);

        const safetyTimeout = setTimeout(() => {
            setLoading(false);
        }, 8000);

        try {
            const data = await db.getNotifications(user.id);
            setNotifications(data || []);
        } catch (error) {
            console.error('Error loading notifications:', error);
        } finally {
            clearTimeout(safetyTimeout);
            if (showSpinner) setLoading(false);
        }
    };

    const handleMarkAsRead = async (id) => {
        try {
            await db.markNotificationRead(id);
            // Update local state locally to reflect optimization
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, is_read: true } : n)
            );
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await db.markAllNotificationsRead(user.id);
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'success': return <CheckCircle size={24} style={{ color: 'var(--success-500)' }} />;
            case 'award': return <Award size={24} style={{ color: 'var(--primary-500)' }} />;
            case 'warning': return <AlertCircle size={24} style={{ color: 'var(--warning-500)' }} />;
            case 'error': return <AlertCircle size={24} style={{ color: 'var(--error-500)' }} />;
            default: return <Info size={24} style={{ color: 'var(--primary-500)' }} />;
        }
    };

    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (loading) {
        return (
            <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-lg">
                    <h2>Notifications</h2>
                </div>
                <div className="flex justify-center p-xl">
                    <div className="loading-spinner" />
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <div className="flex flex-mobile-col justify-between items-center mb-lg">
                <div>
                    <h2>Notifications</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Stay updated with your latest activities</p>
                </div>
                {notifications.some(n => !n.is_read) && (
                    <Button
                        variant="secondary"
                        icon={Check}
                        onClick={handleMarkAllRead}
                    >
                        Mark all as read
                    </Button>
                )}
            </div>

            {notifications.length === 0 ? (
                <Card className="text-center p-2xl">
                    <div style={{
                        width: '64px',
                        height: '64px',
                        background: 'var(--surface)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto var(--space-md)',
                        color: 'var(--text-muted)'
                    }}>
                        <Bell size={32} />
                    </div>
                    <h3>No notifications yet</h3>
                    <p>When you get tasks or earn badges, they'll show up here.</p>
                </Card>
            ) : (
                <div className="flex flex-col gap-md">
                    {notifications.map((notif) => (
                        <Card
                            key={notif.id}
                            style={{
                                display: 'flex',
                                gap: 'var(--space-md)',
                                opacity: notif.is_read ? 0.7 : 1,
                                borderLeft: !notif.is_read ? '4px solid var(--primary-500)' : undefined,
                                transition: 'all var(--transition-base)'
                            }}
                            className={notif.is_read ? '' : 'glow-accent'}
                        >
                            <div style={{ flexShrink: 0, marginTop: '4px' }}>
                                {getIcon(notif.type)}
                            </div>

                            <div style={{ flex: 1 }}>
                                <div className="flex justify-between items-start">
                                    <h4 style={{ margin: '0 0 4px 0' }}>{notif.title}</h4>
                                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                        {formatTime(notif.created_at)}
                                    </span>
                                </div>
                                <p style={{ margin: '0 0 var(--space-sm) 0' }}>{notif.message}</p>

                                {notif.link && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={ArrowRight}
                                        onClick={() => navigate(notif.link)}
                                        style={{ paddingLeft: 0, color: 'var(--primary-500)' }}
                                    >
                                        View Details
                                    </Button>
                                )}
                            </div>

                            {!notif.is_read && (
                                <div style={{ alignSelf: 'center' }}>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleMarkAsRead(notif.id)}
                                        title="Mark as read"
                                    >
                                        <Check size={18} />
                                    </Button>
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Notifications;
