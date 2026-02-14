require('dotenv').config({ path: '../.env' });
const { Client } = require('pg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- CONFIG ---
const EVOLUTION_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;
const CHATWOOT_URL = process.env.FRONTEND_URL; // http://84.247.143.180:3000
const CHATWOOT_TOKEN = process.env.CHATWOOT_ADMIN_TOKEN || 'pgh3rRR6ZLirSnzdnuQZbhNV';

const MAPPING_FILE = path.join(__dirname, 'mappings.json');
const syncTool = require('./index.js'); // We'll modify index.js to export its main function

async function run() {
    const instanceName = process.argv[2];
    if (!instanceName) {
        console.error('Usage: node autosync.js <instanceName>');
        process.exit(1);
    }

    console.log(`>>> AutoSync started for ${instanceName}`);

    let mappings = {};
    if (fs.existsSync(MAPPING_FILE)) {
        mappings = JSON.parse(fs.readFileSync(MAPPING_FILE));
    }

    let config = mappings[instanceName];

    if (!config) {
        console.log(`>>> Mapping not found for ${instanceName}. Attempting auto-creation in Chatwoot...`);
        config = await createChatwootInbox(instanceName);
        if (config) {
            mappings[instanceName] = config;
            fs.writeFileSync(MAPPING_FILE, JSON.stringify(mappings, null, 2));
            console.log(`>>> Mapping saved:`, config);
        } else {
            console.error(`>>> Failed to create/find inbox for ${instanceName}`);
            process.exit(1);
        }
    }

    // Now run the sync
    console.log(`>>> Starting sync for ${instanceName} -> Account ${config.accountId}, Inbox ${config.inboxId}`);

    // We override process.env temporarily or pass to the function
    process.env.ACCOUNT_ID = config.accountId;
    process.env.INBOX_ID = config.inboxId;
    process.env.INSTANCE_NAME = instanceName;

    try {
        await syncTool.runSync(instanceName, config.accountId, config.inboxId);
        console.log(`✅ AutoSync COMPLETED for ${instanceName}`);
    } catch (err) {
        console.error(`❌ AutoSync FAILED for ${instanceName}:`, err.message);
    }
}

async function createChatwootInbox(instanceName) {
    // 1. Get Account ID (default to first one)
    const accountId = 1; // Usually 1 for first account

    try {
        console.log(`>>> Creating API Inbox for ${instanceName}...`);
        const res = await axios.post(`${CHATWOOT_URL}/api/v1/accounts/${accountId}/inboxes`, {
            name: `WA: ${instanceName}`,
            channel: {
                type: "api"
            }
        }, { headers: { 'api_access_token': CHATWOOT_TOKEN } });

        return {
            accountId: accountId,
            inboxId: res.data.id,
            channelId: res.data.channel_id
        };
    } catch (err) {
        console.error('Error creating inbox:', err.response?.data || err.message);
        // Try to find if it already exists by name
        try {
            const list = await axios.get(`${CHATWOOT_URL}/api/v1/accounts/${accountId}/inboxes`, {
                headers: { 'api_access_token': CHATWOOT_TOKEN }
            });
            const existing = list.data.find(i => i.name === `WA: ${instanceName}`);
            if (existing) {
                console.log(`>>> Found existing inbox: ${existing.id}`);
                return { accountId, inboxId: existing.id };
            }
        } catch (e) { }
        return null;
    }
}

if (require.main === module) {
    run();
}
