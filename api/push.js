const admin = require('firebase-admin');

// Helper to get service account credentials from individual or combined env vars
const getServiceAccount = () => {
    // Option 1: Combined JSON string (common in Vercel)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        } catch (e) {
            console.error("[PushAPI] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:", e.message);
        }
    }

    // Option 2: Individual variables
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"(.*)"$/, '$1')
        : undefined;

    return {
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
    };
};

if (!admin.apps.length) {
    try {
        const cert = getServiceAccount();
        
        // Basic validation before initialization
        if (cert.projectId && cert.clientEmail && cert.privateKey) {
            admin.initializeApp({
                credential: admin.credential.cert(cert),
            });
            console.log("[PushAPI] Firebase Admin initialized successfully");
        } else {
            console.warn("[PushAPI] Firebase Admin NOT initialized: Missing credentials");
        }
    } catch (e) {
        console.error("[PushAPI] Firebase Initialization Error:", e.message);
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Final check
    const cert = getServiceAccount();
    if (!cert.projectId || !cert.clientEmail || !cert.privateKey) {
        return res.status(500).json({ 
            success: false, 
            error: 'Server configuration missing (Firebase Credentials). Please check your Vercel Environment Variables.',
            details: {
                hasServiceAccountJson: !!process.env.FIREBASE_SERVICE_ACCOUNT,
                hasIndividualVars: !!(process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL)
            }
        });
    }

    try {
        const { tokens, title, body, link, data } = req.body;

        if (!tokens || (Array.isArray(tokens) && tokens.length === 0)) {
            return res.status(400).json({ success: false, error: 'No tokens provided' });
        }

        const tokenList = Array.isArray(tokens) ? tokens : [tokens];
        
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

        const messages = tokenList.map(token => ({ ...baseMessage, token }));
        const response = await admin.messaging().sendEach(messages);

        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                const error = resp.error;
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
        return res.status(500).json({ success: false, error: error.message });
    }
}
