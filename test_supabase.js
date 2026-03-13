import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://greotjobqprtmrprptdb.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZW90am9icXBydG1ycHJwdGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3Njk5MTQsImV4cCI6MjA3NzM0NTkxNH0.EZ6myLK_86vxIUX00u_jyOs10yLzKKr3T35P2gJ5DGY');

async function run() {
    const { data, error } = await supabase.from('settings').select('*');
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}
run();
