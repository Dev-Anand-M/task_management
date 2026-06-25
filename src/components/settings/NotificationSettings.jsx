import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button } from '../common';
import { supabase } from '../../lib/supabase';
import { Bell, Volume2, Plus } from 'lucide-react';

const NotificationSettings = () => {
    const { user, forceRefresh } = useAuth();
    const [notifications, setNotifications] = useState({
        push: false,
        routineAlarms: localStorage.getItem('alarms_enabled') === 'true',
        taskReminders: true,
        quizResults: true
    });
    const [saving, setSaving] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(false);

    // Check if user reached here via active push subscriptions to initialize toggle state
    useEffect(() => {
        const checkPushSubscription = async () => {
            if (user?.id) {
                try {
                    const { count, error } = await supabase
                        .from('push_subscriptions')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', user.id)
                        .eq('is_active', true)
                        .eq('notifications_enabled', true);
                    
                    if (!error && count !== null) {
                        setNotifications(prev => ({
                            ...prev,
                            push: user.preferences?.notifications?.push !== undefined 
                                ? user.preferences.notifications.push 
                                : count > 0
                        }));
                    }
                } catch (e) {
                    // Ignore errors silently in production
                }
            }
        };
        checkPushSubscription();
    }, [user?.id]);

    // Initial load from profile
    useEffect(() => {
        if (user) {
            setNotifications(prev => {
                const dbNotifications = user.preferences?.notifications || {};
                return {
                    ...prev,
                    ...dbNotifications,
                    push: dbNotifications.push !== undefined ? dbNotifications.push : prev.push
                };
            });
        }
    }, [user?.id]); // Only run when user ID changes

    // PWA Setup
    useEffect(() => {
        setIsInstalled(window.matchMedia('(display-mode: standalone)').matches);
        
        const handleBeforeInstall = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        
        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    }, []);

    const syncNotificationsToDb = async (newNotifications) => {
        if (!user) return;
        setSaving(true);
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('preferences')
                .eq('id', user.id)
                .single();

            const currentPrefs = profile?.preferences || {};
            const newPrefs = {
                ...currentPrefs,
                notifications: newNotifications
            };

            await supabase
                .from('profiles')
                .update({ preferences: newPrefs })
                .eq('id', user.id);

        } catch (err) {
            console.error('Failed to sync notification settings:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleNotificationChange = (key, value) => {
        const newNotifications = { ...notifications, [key]: value };
        setNotifications(newNotifications);
        syncNotificationsToDb(newNotifications);
        
        if (key === 'routineAlarms') {
            localStorage.setItem('alarms_enabled', value);
            window.dispatchEvent(new CustomEvent('toggle-alarms', { detail: value }));
        }
    };

    return (
        <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    background: 'var(--gradient-accent)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white'
                }}>
                    <Bell size={20} />
                </div>
                <div>
                    <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>Notifications</h3>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                        Manage your notification preferences
                    </p>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                {typeof Notification !== 'undefined' && Notification.permission === 'denied' && (
                    <div style={{ 
                        padding: 'var(--space-sm) var(--space-md)', 
                        background: 'rgba(239, 68, 68, 0.1)', 
                        border: '1px solid var(--error)', 
                        borderRadius: 'var(--radius-md)',
                        marginBottom: 'var(--space-md)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-sm)',
                        color: 'var(--error)'
                    }}>
                        <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                        <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
                            <strong>Permissions Blocked:</strong> Your browser has blocked notifications for this site. 
                            Click the <strong>tune/lock icon</strong> next to the URL to "Allow" them.
                        </p>
                    </div>
                )}
                {[
                    { key: 'push', label: 'Push Notifications', desc: 'Native device/browser notifications' },
                    { key: 'routineAlarms', label: 'Routine Alarms (Audio)', desc: 'Full screen audio alarms for your routines' },
                    { key: 'taskReminders', label: 'Task Reminders', desc: 'Get reminded about pending tasks' },
                    { key: 'quizResults', label: 'Quiz Results', desc: 'Notify when quiz is evaluated' }
                ].map((item) => (
                    <div
                        key={item.key}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 'var(--space-md)',
                            background: 'var(--surface)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border)'
                        }}
                    >
                        <div>
                            <p style={{ margin: 0, fontWeight: 500 }}>{item.label}</p>
                            <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                {item.desc}
                            </p>
                        </div>
                        <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px' }}>
                            <input
                                type="checkbox"
                                checked={notifications[item.key]}
                                onChange={async (e) => {
                                     const isChecked = e.target.checked;
                                     if (item.key === 'push') {
                                        setNotifications(prev => ({ ...prev, push: isChecked }));
                                        
                                        try {
                                            const { NotificationManager } = await import('../../services/NotificationManager');
                                            await NotificationManager.initialize(user.id);
                                            if (isChecked) {
                                                await NotificationManager.register();
                                                await NotificationManager.setEnabled(true);
                                            } else {
                                                await NotificationManager.setEnabled(false);
                                            }
                                            
                                            // Maintain profile preferences sync
                                            await supabase.from('profiles').update({
                                                preferences: { 
                                                    ...user.preferences, 
                                                    notifications: { 
                                                        ...(user.preferences?.notifications || {}), 
                                                        push: isChecked 
                                                    } 
                                                }
                                            }).eq('id', user.id);
                                            
                                            await forceRefresh();
                                        } catch (err) {
                                            console.error('[Settings] Push toggle error:', err);
                                            alert(`Error: ${err.message}`);
                                            setNotifications(prev => ({ ...prev, push: !isChecked }));
                                        }
                                     } else {
                                         handleNotificationChange(item.key, isChecked);
                                     }
                                }}
                                style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{
                                position: 'absolute',
                                cursor: 'pointer',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: notifications[item.key] ? 'var(--primary-500)' : 'var(--border)',
                                transition: 'all var(--transition-fast)',
                                borderRadius: '24px'
                            }}>
                                <span style={{
                                    position: 'absolute',
                                    content: '',
                                    height: '18px',
                                    width: '18px',
                                    left: notifications[item.key] ? '26px' : '3px',
                                    bottom: '3px',
                                    background: 'white',
                                    transition: 'all var(--transition-fast)',
                                    borderRadius: '50%'
                                }} />
                            </span>
                        </label>
                    </div>
                ))}

                {notifications.routineAlarms && (
                    <div style={{ marginTop: 'var(--space-sm)', paddingLeft: 'var(--space-md)' }}>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            icon={Volume2}
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('test-alarm'));
                            }}
                        >
                            Test Audio Alarm
                        </Button>
                    </div>
                )}
            </div>

            {/* PWA Install Prompt */}
            {!isInstalled && (deferredPrompt || /iPhone|iPad|iPod/.test(navigator.userAgent)) && (
                <div style={{
                    marginTop: 'var(--space-lg)',
                    padding: 'var(--space-lg)',
                    background: 'rgba(99, 102, 241, 0.05)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px dashed var(--primary-300)',
                    textAlign: 'center'
                }}>
                    <h4 style={{ marginBottom: '8px' }}>📱 Install Zenith Mobile</h4>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
                        Install Zenith as an app for much more reliable push notifications and background updates.
                    </p>
                    
                    {deferredPrompt ? (
                        <Button 
                            icon={Plus} 
                            onClick={async () => {
                                deferredPrompt.prompt();
                                const { outcome } = await deferredPrompt.userChoice;
                                if (outcome === 'accepted') {
                                    setDeferredPrompt(null);
                                    setIsInstalled(true);
                                }
                            }}
                        >
                            Install Zenith App
                        </Button>
                    ) : (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                            To install: Tap <strong style={{ color: 'var(--primary-400)' }}>Share</strong> then <strong style={{ color: 'var(--primary-400)' }}>Add to Home Screen</strong>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
};

export default NotificationSettings;
