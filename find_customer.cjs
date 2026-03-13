require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone, email, cpf, phone_normalized, user_id')
        .or('phone_normalized.eq.51980610665,cpf.eq.06535819043');

    console.log('Error:', error);
    console.log('Data:', data);
}

main();
