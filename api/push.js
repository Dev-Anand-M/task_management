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
            },
            data: {
                ...(data || {}),
                link: link || '/',
            },
            // Web/PWA specific config
            webpush: {
                fcm_options: {
                    link: link || '/',
                },
                notification: {
                    icon: '/vite.svg',
                    badge: '/vite.svg',
                    tag: 'idl-notification',
                    renotify: true,
                    vibrate: [200, 100, 200]
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
        }

        return res.status(200).json({ 
            success: true, 
            results: results,
            failedTokens: failedTokens,
            details: results.responses ? results.responses.map(r => ({
                success: r.success,
                error: r.error ? {
                    code: r.error.code,
                    message: r.error.message
                } : null
            })) : null
        });
    } catch (error) {
        console.error('Push Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
