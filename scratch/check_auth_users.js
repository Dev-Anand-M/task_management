import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error('No SUPABASE_SERVICE_ROLE_KEY found!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function checkAuthUsers() {
    try {
        const { data: { users }, error } = await supabase.auth.admin.listUsers();
        
        if (error) {
            console.error('Error fetching users:', error.message);
        } else {
            console.log(`Found ${users.length} users in auth.users:`);
            users.forEach(u => {
                console.log(`- ID: ${u.id}, Email: ${u.email}, Role in metadata: ${u.user_metadata?.role}`);
            });
        }
    } catch (err) {
        console.error('Exception:', err.message);
    }
}

checkAuthUsers();
