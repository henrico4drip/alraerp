import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://greotjobqprtmrprptdb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZW90am9icXBydG1ycHJwdGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3Njk5MTQsImV4cCI6MjA3NzM0NTkxNH0.EZ6myLK_86vxIUX00u_jyOs10yLzKKr3T35P2gJ5DGY';
const supabase = createClient(supabaseUrl, supabaseKey);

const res = await fetch(supabaseUrl + '/functions/v1/whatsapp-proxy', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + supabaseKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
        action: 'chatwoot_proxy',
        method: 'GET',
        payload: {
            apiUrl: 'http://84.247.143.180',
            token: 'pgh3rRR6ZLirSnzdnuQZbhNV',
            path: '/api/v1/accounts/1/conversations?status=all&page=1'
        }
    })
});
console.log("Status:", res.status);
console.log("Body:", await res.text());

test();
