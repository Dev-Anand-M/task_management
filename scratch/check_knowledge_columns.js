import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkKnowledgeBase() {
    try {
        const { data, error } = await supabase
            .from('knowledge_base')
            .select('*')
            .limit(1);
        
        if (error) {
            console.error('Error fetching knowledge_base:', error.message);
        } else {
            console.log('knowledge_base row:', data[0]);
        }
    } catch (err) {
        console.error('Exception:', err.message);
    }
}

checkKnowledgeBase();
