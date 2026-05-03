import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase environment variables. Please check your .env file.\n' +
        'Required variables:\n' +
        '- VITE_SUPABASE_URL\n' +
        '- VITE_SUPABASE_ANON_KEY\n\n' +
        'See .env.example for reference.'
    );
}

console.log('Initializing Supabase client with URL:', supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'zenith-auth-v2',
        lock: {
            acquire: (name, acquireCallback) => {
                return acquireCallback();
            },
            release: (name) => {
                // Dummy release
                return Promise.resolve();
            }
        }
    },
    global: {
        headers: {
            'X-Client-Info': 'skillquest-app'
        }
    }
});
