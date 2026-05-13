export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const ONESIGNAL_APP_ID = "595cc111-feab-4d1c-8d80-fdbea3b564ec";
    const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
    const ONESIGNAL_AUTH_HEADER = ONESIGNAL_API_KEY?.startsWith('Key ') || ONESIGNAL_API_KEY?.startsWith('Basic ')
        ? ONESIGNAL_API_KEY
        : `Key ${ONESIGNAL_API_KEY}`;

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

        const requestOrigin = req.headers.origin || `https://${req.headers.host}`;
        const targetUrl = link
            ? new URL(link, requestOrigin).toString()
            : requestOrigin;

        const basePayload = {
                app_id: ONESIGNAL_APP_ID,
                contents: { "en": body || 'You have a new notification.' },
                headings: { "en": title || 'Zenith' },
                web_url: targetUrl,
                data: { ...(data || {}), link: link || '/' },
                // Background delivery optimizations
                web_push_topic: "task_notification",
                chrome_web_icon: "https://zenith-sable-alpha.vercel.app/zenith.png",
                chrome_web_badge: "https://zenith-sable-alpha.vercel.app/zenith.png",
                android_accent_color: "6366F1",
                priority: 10
        };

        const sendNotification = async (target) => {
            const response = await fetch('https://api.onesignal.com/notifications', {
                method: 'POST',
                headers: {
                    'Authorization': ONESIGNAL_AUTH_HEADER,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...basePayload,
                    ...target
                })
            });

            const responseText = await response.text();
            let body;

            try {
                body = responseText ? JSON.parse(responseText) : {};
            } catch {
                body = { raw: responseText };
            }

            return {
                ok: response.ok,
                status: response.status,
                body
            };
        };

        // Prefer the concrete browser subscription ID when we have it. User alias
        // targeting only works after that browser has run OneSignal.login(user.id).
        let result = null;
        let targetMode = null;
        const attempts = [];

        if (subscriptionIds.length > 0) {
            targetMode = 'subscription';
            result = await sendNotification({
                include_subscription_ids: subscriptionIds
            });
            attempts.push({ targetMode, status: result.status, response: result.body });
        }

        if (
            externalIds.length > 0 &&
            (!result || !result.ok || Number(result.body?.recipients || 0) === 0)
        ) {
            targetMode = result && !result.ok ? 'external_id_after_subscription_error' : 'external_id';
            result = await sendNotification({
                include_aliases: { external_id: externalIds },
                target_channel: 'push'
            });
            attempts.push({ targetMode, status: result.status, response: result.body });
        }

        if (!result?.ok || result.body?.errors) {
            return res.status(result?.status || 400).json({
                success: false,
                error: result?.body?.errors || result?.body?.error || result?.body || 'OneSignal request failed',
                attempts
            });
        }

        return res.status(200).json({
            success: true,
            summary: 'Notification sent via OneSignal',
            id: result.body.id,
            recipients: result.body.recipients || 0,
            targetMode,
            attempts
        });

    } catch (error) {
        console.error('[OneSignal API] Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
