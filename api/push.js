const admin = require('firebase-admin');

// Health check for env vars (without leaking secrets)
const checkEnv = () => {
    const vars = {
        projectId: !!process.env.VITE_FIREBASE_PROJECT_ID,
        clientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: !!process.env.FIREBASE_PRIVATE_KEY
    };
    return vars;
};

if (!admin.apps.length) {
    try {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY
            ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"(.*)"$/, '$1')
            : undefined;

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.VITE_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey,
            }),
        });
        console.log("[PushAPI] Firebase Admin initialized");
    } catch (e) {
        console.error("[PushAPI] Firebase Initialization Error:", e.message);
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const envStatus = checkEnv();
    if (!envStatus.projectId || !envStatus.clientEmail || !envStatus.privateKey) {
        return res.status(500).json({ 
            success: false, 
            error: 'Server configuration missing (Firebase Env Vars)',
            missing: Object.entries(envStatus).filter(([k,v]) => !v).map(([k]) => k)
        });
    }

    try {
        const { tokens, title, body, link, data } = req.body;

        if (!tokens || (Array.isArray(tokens) && tokens.length === 0)) {
            return res.status(400).json({ success: false, error: 'No tokens provided' });
        }

        const tokenList = Array.isArray(tokens) ? tokens : [tokens];
        
        // Construct base message
        const baseMessage = {
            notification: { title, body },
            data: {
                title,
                body,
                link: link || '/',
                timestamp: Date.now().toString(),
                ...(data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {})
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

        // Use sendEach for better performance and error handling
        const messages = tokenList.map(token => ({ ...baseMessage, token }));
        const response = await admin.messaging().sendEach(messages);

        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                const error = resp.error;
                console.error(`[PushAPI] Send failed for token ${idx}:`, error?.message);
                if (error?.code === 'messaging/registration-token-not-registered' || 
                    error?.code === 'messaging/invalid-registration-token') {
                    failedTokens.push(tokenList[idx]);
                }
            }
        });

        return res.status(200).json({
            success: response.successCount > 0,
            summary: `${response.successCount} success, ${response.failureCount} failure`,
            failedTokens,
            total: tokenList.length
        });

    } catch (error) {
        console.error('[PushAPI] Critical failure:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
        });
    }
}
