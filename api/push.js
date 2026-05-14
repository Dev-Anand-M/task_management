import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// VAPID keys should be generated once and stored in environment variables
// Use the keys generated for this project
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BIywJYLliCeDy38uq2Km1pgXg2-PjstbPuFusw-aikMwbHE7Z4M1CZnDSlJPsxL2bMFx0Dn3OfNlQAy9vqfYQcI";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "dIsljl-BVN0fz37z_jmmSYZ1Pb1dk6Rs3TdWKRws3GU";

webpush.setVapidDetails(
    'mailto:support@zenith.app',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const {
            user_id,
            user_ids,
            title,
            body,
            link,
            data
        } = req.body;

        // 1. Determine target users
        const targetUserIds = [...new Set([
            ...(Array.isArray(user_ids) ? user_ids : []),
            user_id
        ].filter(Boolean))];

        if (targetUserIds.length === 0) {
            return res.status(400).json({ success: false, error: 'No user targets provided' });
        }

        // 2. Fetch subscriptions for these users from Supabase
        const { data: profiles, error: fetchError } = await supabase
            .from('profiles')
            .select('id, preferences')
            .in('id', targetUserIds);

        if (fetchError) {
            console.error('[Push] Supabase fetch error:', fetchError);
            throw fetchError;
        }

        if (!profiles || profiles.length === 0) {
            console.warn('[Push] No profiles found for IDs:', targetUserIds);
            return res.status(200).json({ 
                success: true, 
                sentCount: 0, 
                message: 'User profile not found in database',
                debug: { targetUserIds, profilesCount: profiles?.length || 0 }
            });
        }

        // 3. Flatten all subscriptions from all targeted users
        const allSubscriptions = [];
        profiles.forEach(profile => {
            const subs = profile.preferences?.push_subscriptions;
            if (Array.isArray(subs)) {
                subs.forEach(sub => {
                    allSubscriptions.push({
                        ...sub,
                        userId: profile.id
                    });
                });
            } else {
                console.log(`[Push] User ${profile.id} has no push_subscriptions array in preferences`);
            }
        });

        if (allSubscriptions.length === 0) {
            console.log('[Push] No active subscriptions found for users:', targetUserIds);
            return res.status(200).json({ 
                success: true, 
                sentCount: 0, 
                message: 'No registered devices found',
                debug: { 
                    profilesFound: profiles.length,
                    preferencesKeys: profiles.map(p => Object.keys(p.preferences || {}))
                }
            });
        }

        // 4. Send notifications
        const payload = JSON.stringify({
            title: title || 'Zenith Notification',
            body: body || 'You have a new update.',
            url: link || '/',
            data: data || {}
        });

        const results = await Promise.allSettled(
            allSubscriptions.map(async (sub) => {
                try {
                    // Extract only what web-push needs to avoid errors
                    const pushSubscription = {
                        endpoint: sub.endpoint,
                        keys: {
                            p256dh: sub.keys?.p256dh,
                            auth: sub.keys?.auth
                        }
                    };
                    
                    if (!pushSubscription.endpoint || !pushSubscription.keys.p256dh || !pushSubscription.keys.auth) {
                        console.warn('[Push] Skipping invalid subscription for user:', sub.userId);
                        throw new Error('Invalid subscription format');
                    }

                    await webpush.sendNotification(pushSubscription, payload);
                    return { success: true, endpoint: sub.endpoint };
                } catch (err) {
                    if (err.statusCode === 404 || err.statusCode === 410) {
                        console.log('[Push] Subscription expired or gone:', sub.endpoint);
                    } else {
                        console.error('[Push] Error sending to endpoint:', sub.endpoint, err.message);
                    }
                    throw err;
                }
            })
        );

        const sentCount = results.filter(r => r.status === 'fulfilled').length;
        const failedCount = results.filter(r => r.status === 'rejected').length;

        console.log(`[Push] Finished. Sent: ${sentCount}, Failed: ${failedCount}`);

        return res.status(200).json({
            success: true,
            sentCount,
            failedCount,
            totalAttempted: allSubscriptions.length
        });

    } catch (error) {
        console.error('[Push API] Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
