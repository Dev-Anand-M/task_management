export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const ONESIGNAL_APP_ID = "595cc111-feab-4d1c-8d80-fdbea3b564ec";
    const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

    if (!ONESIGNAL_API_KEY) {
        return res.status(500).json({ 
            success: false, 
            error: 'OneSignal API Key missing. Please add ONESIGNAL_API_KEY to Vercel.' 
        });
    }

    try {
        const {
            onesignal_id,
            onesignal_ids,
            user_id,
            user_ids,
            tokens,
            title,
            body,
            link,
            data
        } = req.body;
        
        const externalIds = [...new Set([
            ...(Array.isArray(user_ids) ? user_ids : []),
            user_id
        ].filter(Boolean).map(String))];

        const subscriptionIds = [...new Set([
            ...(Array.isArray(onesignal_ids) ? onesignal_ids : []),
            ...(Array.isArray(tokens) ? tokens : []),
            onesignal_id
        ].filter(Boolean).map(String))];

        if (externalIds.length === 0 && subscriptionIds.length === 0) {
            return res.status(400).json({ success: false, error: 'No OneSignal target provided' });
        }

        const target = externalIds.length > 0
            ? {
                include_aliases: { external_id: externalIds },
                target_channel: 'push'
            }
            : {
                include_subscription_ids: subscriptionIds
            };

        const requestOrigin = req.headers.origin || `https://${req.headers.host}`;
        const targetUrl = link
            ? new URL(link, requestOrigin).toString()
            : requestOrigin;

        const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${ONESIGNAL_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                app_id: ONESIGNAL_APP_ID,
                ...target,
                contents: { "en": body || 'You have a new notification.' },
                headings: { "en": title || 'Zenith' },
                url: targetUrl,
                web_url: targetUrl,
                data: { ...(data || {}), link: link || '/' },
                // Background delivery optimizations
                web_push_topic: "task_notification",
                chrome_web_icon: "https://zenith-sable-alpha.vercel.app/zenith.png",
                chrome_web_badge: "https://zenith-sable-alpha.vercel.app/zenith.png",
                android_accent_color: "6366F1",
                priority: 10
            })
        });

        const result = await response.json();

        if (result.errors) {
            return res.status(400).json({ success: false, error: result.errors[0] });
        }

        return res.status(200).json({
            success: true,
            summary: 'Notification sent via OneSignal',
            id: result.id
        });

    } catch (error) {
        console.error('[OneSignal API] Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
