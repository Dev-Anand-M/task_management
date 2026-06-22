const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
}
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

console.log(`URL: ${supabaseUrl}`);
console.log(`Has service key: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDeadlines() {
    console.log('Querying tasks...');
    const { data: tasks, error } = await supabase.from('tasks').select('*');
    if (error) {
        console.error('Error querying tasks:', error);
        return;
    }
    
    console.log(`Found ${tasks ? tasks.length : 0} tasks.`);
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

checkDeadlines().then(() => console.log('Done')).catch(err => console.error(err));
