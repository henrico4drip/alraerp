import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/jovemhenrico/Documents/ERP/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

async function test() {
    console.log("Triggering connect action with secret and API key...");
    const secret = 'alraerp-webhook-secret-2026';
    const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-proxy?secret=${secret}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey
        },
        body: JSON.stringify({
            action: 'connect'
        })
    });

    const status = res.status;
    const text = await res.text();
    console.log("Status:", status);
    console.log("Response:", text.slice(0, 1000));
}

test();
