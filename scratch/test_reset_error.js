import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testReset() {
    console.log('=== Simulating reset.sql Delete Sequence ===');
    const deleteSequence = [
        { name: 'quiz_attempts', query: () => supabase.from('quiz_attempts').delete().neq('id', '00000000-0000-0000-0000-000000000000') },
        { name: 'submissions', query: () => supabase.from('submissions').delete().neq('id', '00000000-0000-0000-0000-000000000000') },
        { name: 'quizzes', query: () => supabase.from('quizzes').delete().neq('id', '00000000-0000-0000-0000-000000000000') },
        { name: 'tasks', query: () => supabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000') },
        { name: 'profiles', query: () => supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000') }
    ];

    for (const step of deleteSequence) {
        try {
            console.log(`Attempting to delete all rows from: ${step.name}`);
            const { error } = await step.query();
            if (error) {
                console.error(`🔴 Error deleting from ${step.name}:`, error.message, error.details || '');
            } else {
                console.log(`✅ Successfully cleared (or already empty) ${step.name}`);
            }
        } catch (err) {
            console.error(`💥 Exception during ${step.name} delete:`, err.message);
        }
    }
}

testReset();
