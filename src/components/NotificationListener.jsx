import React, { useEffect, useState, useRef } from 'react';
import { onMessage } from 'firebase/messaging';
import { messaging } from '../lib/firebase';
import { Bell, X } from 'lucide-react';

const NotificationListener = () => {
    const [toast, setToast] = useState(null);
    const listenerRef = useRef(false);

    useEffect(() => {
        if (listenerRef.current || !messaging) return;
        listenerRef.current = true;

        console.log('[NotificationListener] Setting up foreground listener...');

        // This fires when a push message arrives while the app is in the FOREGROUND
        const unsubscribe = onMessage(messaging, (payload) => {
            console.log('[NotificationListener] Foreground message received:', payload);
            
            const title = payload.notification?.title || payload.data?.title || 'New Update';
            const body = payload.notification?.body || payload.data?.body || '';
            const link = payload.data?.link || '/';

            // 1. Show in-app toast
            setToast({ title, body, link });
            
            // Auto-hide after 10 seconds
            const timer = setTimeout(() => setToast(null), 10000);

            // 2. ALSO trigger a browser Notification so it shows in the system drawer/banner
            // Mobile browsers often don't show the system banner if the app is open
            // but calling showNotification manually forces it.
            if ('Notification' in window && Notification.permission === 'granted') {
                try {
                    navigator.serviceWorker.ready.then(registration => {
                        registration.showNotification(title, {
                            body,
                            icon: '/zenith.png',
                            badge: '/zenith.png',
                            tag: 'zenith-fg-' + Date.now(),
                            vibrate: [200, 100, 200],
                            data: { link },
                            renotify: true
                        });
                    }).catch(err => {
                        console.warn('[NotificationListener] SW not ready, using basic Notification:', err);
                        new Notification(title, { body, icon: '/zenith.png' });
                    });
                } catch (e) {
                    console.warn('[NotificationListener] Notification error:', e);
                }
            }

            return () => clearTimeout(timer);
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    if (!toast) return null;

    return (
        <div style={{
            position: 'fixed', top: '16px', right: '16px', zIndex: 10000,
            maxWidth: '380px', width: 'calc(100vw - 32px)',
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)', padding: 'var(--space-md)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            animation: 'slideInRight 0.3s ease-out',
            display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)'
        }}>
            <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: 'var(--primary-500)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
                <Bell size={18} color="white" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-sm)' }}>{toast.title}</p>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toast.body}</p>
            </div>
            <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}>
                <X size={16} />
            </button>
            <style>{`
                @keyframes slideInRight {
                    from { opacity: 0; transform: translateX(100px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </div>
    );
};

export default NotificationListener;
