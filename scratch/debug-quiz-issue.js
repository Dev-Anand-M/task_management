/**
 * Debug script to check quiz/attempt mismatch
 * Run in browser console on the evaluation page
 */

// Check what quiz attempts exist
const checkQuizIssue = async () => {
    const { supabase } = await import('../src/lib/supabase');
    
    console.log('=== Debugging Quiz Not Found Issue ===');
    
    // Get all quiz attempts
    const { data: attempts, error: attError } = await supabase
        .from('quiz_attempts')
        .select('id, quiz_id, user_id, score, completed_at');
    
    if (attError) {
        console.error('Error fetching attempts:', attError);
        return;
    }
    
    console.log(`Found ${attempts.length} quiz attempts`);
    
    // Get all quizzes
    const { data: quizzes, error: quizError } = await supabase
        .from('quizzes')
        .select('id, title, classroom_id, is_global');
    
    if (quizError) {
        console.error('Error fetching quizzes:', quizError);
        return;
    }
    
    console.log(`Found ${quizzes.length} quizzes`);
    
    // Find orphaned attempts
    const orphaned = attempts.filter(att => {
        return !quizzes.find(q => q.id === att.quiz_id);
    });
    
    if (orphaned.length > 0) {
        console.warn(`⚠️ Found ${orphaned.length} orphaned attempts (quiz doesn't exist):`);
        orphaned.forEach(att => {
            console.log(`  - Attempt ID: ${att.id}, Quiz ID: ${att.quiz_id}, Score: ${att.score}%`);
        });
    }
    
    // Check current user's classroom
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
        .from('profiles')
        .select('classroom_id, role')
        .eq('id', user.id)
        .single();
    
    console.log('Current user:', {
        id: user.id,
        email: user.email,
        classroom: profile?.classroom_id,
        role: profile?.role
    });
    
    // Check if there are classroom mismatches
    const mismatched = attempts.filter(att => {
        const quiz = quizzes.find(q => q.id === att.quiz_id);
        if (!quiz) return false; // Already counted as orphaned
        
        // If quiz is not global and has different classroom
        if (!quiz.is_global && quiz.classroom_id !== profile?.classroom_id) {
            return true;
        }
        return false;
    });
    
    if (mismatched.length > 0) {
        console.warn(`⚠️ Found ${mismatched.length} classroom mismatched attempts:`);
        mismatched.forEach(att => {
            const quiz = quizzes.find(q => q.id === att.quiz_id);
            console.log(`  - Attempt ID: ${att.id}, Quiz: "${quiz?.title}", Quiz Classroom: ${quiz?.classroom_id}, Your Classroom: ${profile?.classroom_id}`);
        });
    }
    
    // Summary
    console.log('\n=== Summary ===');
    console.log(`Total Attempts: ${attempts.length}`);
    console.log(`Total Quizzes: ${quizzes.length}`);
    console.log(`Orphaned Attempts (quiz deleted): ${orphaned.length}`);
    console.log(`Classroom Mismatches: ${mismatched.length}`);
    
    if (orphaned.length === 0 && mismatched.length === 0) {
        console.log('✅ All quiz attempts have valid quizzes!');
    }
    
    return { attempts, quizzes, orphaned, mismatched, profile };
};

// Run it
checkQuizIssue().then(result => {
    console.log('Debug complete. Check the logs above.');
    window.debugQuizData = result; // Store for inspection
});
