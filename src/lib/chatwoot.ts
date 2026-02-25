import { supabase } from '@/api/supabaseClient';

export const CHATWOOT_API_URL = import.meta.env.VITE_CHATWOOT_API_URL?.replace(':3000', '') || 'http://84.247.143.180';
const CHATWOOT_ACCESS_TOKEN = import.meta.env.VITE_CHATWOOT_ACCESS_TOKEN || '';
const CHATWOOT_ACCOUNT_ID = import.meta.env.VITE_CHATWOOT_ACCOUNT_ID || '1';

export class ChatwootAPI {
    /**
     * Universal fetcher that proxies through Supabase to bypass CORS and Mixed Content issues
     */
    private async request(path: string, method: string = 'GET', body?: any) {
        const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
            body: {
                action: 'chatwoot_proxy',
                method,
                payload: {
                    apiUrl: CHATWOOT_API_URL,
                    token: CHATWOOT_ACCESS_TOKEN,
                    path,
                    body
                }
            }
        });

        if (error) {
            console.error('[Chatwoot Proxy Error]', error);
            throw error;
        }

        // Axios syntax compatibility
        return { data };
    }

    /**
     * Fetch a list of conversations for the account
     */
    async getConversations(status: 'open' | 'resolved' | 'all' = 'open', page: number = 1) {
        try {
            return await this.request(`/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations?status=${status}&page=${page}`, 'GET');
        } catch (error) {
            console.error('[Chatwoot API] Error fetching conversations:', error);
            throw error;
        }
    }

    /**
     * Fetch messages for a specific conversation
     */
    async getMessages(conversationId: number, before?: number) {
        try {
            const query = before ? `?before=${before}` : '';
            return await this.request(`/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/messages${query}`, 'GET');
        } catch (error) {
            console.error(`[Chatwoot API] Error fetching messages for conversation ${conversationId}:`, error);
            throw error;
        }
    }

    /**
     * Fetch all historical messages (up to 100) via proxy
     */
    async getAllMessages(conversationId: number) {
        try {
            const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: {
                    action: 'chatwoot_all_messages',
                    payload: { conversationId, pages: 5 }
                }
            });
            if (error) throw error;
            return { data };
        } catch (error) {
            console.error(`[Chatwoot API] Error fetching all messages:`, error);
            return this.getMessages(conversationId);
        }
    }

    /**
     * Send a text message to a conversation
     */
    async sendMessage(conversationId: number, content: string, privateMessage: boolean = false) {
        try {
            return await this.request(`/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/messages`, 'POST', {
                content: content,
                private: privateMessage
            });
        } catch (error) {
            console.error(`[Chatwoot API] Error sending message to conversation ${conversationId}:`, error);
            throw error;
        }
    }

    async sendAttachment(conversationId: number, file: File, caption?: string) {
        try {
            // Read file as Base64
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const res = reader.result as string;
                    resolve(res.split(',')[1]); // Remove data:xxx;base64,
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: {
                    action: 'chatwoot_upload',
                    payload: {
                        apiUrl: CHATWOOT_API_URL,
                        token: CHATWOOT_ACCESS_TOKEN,
                        path: `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/messages`,
                        fileBase64: base64,
                        fileName: file.name,
                        fileType: file.type,
                        content: caption || ''
                    }
                }
            });

            if (error) throw error;
            return { data };
        } catch (error) {
            console.error(`[Chatwoot API] Error sending attachment to conversation ${conversationId}:`, error);
            throw error;
        }
    }

    /**
     * Change conversation status (open, resolved, snoozed)
     */
    async toggleStatus(conversationId: number, status: string = 'resolved') {
        try {
            return await this.request(`/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/toggle_status`, 'POST', {
                status
            });
        } catch (error) {
            console.error(`[Chatwoot API] Error toggling status:`, error);
            throw error;
        }
    }

    /**
     * Delete a conversation
     */
    async deleteConversation(conversationId: number) {
        try {
            return await this.request(`/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}`, 'DELETE');
        } catch (error) {
            console.error(`[Chatwoot API] Error deleting conversation:`, error);
            throw error;
        }
    }

    /**
     * Mark a conversation as read
     */
    async markAsRead(conversationId: number) {
        try {
            return await this.request(`/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/assignments`, 'POST', {});
        } catch (error) {
            console.warn(`[Chatwoot API] Failed to mark read:`, error);
        }
    }

    /**
     * Search contacts by identifier (phone or LID)
     */
    async searchContacts(query: string) {
        try {
            const res = await this.request(
                `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/contacts/search?q=${encodeURIComponent(query)}&include_contacts=true`,
                'GET'
            );
            return res?.data;
        } catch (error) {
            console.error('[Chatwoot API] Error searching contacts:', error);
            return null;
        }
    }

    /**
     * Get all contacts (paginated)
     */
    async getContacts(page: number = 1) {
        try {
            const res = await this.request(
                `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/contacts?page=${page}`,
                'GET'
            );
            return res?.data;
        } catch (error) {
            console.error('[Chatwoot API] Error fetching contacts:', error);
            return null;
        }
    }

    /**
     * Get a single contact by id
     */
    async getContact(contactId: number) {
        try {
            const res = await this.request(
                `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/contacts/${contactId}`,
                'GET'
            );
            return res?.data;
        } catch (error) {
            console.error(`[Chatwoot API] Error fetching contact ${contactId}:`, error);
            return null;
        }
    }

    /**
     * Update a contact (e.g., set phone_number from LID identifier)
     */
    async updateContact(contactId: number, payload: { name?: string; phone_number?: string; identifier?: string }) {
        try {
            const res = await this.request(
                `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/contacts/${contactId}`,
                'PATCH',
                payload
            );
            return res?.data;
        } catch (error) {
            console.error(`[Chatwoot API] Error updating contact ${contactId}:`, error);
            return null;
        }
    }

    /**
     * Merge two contacts: child_id is merged INTO base_id (base keeps, child deleted)
     */
    async mergeContacts(baseContactId: number, childContactId: number) {
        try {
            // Chatwoot v3+ merge endpoint
            const res = await this.request(
                `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/contacts/${baseContactId}/merge`,
                'POST',
                { child_id: childContactId }
            );
            console.log(`[Chatwoot] Merged contact ${childContactId} → ${baseContactId}`);
            return res?.data;
        } catch (error) {
            console.error(`[Chatwoot API] Error merging contacts ${childContactId} → ${baseContactId}:`, error);
            return null;
        }
    }

    /**
     * Get conversations for a specific contact
     */
    async getContactConversations(contactId: number) {
        try {
            const res = await this.request(
                `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/contacts/${contactId}/conversations`,
                'GET'
            );
            return res?.data;
        } catch (error) {
            console.error(`[Chatwoot API] Error fetching conversations for contact ${contactId}:`, error);
            return null;
        }
    }
}

export const chatwootApi = new ChatwootAPI();
