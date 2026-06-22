import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config(); // Fallback to .env

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCounts() {
    console.log('=== Checking All Tables with Service Role ===');
    const tables = [
        'profiles', 
        'tasks', 
        'quizzes', 
        'submissions', 
        'quiz_attempts', 
        'invite_codes', 
        'notifications', 
        'classrooms', 
        'announcements', 
        'knowledge_base', 
        'routines', 
        'routine_logs', 
        'ai_history', 
        'ai_timetables', 
        'study_notes'
    ];
    
    for (const t of tables) {
        try {
            const { count, error } = await supabase
                .from(t)
                .select('*', { count: 'exact', head: true });
            
            if (error) {
                console.error(`Error querying table "${t}":`, error.message);
            } else {
                console.log(`Table "${t}": ${count} rows`);
            }
        } catch (err) {
            console.error(`Exception querying table "${t}":`, err.message);
        }
    }
}

checkCounts();
