const { createClient } = require('@supabase/supabase-client');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkDeadlines() {
    const { data: tasks, error } = await supabase.from('tasks').select('*');
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    tasks.forEach(t => {
        console.log(`Task: "${t.title}"`);
        console.log(`  raw deadline: ${t.deadline}`);
        if (t.deadline) {
            const d = new Date(t.deadline);
            console.log(`  parsed local: ${d.toString()}`);
            console.log(`  parsed ISO:   ${d.toISOString()}`);
        }
    });
}

checkDeadlines();
