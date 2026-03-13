import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log("Fetching conversations via chatwoot proxy...");
    const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
        body: {
            action: 'chatwoot_proxy',
            method: 'GET',
            payload: {
                apiUrl: 'http://84.247.143.180',
                token: 'pgh3rRR6ZLirSnzdnuQZbhNV',
                path: '/api/v1/accounts/1/conversations?status=all&page=1'
            }
        }
    });

    if (error) {
        console.error("Proxy invoke error:", error);
    } else {
        console.log("Proxy response status:", data);
    }
}

test();
