import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCols() {
    const { data: { session }, error: signErr } = await supabase.auth.signInWithPassword({
        email: 'henrico.pierdona@gmail.com', // or any user with a token
        password: process.env.TEMP_PASSWORD || 'invalid'
    });
    if (signErr) {
        console.log('Login fail', signErr.message);
        // Can't run properly without valid pass
        return;
    }
    const { data: sData, error: sErr } = await supabase.from('settings').select('*').limit(1);
    const { data: pData, error: pErr } = await supabase.from('profiles').select('*').limit(1);

    console.log("Settings keys:", sData?.[0] ? Object.keys(sData[0]) : "Empty or Array? " + JSON.stringify(sData));
    if (sErr) console.log("SErr", sErr);

    console.log("Profiles keys:", pData?.[0] ? Object.keys(pData[0]) : "Empty or Array? " + JSON.stringify(pData));
    if (pErr) console.log("pErr", pErr);
}
checkCols();
