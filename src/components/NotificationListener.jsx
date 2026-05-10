import React, { useEffect, useState } from 'react';
import { onMessageListener } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';

const NotificationListener = () => {
    const { user } = useAuth();
    const [activeToast, setActiveToast] = useState(null);

    useEffect(() => {
        if (!user) {
            // Clear shown notifications when user logs out
            try {
                localStorage.removeItem(`shownNotifications_${user?.id}`);
            } catch (e) {
                console.error('Error clearing shown notifications:', e);
            }
            return;
        }

        let mounted = true;
        
        // Track the timestamp when component mounts
        const mountTime = Date.now();
        console.log('[NotificationListener] Mounted at:', new Date(mountTime).toISOString());
        
        // Load shown notifications from localStorage (user-specific)
        const getShownNotifications = () => {
            try {
                const key = `shownNotifications_${user.id}`;
                const stored = localStorage.getItem(key);
                if (stored) {
                    const data = JSON.parse(stored);
                    // Clean up old entries (older than 1 hour)
                    const oneHourAgo = Date.now() - (60 * 60 * 1000);
                    const cleaned = Object.fromEntries(
                        Object.entries(data).filter(([_, timestamp]) => timestamp > oneHourAgo)
                    );
                    localStorage.setItem(key, JSON.stringify(cleaned));
                    return new Set(Object.keys(cleaned));
                }
            } catch (e) {
                console.error('Error loading shown notifications:', e);
            }
            return new Set();
        };

        const markAsShown = (notificationId) => {
            try {
                const key = `shownNotifications_${user.id}`;
                const stored = localStorage.getItem(key);
                const data = stored ? JSON.parse(stored) : {};
                data[notificationId] = Date.now();
                localStorage.setItem(key, JSON.stringify(data));
            } catch (e) {
                console.error('Error saving shown notification:', e);
            }
        };

        const shownNotifications = getShownNotifications();

        // 1. Listen for FCM Foreground Messages
        const setupFCMListener = async () => {
            try {
                const payload = await onMessageListener();
                if (mounted && payload) {
                    console.log('[FCM Foreground]', payload);
                    
                    // Show custom toast instead of alert
                    showToast({
                        title: payload.notification?.title,
                        body: payload.notification?.body
                    });
                    
                    setupFCMListener();
                }
            } catch (err) {
                console.error('FCM listener error:', err);
            }
        };

        // 2. Listen for Supabase Real-time Table Changes (only NEW notifications)
        const channel = supabase
            .channel('realtime_notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    console.log('[DB Notification] Received:', payload);
                    
                    const notificationId = payload.new.id;
                    const notificationTime = new Date(payload.new.created_at).getTime();
                    const now = Date.now();
                    
                    console.log('[DB Notification] Details:', {
                        id: notificationId,
                        created: new Date(notificationTime).toISOString(),
                        mountTime: new Date(mountTime).toISOString(),
                        age: (now - notificationTime) / 1000 + 's',
                        alreadyShown: shownNotifications.has(notificationId)
                    });
                    
                    // Check if we've already shown this notification
                    if (shownNotifications.has(notificationId)) {
                        console.log('[DB Notification] Already shown, skipping');
                        return;
                    }
                    
                    // Allow notifications from the last 60 seconds, even if slightly before mount
                    // This handles clock skew between client and server
                    const sixtySecondsAgo = mountTime - (60 * 1000);
                    
                    if (notificationTime < sixtySecondsAgo) {
                        console.log('[DB Notification] Notification is too old (created before 60s ago), skipping');
                        return;
                    }
                    
                    // Mark as shown
                    shownNotifications.add(notificationId);
                    markAsShown(notificationId);
                    
                    console.log('[DB Notification] Showing toast');
                    showToast({
                        title: payload.new.title,
                        body: payload.new.message
                    });
                }
            )
            .subscribe();

        setupFCMListener();

        const showToast = (data) => {
            setActiveToast(data);
            setTimeout(() => {
                if (mounted) setActiveToast(null);
            }, 5000);
        };

        return () => {
            mounted = false;
            supabase.removeChannel(channel);
        };
    }, [user]);

    if (!activeToast) return null;

    return createPortal(
        <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            left: '20px',
            maxWidth: '400px',
            margin: '0 auto',
            background: 'rgba(30, 41, 59, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-md)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-md)',
            animation: 'slideInDown 0.3s ease-out'
        }}>
            <div style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--gradient-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
            }}>
                <Bell size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'white' }}>
                    {activeToast.title}
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {activeToast.body}
                </p>
            </div>
            <style>{`
                @keyframes slideInDown {
                    from { transform: translateY(-100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>,
        document.body
    );
};

export default NotificationListener;
