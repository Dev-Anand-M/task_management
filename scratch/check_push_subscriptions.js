import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPushSubscriptions() {
    console.log('=== Checking Profiles and Push Subscriptions ===');
    try {
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, name, role, email, push_subscription');
        
        if (error) {
            console.error('Error fetching profiles:', error.message);
            return;
        }

        console.log(`Found ${profiles.length} profiles:`);
        profiles.forEach(p => {
            const hasSub = p.push_subscription ? '✅ Has Subscription' : '❌ Null';
            let endpointStr = '';
            if (p.push_subscription && p.push_subscription.endpoint) {
                endpointStr = `(${p.push_subscription.endpoint.substring(0, 45)}...)`;
            }
            console.log(`- User: ${p.name || 'No Name'} (${p.email || 'No Email'}) | Role: ${p.role} | Push: ${hasSub} ${endpointStr}`);
        });
    } catch (err) {
        console.error('Exception:', err.message);
    }
}

checkPushSubscriptions();
