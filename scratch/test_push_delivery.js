import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// VAPID keys
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:dev.klinux@proton.me';

async function testPushDelivery() {
    console.log('=== Testing Push Delivery to Dev Anand M ===');
    
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
        console.error('VAPID keys not configured in environment!');
        return;
    }
    
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

    try {
        // Fetch target subscription
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('name, push_subscription')
            .eq('email', 'dev.klinux@dev.com')
            .single();

        if (error || !profile) {
            console.error('Failed to find user profile:', error?.message || 'Not found');
            return;
        }

        if (!profile.push_subscription) {
            console.error(`User ${profile.name} does not have a push subscription!`);
            return;
        }

        console.log(`Found subscription for ${profile.name}. Sending push...`);
        console.log(`Endpoint: ${profile.push_subscription.endpoint}`);

        const payload = JSON.stringify({
            title: 'Direct Test Alert 🔔',
            body: 'Sent directly from local server script!',
            url: '/settings',
            tag: 'zenith-test-' + Date.now(),
            timestamp: Date.now()
        });

        const res = await webpush.sendNotification(
            { 
                endpoint: profile.push_subscription.endpoint, 
                keys: profile.push_subscription.keys 
            },
            payload,
            {
                TTL: 86400,
                urgency: 'high'
            }
        );

        console.log('FCM Server Response Status:', res.statusCode);
        console.log('FCM Server Headers:', res.headers);
        console.log('FCM Server Body:', res.body);
        console.log('✅ Push sent successfully!');

    } catch (err) {
        console.error('❌ Push failed!');
        console.error('Status Code:', err.statusCode);
        console.error('Error Headers:', err.headers);
        console.error('Error Body:', err.body);
        console.error('Error Message:', err.message);
    }
}

testPushDelivery();
