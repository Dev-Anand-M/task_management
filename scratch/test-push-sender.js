import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials missing from .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BDh_CLMgIPlfMDObBg2nesGZQ4ObJjfN0rUrPh9-W9iV3RojHkPsmEx6FsV0x_9XqsMU5It-zvGlNTnNxpBzgc0";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "DLgvMH_99zrztgXzuY50i6gVHXZGTUBqAVwxpHLV8Gg";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:dev.klinux@proton.me';

webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

async function testPush() {
    console.log('=== Fetching active subscriptions from Supabase ===');
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, push_subscription, preferences')
        .not('push_subscription', 'is', null);

    if (error) {
        console.error('Error fetching profiles:', error.message);
        return;
    }

    console.log(`Found ${profiles.length} profiles with push subscription column set.`);
    if (profiles.length === 0) {
        console.log('No profiles found with push_subscription set. Checking preferences array...');
        const { data: allProfiles, error: err2 } = await supabase
            .from('profiles')
            .select('id, email, preferences');
        
        if (err2) {
            console.error('Error fetching profiles:', err2.message);
            return;
        }
        
        const prefSubs = allProfiles.filter(p => p.preferences?.push_subscriptions?.length > 0);
        console.log(`Found ${prefSubs.length} profiles with preferences.push_subscriptions set.`);
        if (prefSubs.length === 0) {
            console.log('❌ No subscriptions found in the database to test.');
            return;
        }
        profiles.push(...prefSubs);
    }

    const profile = profiles[0];
    let subscription = profile.push_subscription;
    
    if (!subscription && profile.preferences?.push_subscriptions?.length > 0) {
        subscription = profile.preferences.push_subscriptions[0];
    }

    console.log('\n=== Target User ===');
    console.log(`ID: ${profile.id}`);
    console.log(`Email: ${profile.email}`);
    console.log(`Subscription object:`, JSON.stringify(subscription, null, 2));

    if (!subscription || !subscription.endpoint) {
        console.error('❌ Subscription has no valid endpoint.');
        return;
    }

    const payload = JSON.stringify({
        title: 'Zenith Diagnostic Test 🔔',
        body: 'This is a real-time push diagnostic test payload.',
        url: '/settings',
        tag: 'zenith-diagnostic'
    });

    console.log('\n=== Dispatched Payload ===');
    console.log(payload);

    console.log('\n=== Dispatching Push Notification ===');
    try {
        const result = await webpush.sendNotification({
            endpoint: subscription.endpoint,
            keys: {
                p256dh: subscription.keys?.p256dh,
                auth: subscription.keys?.auth
            }
        }, payload);

        console.log('✅ Push sent successfully!');
        console.log('Status Code:', result.statusCode);
        console.log('Headers:', JSON.stringify(result.headers, null, 2));
    } catch (err) {
        console.error('❌ Push sending failed!');
        console.error('Status Code:', err.statusCode);
        console.error('Headers:', JSON.stringify(err.headers, null, 2));
        console.error('Body:', err.body);
        console.error('Message:', err.message);
        console.error('Stack:', err.stack);
    }
}

testPush();
