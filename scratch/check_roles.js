
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const checkUser = async () => {
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) {
        console.error('Auth check failed:', userError);
    } else {
        console.log('Users found:', users.map(u => ({ email: u.email, id: u.id })));
    }

    const { data: profiles, error: profileError } = await supabase.from('profiles').select('*');
    if (profileError) {
        console.error('Profile check failed:', profileError);
    } else {
        console.log('Profiles found:', profiles.map(p => ({ email: p.email, role: p.role, id: p.id })));
    }
};

checkUser();
