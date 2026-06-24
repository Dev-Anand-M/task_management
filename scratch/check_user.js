import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
    console.log('=== Checking User dev.klinux@dev.com ===');
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', 'dev.klinux@dev.com')
        .single();
    
    if (error) {
        console.error('Error fetching profile:', error.message);
    } else {
        console.log('Profile details:', JSON.stringify(profile, null, 2));
    }
}

checkUser();
