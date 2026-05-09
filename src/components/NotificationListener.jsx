import React, { useEffect } from 'react';
import { onMessageListener } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

const NotificationListener = () => {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        let mounted = true;

        const setupListener = async () => {
            try {
                // This will wait for a foreground message
                const payload = await onMessageListener();
                if (mounted && payload) {
                    console.log('[Foreground Message]', payload);
                    
                    // Show a simple alert for now as a "foreground toast"
                    // In a real app, we'd use a nice toast library
                    alert(`🔔 ${payload.notification?.title}\n\n${payload.notification?.body}`);
                    
                    // Set up the next listener
                    setupListener();
                }
            } catch (err) {
                console.error('Foreground listener error:', err);
            }
        };

        setupListener();

        return () => {
            mounted = false;
        };
    }, [user]);

    return null; // This component doesn't render anything
};

export default NotificationListener;
