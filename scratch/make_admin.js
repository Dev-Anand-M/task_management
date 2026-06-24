import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function makeAdmin() {
    console.log('=== Promoting dev.klinux@dev.com to Admin ===');
    const { data, error } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('email', 'dev.klinux@dev.com')
        .select();
    
    if (error) {
        console.error('Error promoting user:', error.message);
    } else {
        console.log('User promoted successfully:', JSON.stringify(data, null, 2));
    }
}

makeAdmin();
