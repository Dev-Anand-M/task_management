import admin from 'firebase-admin';

// Helper to get service account credentials from individual or combined env vars
const getServiceAccount = () => {
    // Priority 1: Combined JSON string (common in Vercel)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            let json = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
            // Handle potentially wrapped/escaped JSON
            if (json.startsWith('"') && json.endsWith('"')) {
                json = json.substring(1, json.length - 1).replace(/\\"/g, '"');
            }
            const parsed = JSON.parse(json);
            
            // Normalize to a structure we can validate (handling both snake_case from JSON and camelCase from Admin SDK)
            return {
                projectId: parsed.project_id || parsed.projectId || process.env.VITE_FIREBASE_PROJECT_ID,
                clientEmail: parsed.client_email || parsed.clientEmail || process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: parsed.private_key || parsed.privateKey || (process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined)
            };
        } catch (e) {
            console.error("[PushAPI] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:", e.message);
        }
    }

    // Priority 2: Individual variables
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"(.*)"$/, '$1')
        : undefined;

    return {
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
    };
};

if (!admin.apps.length) {
    try {
        const cert = getServiceAccount();
        if (cert.projectId && cert.clientEmail && cert.privateKey) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: cert.projectId,
                    clientEmail: cert.clientEmail,
                    privateKey: cert.privateKey
                }),
            });
            console.log("[PushAPI] Firebase Admin initialized");
        }
    } catch (e) {
        console.error("[PushAPI] Initialization Error:", e.message);
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const cert = getServiceAccount();
    
    // Check if we have the critical bits
    if (!cert.projectId || !cert.clientEmail || !cert.privateKey) {
        return res.status(500).json({ 
            success: false, 
            error: 'Server configuration missing (Firebase Credentials).',
            diagnostic: {
                hasServiceAccountJson: !!process.env.FIREBASE_SERVICE_ACCOUNT,
                projectIdFound: !!cert.projectId,
                clientEmailFound: !!cert.clientEmail,
                privateKeyFound: !!cert.privateKey
            }
        });
    }

    try {
        const { tokens, title, body, link, data } = req.body;
        const tokenList = Array.isArray(tokens) ? tokens : [tokens];
        
        const baseMessage = {
            notification: { title, body },
            data: {
                title, body,
                link: link || '/',
                timestamp: Date.now().toString(),
                ...(data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {})
            },
            webpush: {
                headers: { Urgency: 'high' },
                notification: { 
                    title, body, 
                    icon: '/zenith.png', badge: '/zenith.png', 
                    requireInteraction: true 
                },
                fcm_options: { link: link || '/' }
            }
        };

        const messages = tokenList.map(token => ({ ...baseMessage, token }));
        const response = await admin.messaging().sendEach(messages);

        return res.status(200).json({
            success: response.successCount > 0,
            summary: `${response.successCount} success, ${response.failureCount} failure`,
            failedTokens: response.responses.map((r, i) => !r.success ? tokenList[i] : null).filter(Boolean)
        });

    } catch (error) {
        console.error('[PushAPI] Push Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
