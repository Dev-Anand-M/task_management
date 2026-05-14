// Native Web Push API (No OneSignal needed)
import webpush from 'web-push';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
    const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@zenith.app';

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
        
        // Handle specific errors
        if (error.statusCode === 410 || error.statusCode === 404) {
            // Subscription expired or invalid
            return res.status(410).json({
                success: false,
                error: 'Push subscription expired or invalid',
                expired: true
            });
        }
        
        return res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
}
