import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const CHATWOOT_URL = 'http://84.247.143.180';
const TOKEN = 'pgh3rRR6ZLirSnzdnuQZbhNV';
const ACCOUNT_ID = '1';

async function cleanup() {
    console.log('🚀 Starting Chatwoot Cleanup...');

    try {
        // 1. Get all conversations
        console.log('Fetching conversations...');
        const convsRes = await axios.get(`${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/conversations`, {
            headers: { 'api_access_token': TOKEN }
        });

        const convs = convsRes.data.payload || [];
        console.log(`Found ${convs.length} conversations to delete.`);

        // Delete conversations (Note: Chatwoot doesn't have a bulk delete, we do it one by one or delete the contact)
        // Usually deleting the contact deletes the conversations.

        // 2. Get all contacts
        console.log('Fetching contacts...');
        const contactsRes = await axios.get(`${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts`, {
            headers: { 'api_access_token': TOKEN }
        });

        const contacts = contactsRes.data.payload || [];
        console.log(`Found ${contacts.length} contacts to delete.`);

        for (const contact of contacts) {
            try {
                await axios.delete(`${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/contacts/${contact.id}`, {
                    headers: { 'api_access_token': TOKEN }
                });
                console.log(`Deleted contact ${contact.id} (${contact.name})`);
            } catch (e) {
                console.error(`Failed to delete contact ${contact.id}`);
            }
        }

        console.log('✅ Cleanup finished. Chatwoot is now empty.');
    } catch (error) {
        console.error('Cleanup failed:', error.message);
    }
}

cleanup();
