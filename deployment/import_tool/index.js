require('dotenv').config({ path: '../.env' });
const { Client } = require('pg');
const axios = require('axios');

// --- CONFIG ---
const EVOLUTION_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;

const dbConfig = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE || 'chatwoot_production',
    user: process.env.POSTGRES_USERNAME || 'chatwoot',
    password: process.env.POSTGRES_PASSWORD
};

async function runSync(instanceName, accountId, inboxId) {
    console.log(`>>> Starting Sync: ${instanceName} -> Account ${accountId}, Inbox ${inboxId}`);

    // Convert to numbers
    accountId = parseInt(accountId);
    inboxId = parseInt(inboxId);

    const client = new Client(dbConfig);
    try {
        await client.connect();
    } catch (err) {
        console.error('❌ DB Connection Failed:', err.message);
        throw err;
    }

    try {
        console.log('>>> Fetching Chats from Evolution...');
        const chats = await fetchChats(instanceName);
        console.log(`>>> Found ${chats.length} chats.`);

        for (const chat of chats) {
            await processChat(client, instanceName, chat, accountId, inboxId);
        }
    } finally {
        await client.end();
    }
}

async function fetchChats(instance) {
    const url = `${EVOLUTION_URL}/chat/findChats/${instance}`;
    const res = await axios.post(url, {}, { headers: { 'apikey': EVOLUTION_KEY } });
    return res.data;
}

async function fetchMessages(instance, remoteJid) {
    const url = `${EVOLUTION_URL}/chat/findMessages/${instance}`;
    const payload = {
        where: { key: { remoteJid: remoteJid } },
        options: { limit: 100 }
    };
    const res = await axios.post(url, payload, { headers: { 'apikey': EVOLUTION_KEY } });
    return res.data.messages || [];
}

async function processChat(client, instance, chat, accountId, inboxId) {
    const rawId = chat.id || chat.remoteJid;
    if (!rawId) return;

    const onlyNumbers = rawId.replace(/\D/g, '');
    const remoteJid = `${onlyNumbers}@s.whatsapp.net`;
    const pushName = chat.pushName || chat.name || chat.verifiedName || onlyNumbers || 'WhatsApp Contact';
    const phone = '+' + onlyNumbers;

    // 1. Find or Create Contact
    let contactId = await findContact(client, phone, remoteJid, accountId);
    if (!contactId) {
        contactId = await createContact(client, phone, pushName, remoteJid, accountId, inboxId);
    }

    // 2. Find or Create Conversation
    let conversationId = await findConversation(client, contactId, inboxId);
    if (!conversationId) {
        conversationId = await createConversation(client, contactId, accountId, inboxId);
    }

    // 3. Import Messages
    const messages = await fetchMessages(instance, rawId);

    let imported = 0;
    for (const msg of messages) {
        const success = await insertMessage(client, conversationId, contactId, msg, accountId, inboxId);
        if (success) imported++;
    }
    if (imported > 0) console.log(`   ✅ Imported ${imported} messages for ${pushName}.`);
}

async function findContact(client, phone, identifier, accountId) {
    const q = `SELECT id FROM contacts WHERE (phone_number = $1 OR identifier = $2) AND account_id = $3 LIMIT 1`;
    const res = await client.query(q, [phone, identifier, accountId]);
    return res.rows[0]?.id;
}

async function createContact(client, phone, name, identifier, accountId, inboxId) {
    const q = `
        INSERT INTO contacts (name, phone_number, identifier, account_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING id
    `;
    const res = await client.query(q, [name, phone, identifier, accountId]);
    const cid = res.rows[0].id;

    await client.query(`
        INSERT INTO inbox_members (inbox_id, contact_id, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW()) ON CONFLICT DO NOTHING
    `, [inboxId, cid]);

    return cid;
}

async function findConversation(client, contactId, inboxId) {
    const q = `SELECT id FROM conversations WHERE contact_id = $1 AND inbox_id = $2 LIMIT 1`;
    const res = await client.query(q, [contactId, inboxId]);
    return res.rows[0]?.id;
}

async function createConversation(client, contactId, accountId, inboxId) {
    const q = `
        INSERT INTO conversations (account_id, inbox_id, contact_id, status, created_at, updated_at)
        VALUES ($1, $2, $3, 'resolved', NOW(), NOW())
        RETURNING id
    `;
    const res = await client.query(q, [accountId, inboxId, contactId]);
    return res.rows[0].id;
}

async function insertMessage(client, conversationId, contactId, msg, accountId, inboxId) {
    const isFromMe = msg.key.fromMe;

    // Comprehensive content extraction
    let content = '[Tipo de mensagem não suportado]';
    const m = msg.message;
    if (m) {
        if (m.conversation) content = m.conversation;
        else if (m.extendedTextMessage?.text) content = m.extendedTextMessage.text;
        else if (m.imageMessage) content = '[Imagem]';
        else if (m.videoMessage) content = '[Vídeo]';
        else if (m.audioMessage) content = '[Áudio]';
        else if (m.documentMessage) content = '[Documento]';
        else if (m.stickerMessage) content = '[Figurinha]';
        else if (m.contactMessage) content = '[Contato]';
        else if (m.locationMessage) content = '[Localização]';
        else if (m.viewOnceMessageV2?.message?.imageMessage) content = '[Imagem (Visualização Única)]';
        else if (m.viewOnceMessageV2?.message?.videoMessage) content = '[Vídeo (Visualização Única)]';
    }

    const timestamp = new Date((msg.messageTimestamp?.low || msg.messageTimestamp || Math.floor(Date.now() / 1000)) * 1000);

    const msgType = isFromMe ? 1 : 0; // 1 = outgoing, 0 = incoming
    const senderType = isFromMe ? 'User' : 'Contact';
    const senderId = isFromMe ? 1 : contactId; // Hardcoded user 1 as sender for now

    try {
        const q = `
            INSERT INTO messages (
                content, account_id, inbox_id, conversation_id, message_type,
                sender_type, sender_id, created_at, updated_at, 
                private, status, source_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, false, 'read', $9)
            ON CONFLICT (source_id) DO NOTHING
            RETURNING id
        `;
        const res = await client.query(q, [
            content, accountId, inboxId, conversationId, msgType,
            senderType, senderId, timestamp, msg.key.id
        ]);
        return !!res.rowCount;
    } catch (err) {
        // Parallel inserts might cause unique constraint if not handled by ON CONFLICT
        return false;
    }
}

// CLI usage
if (require.main === module) {
    const instanceName = process.argv[2] || process.env.INSTANCE_NAME;
    const accountId = process.env.ACCOUNT_ID || 2;
    const inboxId = process.env.INBOX_ID || 2;
    if (instanceName) {
        runSync(instanceName, accountId, inboxId).catch(console.error);
    }
}

module.exports = { runSync };
