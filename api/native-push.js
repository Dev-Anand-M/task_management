// Native Web Push API (No OneSignal needed)
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Auth verification - require valid Supabase session
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
        try {
            const sb = createClient(supabaseUrl, supabaseKey);
            const { data: { user }, error } = await sb.auth.getUser(authHeader.split(' ')[1]);
            if (error || !user) {
                return res.status(401).json({ error: 'Invalid or expired session' });
            }
        } catch (authError) {
            console.error('[Push] Auth verification failed:', authError.message);
            return res.status(401).json({ error: 'Authentication failed' });
        }
    }

    const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
    const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@zenith.app';

    // Debug logging
    console.log('[Push] VAPID Keys Check:', {
        hasPublicKey: !!VAPID_PUBLIC_KEY,
        hasPrivateKey: !!VAPID_PRIVATE_KEY,
        publicKeyLength: VAPID_PUBLIC_KEY?.length,
        privateKeyLength: VAPID_PRIVATE_KEY?.length,
        publicKeyStart: VAPID_PUBLIC_KEY?.substring(0, 20),
        privateKeyStart: VAPID_PRIVATE_KEY?.substring(0, 20),
        subject: VAPID_SUBJECT
    });

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        return res.status(500).json({ 
            success: false, 
            error: 'VAPID keys not configured. Run: npx web-push generate-vapid-keys' 
        });
    }

    try {
        const { subscription, title, body, url, data } = req.body;
        
        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ 
                success: false, 
                error: 'No push subscription provided' 
            });
        }

        // Configure web-push
        webpush.setVapidDetails(
            VAPID_SUBJECT,
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY
        );

        // Prepare notification payload
        const payload = JSON.stringify({
            title: title || 'Zenith',
            body: body || 'You have a new notification',
            icon: '/zenith.png',
            badge: '/zenith.png',
            url: url || '/',
            data: data || {},
            tag: `zenith-${Date.now()}`
        });

        // Send push notification
        const result = await webpush.sendNotification(subscription, payload);

        console.log('[Push] Notification sent successfully');
        return res.status(200).json({
            success: true,
            message: 'Push notification sent',
            statusCode: result.statusCode
        });

    } catch (error) {
        console.error('[Push] Error sending notification:', error);
        console.error('[Push] Error details:', {
            statusCode: error.statusCode,
            body: error.body,
            headers: error.headers,
            message: error.message
        });
        
        // Handle specific errors
        if (error.statusCode === 410 || error.statusCode === 404) {
            // Subscription expired or invalid
            return res.status(410).json({
                success: false,
                error: 'Push subscription expired or invalid',
                expired: true
            });
        }
        
        if (error.statusCode === 401) {
            return res.status(401).json({
                success: false,
                error: 'VAPID authentication failed. Check your VAPID keys.'
            });
        }
        
        return res.status(500).json({ 
            success: false, 
            error: error.message,
            statusCode: error.statusCode,
            details: error.body
        });
    }
}
