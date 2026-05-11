import admin from 'firebase-admin';

// HELPER: Robust Service Account Parsing
const getServiceAccount = () => {
    let cert = {
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"(.*)"$/, '$1') : undefined
    };

    // If we have a JSON blob, it takes precedence
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            let jsonStr = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
            // Remove wrapping quotes if they exist (Vercel sometimes adds them)
            if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
                jsonStr = jsonStr.substring(1, jsonStr.length - 1).replace(/\\"/g, '"');
            }
            const parsed = JSON.parse(jsonStr);
            cert.projectId = parsed.project_id || parsed.projectId || cert.projectId;
            cert.clientEmail = parsed.client_email || parsed.clientEmail || cert.clientEmail;
            cert.privateKey = (parsed.private_key || parsed.privateKey || cert.privateKey)?.replace(/\\n/g, '\n');
        } catch (e) {
            console.error("[PushAPI] JSON Parse Error:", e.message);
        }
    }

    return cert;
};

// INITIALIZATION
const initAdmin = () => {
    if (admin.apps.length > 0) return true;
    
    const cert = getServiceAccount();
    if (!cert.projectId || !cert.clientEmail || !cert.privateKey) {
        return false;
    }

    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: cert.projectId,
                clientEmail: cert.clientEmail,
                privateKey: cert.privateKey
            })
        });
        return true;
    } catch (e) {
        console.error("[PushAPI] Init Error:", e.message);
        return false;
    }
};

export default async function handler(req, res) {
    // 1. CORS & Method check
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // 2. Initialization & Diagnostic
    const isReady = initAdmin();
    if (!isReady) {
        const cert = getServiceAccount();
        return res.status(500).json({ 
            success: false, 
            error: 'Firebase Admin not initialized. Check Vercel Environment Variables.',
            debug: {
                hasServiceAccountJson: !!process.env.FIREBASE_SERVICE_ACCOUNT,
                hasProjectId: !!cert.projectId,
                hasEmail: !!cert.clientEmail,
                hasKey: !!cert.privateKey,
                envKeysFound: Object.keys(process.env).filter(k => k.includes('FIREBASE') || k.includes('VITE'))
            }
        });
    }

    try {
        const { tokens, title, body, link, data } = req.body;
        if (!tokens || (Array.isArray(tokens) && tokens.length === 0)) {
            return res.status(400).json({ success: false, error: 'No tokens provided' });
        }

        const tokenList = Array.isArray(tokens) ? tokens : [tokens];
        
        const message = {
            notification: { title, body },
            data: {
                title, body,
                link: link || '/',
                timestamp: Date.now().toString(),
                ...(data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {})
            },
            webpush: {
                headers: { Urgency: 'high' },
                notification: { title, body, icon: '/zenith.png', badge: '/zenith.png', requireInteraction: true },
                fcm_options: { link: link || '/' }
            }
        };

        const response = await admin.messaging().sendEach(tokenList.map(token => ({ ...message, token })));

        return res.status(200).json({
            success: response.successCount > 0,
            summary: `${response.successCount} success, ${response.failureCount} failure`,
            results: response.responses.map(r => ({ success: r.success, error: r.error?.message }))
        });

    } catch (error) {
        console.error('[PushAPI] Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
