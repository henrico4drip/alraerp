import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/jovemhenrico/Documents/ERP/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log("Triggering connect action with secret...");
    const secret = 'alraerp-webhook-secret-2026';
    const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-proxy?secret=${secret}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'connect'
        })
    });

    const status = res.status;
    const json = await res.json();
    console.log("Status:", status);
    console.log("Response:", JSON.stringify(json).slice(0, 500));
}

test();
