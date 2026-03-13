import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function alter() {
    const webhookSecret = 'alraerp-webhook-secret-2026';
    const url = `${supabaseUrl}/functions/v1/whatsapp-proxy?secret=${webhookSecret}`;

    console.log("Calling edge function...", url);
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ action: 'alter_settings' })
    });

    const text = await response.text();
    console.log('Response:', response.status, text);
}

alter();
