import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        console.log('Initializing Firebase Admin for project:', serviceAccount.project_id);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error('Firebase Admin init error:', error);
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!admin.apps.length) {
        return res.status(500).json({ error: 'Firebase Admin not configured. Add FIREBASE_SERVICE_ACCOUNT to env.' });
    }

    const { tokens, title, body, link, data } = req.body;

    if (!tokens || !tokens.length) {
        return res.status(400).json({ error: 'No tokens provided' });
    }

    try {
        const message = {
            notification: {
                title: title,
                body: body,
                image: '/zenith.png' // Add image for rich notifications
            },
            data: {
                ...(data || {}),
                link: link || '/',
                timestamp: Date.now().toString()
            },
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    clickAction: link || '/',
                    channelId: 'default',
                    priority: 'high',
                    defaultSound: true,
                    defaultVibrateTimings: false,
                    vibrateTimings: ['0.2s', '0.1s', '0.2s'],
                    visibility: 'public',
                    notificationCount: 1
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1
                    }
                }
            },
            webpush: {
                headers: {
                    Urgency: 'high',
                    TTL: '86400' // 24 hours
                },
                fcm_options: {
                    link: link || '/',
                },
                notification: {
                    icon: '/zenith.png',
                    badge: '/zenith.png',
                    image: '/zenith.png',
                    tag: 'zenith-notification',
                    renotify: true,
                    requireInteraction: true,
                    vibrate: [200, 100, 200],
                    silent: false,
                    timestamp: Date.now(),
                    actions: [
                        {
                            action: 'open',
                            title: 'Open'
                        },
                        {
                            action: 'close',
                            title: 'Dismiss'
                        }
                    ]
                }
            }
        };

        let results;
        if (tokens.length === 1) {
            // Send to single device
            results = await admin.messaging().send({
                ...message,
                token: tokens[0]
            });
        } else {
            // Send to multiple devices
            results = await admin.messaging().sendEachForMulticast({
                ...message,
                tokens: tokens
            });
        }

        const failedTokens = [];
        if (tokens.length > 1 && results.responses) {
            results.responses.forEach((resp, idx) => {
                if (!resp.success && (resp.error?.code === 'messaging/registration-token-not-registered' || resp.error?.code === 'messaging/invalid-registration-token')) {
                    failedTokens.push(tokens[idx]);
                }
            });
        } else if (tokens.length === 1 && !results.success) {
            // Check if it's a registration error
             if (results.error?.code === 'messaging/registration-token-not-registered') {
                 failedTokens.push(tokens[0]);
             }
        }

        return res.status(200).json({ 
            success: true, 
            results: results,
            failedTokens: failedTokens,
            summary: `Sent to ${results.successCount || (tokens.length === 1 ? 1 : 0)} devices. Failed for ${results.failureCount || (tokens.length === 1 && !results.success ? 1 : 0)} devices.`,
            details: results.responses ? results.responses.map(r => ({
                success: r.success,
                error: r.error ? {
                    code: r.error.code,
                    message: r.error.message
                } : null
            })) : (tokens.length === 1 ? [{ success: true }] : [])
        });
    } catch (error) {
        console.error('Push Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
