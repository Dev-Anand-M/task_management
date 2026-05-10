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
        if (!user) return;

        let mounted = true;

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
                    console.log('[DB Notification]', payload);
                    
                    // Only show toast for notifications created in the last 10 seconds
                    // This prevents showing old notifications when app opens
                    const notificationTime = new Date(payload.new.created_at).getTime();
                    const now = Date.now();
                    const ageInSeconds = (now - notificationTime) / 1000;
                    
                    if (ageInSeconds < 10) {
                        showToast({
                            title: payload.new.title,
                            body: payload.new.message
                        });
                    } else {
                        console.log('[DB Notification] Skipping old notification (age:', ageInSeconds, 'seconds)');
                    }
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
