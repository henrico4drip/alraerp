import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/jovemhenrico/Documents/ERP/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log("Triggering connect action to fix Chatwoot configuration in Evolution API...");
    const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
        body: {
            action: 'connect'
        }
    });

    if (error) {
        console.error("Proxy invoke error:", error);
    } else {
        console.log("Connect response:", JSON.stringify(data).slice(0, 500));
    }
}

test();
