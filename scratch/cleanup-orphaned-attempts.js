/**
 * Cleanup Script: Find and optionally delete orphaned quiz attempts
 * 
 * Run this in browser console on your site:
 * 1. Open your site
 * 2. Press F12 (Developer Tools)
 * 3. Go to Console tab
 * 4. Copy and paste this entire script
 * 5. Press Enter
 */

(async () => {
    console.log('=== Quiz Attempts Cleanup Script ===\n');
    
    // Import Supabase client
    const { supabase } = await import('../src/lib/supabase.js');
    
    // Step 1: Get all quiz attempts
    console.log('Step 1: Fetching all quiz attempts...');
    const { data: attempts, error: attemptsError } = await supabase
        .from('quiz_attempts')
        .select('id, quiz_id, user_id, score, completed_at, profiles(name)');
    
    if (attemptsError) {
        console.error('❌ Error fetching attempts:', attemptsError);
        return;
    }
    
    console.log(`✅ Found ${attempts.length} quiz attempts\n`);
    
    // Step 2: Get all quizzes
    console.log('Step 2: Fetching all quizzes...');
    const { data: quizzes, error: quizzesError } = await supabase
        .from('quizzes')
        .select('id, title');
    
    if (quizzesError) {
        console.error('❌ Error fetching quizzes:', quizzesError);
        return;
    }
    
    console.log(`✅ Found ${quizzes.length} quizzes\n`);
    
    // Step 3: Find orphaned attempts
    console.log('Step 3: Finding orphaned attempts...');
    const quizIds = new Set(quizzes.map(q => q.id));
    const orphaned = attempts.filter(att => !quizIds.has(att.quiz_id));
    
    if (orphaned.length === 0) {
        console.log('✅ No orphaned attempts found! Database is clean.\n');
        return;
    }
    
    console.log(`⚠️  Found ${orphaned.length} orphaned attempts:\n`);
    
    orphaned.forEach((att, index) => {
        console.log(`${index + 1}. Attempt ID: ${att.id}`);
        console.log(`   Quiz ID: ${att.quiz_id} (DELETED)`);
        console.log(`   Student: ${att.profiles?.name || 'Unknown'}`);
        console.log(`   Score: ${att.score}%`);
        console.log(`   Completed: ${new Date(att.completed_at).toLocaleString()}`);
        console.log('');
    });
    
    // Step 4: Ask user if they want to delete
    console.log('\n=== CLEANUP OPTIONS ===\n');
    console.log('To DELETE these orphaned attempts, run:');
    console.log('  await window.deleteOrphanedAttempts();\n');
    console.log('To keep them (they will be hidden from UI), do nothing.\n');
    
    // Make delete function available globally
    window.deleteOrphanedAttempts = async () => {
        console.log('\n🗑️  Deleting orphaned attempts...\n');
        
        const orphanedIds = orphaned.map(att => att.id);
        
        const { data, error } = await supabase
            .from('quiz_attempts')
            .delete()
            .in('id', orphanedIds)
            .select('id');
        
        if (error) {
            console.error('❌ Error deleting attempts:', error);
            return;
        }
        
        console.log(`✅ Successfully deleted ${data.length} orphaned attempts!`);
        console.log('\nDeleted IDs:', data.map(d => d.id));
        console.log('\n✨ Database cleaned! Refresh your page to see the changes.');
        
        // Clean up the global function
        delete window.deleteOrphanedAttempts;
    };
    
    console.log('=== Script Complete ===');
})();
