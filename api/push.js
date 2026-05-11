const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.VITE_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { tokens, title, body, link, data } = req.body;

        if (!tokens || (Array.isArray(tokens) && tokens.length === 0)) {
            return res.status(400).json({ success: false, error: 'No tokens provided' });
        }

        const tokenList = Array.isArray(tokens) ? tokens : [tokens];
        console.log(`[PushAPI] Sending to ${tokenList.length} tokens...`);

        const message = {
            notification: { title, body },
            data: {
                title,
                body,
                link: link || '/',
                timestamp: Date.now().toString(),
                ...(data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {})
            },
            android: { 
                priority: 'high', 
                notification: { sound: 'default', clickAction: 'FLUTTER_NOTIFICATION_CLICK' } 
            },
            apns: { 
                headers: { 'apns-priority': '10' }, 
                payload: { aps: { sound: 'default', badge: 1 } } 
            },
            webpush: {
                headers: { Urgency: 'high' },
                notification: { 
                    title, 
                    body, 
                    icon: '/zenith.png', 
                    badge: '/zenith.png',
                    requireInteraction: true
                },
                fcm_options: { link: link || '/' }
            }
        };

        const results = await Promise.all(tokenList.map(async (token) => {
            try {
                const response = await admin.messaging().send({ ...message, token });
                return { token, success: true, response };
            } catch (error) {
                console.error(`[PushAPI] Token Error:`, error.message);
                return { token, success: false, error: error.message, code: error.code };
            }
        }));

        const successCount = results.filter(r => r.success).length;
        const failedTokens = results.filter(r => !r.success).map(r => r.token);

        return res.status(200).json({
            success: successCount > 0,
            summary: `${successCount} success, ${results.length - successCount} failure`,
            failedTokens,
            results
        });

    } catch (error) {
        console.error('[PushAPI] Critical failure:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
