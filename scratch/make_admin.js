import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function makeAdmin() {
    console.log('=== Making dev.klinux@dev.com an Admin ===');
    const { data, error } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('email', 'dev.klinux@dev.com')
        .select();
    
    if (error) {
        console.error('Error updating role:', error.message);
    } else {
        console.log('Successfully updated profile:', JSON.stringify(data, null, 2));
    }
}

makeAdmin();
