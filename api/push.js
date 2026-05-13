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
            data,
            debug: debugRequested = false
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
                isAnyWeb: true,
                android_accent_color: "6366F1",
                priority: 10
        };

        const readJsonResponse = async (response) => {
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

        const sendNotification = async (target) => {
            const response = await fetch('https://api.onesignal.com/notifications?c=push', {
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

            return readJsonResponse(response);
        };

        const lookupSubscription = async (subscriptionId) => {
            const identityResponse = await fetch(
                `https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}/subscriptions/${subscriptionId}/user/identity`,
                { headers: { 'Authorization': ONESIGNAL_AUTH_HEADER } }
            );
            const identityResult = await readJsonResponse(identityResponse);
            const oneSignalUserId = identityResult.body?.identity?.onesignal_id;

            if (!identityResult.ok || !oneSignalUserId) {
                return {
                    subscriptionId,
                    identity: identityResult
                };
            }

            const userResponse = await fetch(
                `https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}/users/by/onesignal_id/${oneSignalUserId}`,
                { headers: { 'Authorization': ONESIGNAL_AUTH_HEADER } }
            );
            const userResult = await readJsonResponse(userResponse);
            const matchingSubscription = userResult.body?.subscriptions?.find(
                (subscription) => subscription.id === subscriptionId
            );

            return {
                subscriptionId,
                identity: identityResult,
                subscription: matchingSubscription || null
            };
        };

        const lookupMessage = async (messageId) => {
            if (!messageId) return null;

            // Give OneSignal a brief moment to populate delivery counters.
            await new Promise(resolve => setTimeout(resolve, 1200));

            const response = await fetch(
                `https://api.onesignal.com/notifications/${messageId}?app_id=${ONESIGNAL_APP_ID}`,
                { headers: { 'Authorization': ONESIGNAL_AUTH_HEADER } }
            );
            return readJsonResponse(response);
        };

        const hasTargetingProblem = (apiResult) => {
            const responseBody = apiResult?.body || {};
            return !apiResult?.ok
                || !!responseBody.errors
                || !!responseBody.warnings?.invalid_external_user_ids
                || !!responseBody.errors?.invalid_aliases
                || !!responseBody.errors?.invalid_player_ids;
        };

        // Prefer external_id because OneSignal links every browser/device for the
        // same signed-in user after OneSignal.login(user.id). Subscription ID is
        // kept as a fallback for users who have not revisited since this fix.
        let result = null;
        let targetMode = null;
        const attempts = [];
        let debug = null;

        if (externalIds.length > 0) {
            targetMode = 'external_id';
            result = await sendNotification({
                include_aliases: { external_id: externalIds },
                target_channel: 'push'
            });
            attempts.push({ targetMode, status: result.status, response: result.body });
        }

        if (subscriptionIds.length > 0 && (!result || hasTargetingProblem(result))) {
            targetMode = result ? 'subscription_after_external_id_error' : 'subscription';
            result = await sendNotification({
                include_subscription_ids: subscriptionIds
            });
            attempts.push({ targetMode, status: result.status, response: result.body });
        }

        if (debugRequested) {
            debug = {
                subscriptionLookups: await Promise.all(subscriptionIds.slice(0, 3).map(lookupSubscription))
            };
        }

        if (!result?.ok || result.body?.errors) {
            return res.status(result?.status || 400).json({
                success: false,
                error: result?.body?.errors || result?.body?.error || result?.body || 'OneSignal request failed',
                attempts,
                debug
            });
        }

        const messageStatus = debugRequested ? await lookupMessage(result.body.id) : null;

        return res.status(200).json({
            success: true,
            summary: 'Notification sent via OneSignal',
            id: result.body.id,
            targetMode,
            attempts,
            messageStatus,
            debug
        });

    } catch (error) {
        console.error('[OneSignal API] Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
