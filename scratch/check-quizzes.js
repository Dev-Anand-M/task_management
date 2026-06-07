import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkQuizzes() {
    console.log('=== Checking Quiz Database Integrity ===');
    
    // 1. Get Quiz Attempts
    const { data: attempts, error: attError } = await supabase
        .from('quiz_attempts')
        .select('id, quiz_id, user_id, completed_at, score');
        
    if (attError) {
        console.error('Error fetching quiz attempts:', attError.message);
        return;
    }
    
    console.log(`Found ${attempts.length} quiz attempts in database.`);
    
    // 2. Get Quizzes
    const { data: quizzes, error: quizError } = await supabase
        .from('quizzes')
        .select('id, title');
        
    if (quizError) {
        console.error('Error fetching quizzes:', quizError.message);
        return;
    }
    
    console.log(`Found ${quizzes.length} quizzes in database.`);
    const quizIds = new Set(quizzes.map(q => q.id));
    
    // 3. Find Mismatches
    let mismatches = 0;
    for (const att of attempts) {
        if (!quizIds.has(att.quiz_id)) {
            console.log(`⚠️ Attempt ID ${att.id} points to missing Quiz ID ${att.quiz_id} (Score: ${att.score}%)`);
            mismatches++;
        }
    }
    
    if (mismatches === 0) {
        console.log('✅ No integrity mismatches found! All attempts map to existing quizzes.');
    } else {
        console.log(`❌ Found ${mismatches} orphaned attempts pointing to non-existent quizzes.`);
    }
}

checkQuizzes();
