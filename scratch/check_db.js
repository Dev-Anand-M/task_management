
import { createClient } from '@supabase/supabase-client';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkTables() {
  const { data, error } = await supabase.from('ai_usage').select('*').limit(1);
  if (error) {
    console.log('ai_usage table does not exist or error:', error.message);
  } else {
    console.log('ai_usage table exists!');
  }
}

checkTables();
