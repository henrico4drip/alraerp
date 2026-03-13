import pkg from 'pg';
const { Pool } = pkg;
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    connectionString: process.env.VITE_SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
});

const CHATWOOT_URL = process.env.VITE_CHATWOOT_API_URL;
const CHATWOOT_TOKEN = process.env.VITE_CHATWOOT_ACCESS_TOKEN;
const ACCOUNT_ID = '1'; // Default Chatwoot account ID

async function fixChatwootNames() {
    console.log('🚀 Iniciando atualização perfeita de nomes no Chatwoot...');

    try {
        // 1. Fetch all customers from ERP
        const { rows: customers } = await pool.query('SELECT phone, name FROM customers WHERE name IS NOT NULL');
        const customerMap = new Map();
        for (const c of customers) {
            if (c.phone) customerMap.set(c.phone.replace(/\D/g, ''), c.name);
        }
        console.log(`✅ Carregados ${customerMap.size} clientes do ERP (Supabase).`);

        // 2. Fetch all Chatwoot Contacts
        let page = 1;
        let totalUpdated = 0;
        let hasMore = true;

        while (hasMore) {
            const res = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts?page=${page}`, {
                headers: { 'api_access_token': CHATWOOT_TOKEN }
            });
            const data = await res.json();
            const contacts = data.payload || [];

            if (contacts.length === 0) {
                hasMore = false;
                break;
            }

            console.log(`📦 Processando página ${page} do Chatwoot (${contacts.length} contatos)`);

            for (const cw of contacts) {
                let phone = cw.phone_number ? cw.phone_number.replace(/\D/g, '') : '';
                if (!phone && cw.identifier) {
                    phone = cw.identifier.split('@')[0].replace(/\D/g, '');
                }

                if (!phone) continue;

                const isDisguisedLID = phone.startsWith('2406') || phone.length >= 14 || cw.identifier?.includes('@lid');

                let targetPhone = phone;
                // Basic merge capability if they have a real number instead of LID
                if (isDisguisedLID) {
                    targetPhone = cw.name.replace(/\D/g, ''); // Often native Evo puts phone in name if disguised
                    if (targetPhone.length < 10) targetPhone = phone; // Fallback
                }

                // Generate Variants
                const variants = [targetPhone];
                if (targetPhone.startsWith('55') && targetPhone.length === 13 && targetPhone[4] === '9') {
                    variants.push(targetPhone.substring(0, 4) + targetPhone.substring(5)); // Remove 9
                } else if (targetPhone.startsWith('55') && targetPhone.length === 12) {
                    variants.push(targetPhone.substring(0, 4) + '9' + targetPhone.substring(4)); // Add 9
                }
                // Try without 55
                if (targetPhone.startsWith('55')) {
                    variants.push(targetPhone.substring(2));
                }

                // Find perfect name
                let perfectName = null;
                for (const v of variants) {
                    if (customerMap.has(v)) {
                        perfectName = customerMap.get(v);
                        break;
                    }
                }

                const isCurrentNameGeneric = !cw.name || cw.name.includes(phone) || /^\d+$/.test(cw.name);

                if (perfectName && cw.name !== perfectName) {
                    // Update in Chatwoot
                    await fetch(`${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts/${cw.id}`, {
                        method: 'PUT',
                        headers: { 'api_access_token': CHATWOOT_TOKEN, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: perfectName })
                    });
                    console.log(`   ✏️ Corrigido: ${cw.name} -> ${perfectName}`);
                    totalUpdated++;
                } else if (isCurrentNameGeneric && !perfectName && !isDisguisedLID) {
                    // No ERP name, but generic. Just keep it or format phone nicely?
                    // E.g. (11) 99999-9999
                }
            }
            page++;
        }

        console.log(`\n🎉 Sincronização concluída! ${totalUpdated} nomes corrigidos no Chatwoot para ficarem idênticos ao CRM.`);
    } catch (e) {
        console.error('❌ Erro durante o processo:', e);
    } finally {
        pool.end();
    }
}

fixChatwootNames();
