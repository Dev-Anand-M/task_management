import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
    try {
        console.log('Testing quiz attempts SELECT...');
        const { data, error } = await supabase
            .from('quiz_attempts')
            .select('*, quizzes!left(title, points)')
            .limit(5);
        
        if (error) {
            console.error('Error:', error.message);
        } else {
            console.log('Results:', data);
        }
    } catch (err) {
        console.error('Exception:', err.message);
    }
}

testQuery();
