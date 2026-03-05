import axios, { AxiosInstance } from "axios";

export interface EvolutionInstance {
    instanceName: string;
    instanceId?: string;
    status: string;
    owner?: string;
}

export interface EvolutionMessage {
    remoteJidAlt?: string; // Add support for JID aliases (LID vs Number)
    senderPn?: string;     // Evolution v2.3+ field for Phone Number
    fromMe?: boolean;
    participant?: string; // Standard participant field
    user?: string;         // Sometimes used in metadata
    key: {
        remoteJid: string;
        fromMe: boolean;
        id: string;
        participant?: string; // Key participant
        remoteJidAlt?: string; // Sometimes appearing here
    };
    message?: {
        conversation?: string;
        extendedTextMessage?: { text: string };
        imageMessage?: { url?: string; caption?: string; mimetype?: string };
        videoMessage?: { url?: string; caption?: string; mimetype?: string };
        audioMessage?: { url?: string; mimetype?: string };
        documentMessage?: { url?: string; fileName?: string; mimetype?: string };
        stickerMessage?: { url?: string };
    };
    messageTimestamp?: number | string;
    pushName?: string;
    status?: string;
}

export interface EvolutionContact {
    id: string;
    name?: string;
    pushName?: string;
    profileName?: string;
    pushname?: string;
    profilePictureUrl?: string;
    profilePicUrl?: string;
}

export class EvolutionAPI {
    private client: AxiosInstance;
    private instanceName: string;
    private supabase: any;
    public readonly version: string = "2.4.0-clean";

    constructor(apiUrl: string, apiKey: string, instanceName: string = "default", supabase?: any) {
        this.instanceName = instanceName;
        this.supabase = supabase;
        this.client = axios.create({
            baseURL: apiUrl.replace(/\/$/, ""),
            headers: {
                "apikey": apiKey,
                "Content-Type": "application/json",
            },
            timeout: 30000,
        });

        // Request Interceptor for Debugging
        this.client.interceptors.request.use(config => {
            console.log(`[EvolutionAPI] Request: ${config.method?.toUpperCase()} ${config.url}`);
            return config;
        });

        // Response Interceptor for Debugging
        this.client.interceptors.response.use(
            response => {
                console.log(`[EvolutionAPI] Response: ${response.status} from ${response.config.url}`);
                return response;
            },
            error => {
                console.error(`[EvolutionAPI] Error: ${error.response?.status || 'Network Error'} from ${error.config?.url}`);
                if (error.response?.data) console.error(`[EvolutionAPI] Detail:`, error.response.data);
                return Promise.reject(error);
            }
        );
    }

    private async proxyInvoke(action: string, payload?: any, retryCount = 0): Promise<any> {
        if (!this.supabase) throw new Error("Supabase client not provided for proxy mode");

        // Chamar Edge Function diretamente via HTTP
        const supabaseUrl = (this.supabase as any).supabaseUrl || 'https://greotjobqprtmrprptdb.supabase.co';
        const functionUrl = `${supabaseUrl}/functions/v1/whatsapp-proxy`;

        console.log(`[EvolutionAPI] Calling Edge Function: ${functionUrl}, action: ${action}`);

        // Obter sessão atual
        const { data: { session } } = await this.supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) {
            console.error('[EvolutionAPI] No active session token available');
            throw new Error('Sessão expirada. Por favor, faça login novamente.');
        }

        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ action, payload })
        });

        // Handle 401/403 - tentar refresh token uma vez
        if ((response.status === 401 || response.status === 403) && retryCount < 1) {
            console.log('[EvolutionAPI] Token expired, attempting refresh...');
            const { data: refreshData, error: refreshError } = await this.supabase.auth.refreshSession();

            if (refreshError || !refreshData.session) {
                console.error('[EvolutionAPI] Failed to refresh session:', refreshError);
                throw new Error('Sessão expirada. Por favor, faça login novamente.');
            }

            // Retry com novo token
            console.log('[EvolutionAPI] Session refreshed, retrying request...');
            return this.proxyInvoke(action, payload, retryCount + 1);
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[EvolutionAPI] Edge Function error: ${response.status}`, errorText);

            // Try to parse error message
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error) {
                    throw new Error(errorJson.error);
                }
            } catch { /* not JSON */ }

            throw new Error(`Edge Function error: ${response.status}`);
        }

        const data = await response.json();
        console.log(`[EvolutionAPI] Edge Function response:`, data);
        return data;
    }

    // Instance Management
    async createInstance(instanceName: string): Promise<any> {
        if (this.supabase) return this.proxyInvoke('connect');

        const response = await this.client.post("/instance/create", {
            instanceName,
            qrcode: true, // v2.3.0 handles QR generation correctly
            integration: "WHATSAPP-BAILEYS",
        });
        return response.data;
    }

    async getInstanceStatus(): Promise<any> {
        if (this.supabase) return this.proxyInvoke('get_status');

        try {
            // Try connectionState first (v1.6+)
            const response = await this.client.get(`/instance/connectionState/${this.instanceName}`);
            return response.data;
        } catch (error: any) {
            // Fallback for older v1.x or variations
            if (error.response?.status === 404) {
                try {
                    const fallback = await this.client.get(`/instance/displayState/${this.instanceName}`);
                    return fallback.data;
                } catch {
                    throw error;
                }
            }
            throw error;
        }
    }

    async checkInstanceExists(name?: string): Promise<boolean> {
        const targetName = name || this.instanceName;
        if (this.supabase) {
            const res = await this.proxyInvoke('check_instance_exists', { instanceName: targetName });
            return res?.exists === true;
        }
        try {
            const res = await this.client.get(`/instance/connectionState/${targetName}`);
            return res.status === 200 || res.status === 400; // if it returns status, it exists
        } catch (e: any) {
            return false;
        }
    }

    async getQRCode(): Promise<any> {
        if (this.supabase) return this.proxyInvoke('connect');

        try {
            const response = await this.client.get(`/instance/connect/${this.instanceName}`);
            let data = response.data;

            // Handle cases where data is nested or direct
            if (data?.qrcode) return data.qrcode;
            if (data?.instance?.qrcode) return data.instance.qrcode;
            if (typeof data === 'string') return { code: data };

            return data;
        } catch (error: any) {
            if (error.response?.data) return error.response.data;
            throw error;
        }
    }

    async listInstances(): Promise<any[]> {
        try {
            const response = await this.client.get("/instance/fetchInstances");
            const data = response.data;

            if (Array.isArray(data)) return data;
            if (Array.isArray(data?.instances)) return data.instances;
            if (data?.data && Array.isArray(data.data)) return data.data;

            return [];
        } catch {
            return [];
        }
    }

    async deleteInstance(): Promise<any> {
        if (this.supabase) return this.proxyInvoke('delete_instance');
        const response = await this.client.delete(`/instance/delete/${this.instanceName}`);
        return response.data;
    }

    async logoutInstance(): Promise<any> {
        if (this.supabase) return this.proxyInvoke('logout');
        const response = await this.client.delete(`/instance/logout/${this.instanceName}`);
        return response.data;
    }

    async restartInstance(): Promise<any> {
        const response = await this.client.put(`/instance/restart/${this.instanceName}`);
        return response.data;
    }

    async findContact(jid: string): Promise<any> {
        return this.fetchContactInfo(jid);
    }

    async syncContacts(): Promise<any> {
        try {
            const response = await this.client.post(`/contact/sync/${this.instanceName}`);
            return response.data;
        } catch (e) {
            return null;
        }
    }

    async resyncContact(jid: string): Promise<boolean> {
        try {
            // HACK V2: Fetching the profile picture forces the server to look up the user's public record,
            // which often populates the internal LID->Phone mapping cache.
            await this.client.post(`/chat/fetchProfilePictureUrl/${this.instanceName}`, {
                number: jid
            });
            return true;
        } catch (e) {
            // It's expected to fail if the user has no photo, but the side-effect (resolution) might still happen
            return false;
        }
    }

    // Messages
    async sendTextMessage(remoteJid: string, text: string, quoted?: any): Promise<any> {
        if (this.supabase) {
            return this.proxyInvoke('send_message', {
                jid: remoteJid,
                message: text,
                phone: remoteJid.split('@')[0]
            });
        }

        // GLOBAL LID RESOLUTION: Check if we have a mapping for this LID in local storage
        let finalJid = remoteJid;
        if (remoteJid.includes('@lid')) {
            const savedMap = JSON.parse(localStorage.getItem('lid_mappings') || '{}');
            if (savedMap[remoteJid]) {
                console.log(`[EvolutionAPI] Using saved mapping for LID: ${remoteJid} -> ${savedMap[remoteJid]}`);
                finalJid = savedMap[remoteJid];
            }
        }

        const isLid = finalJid.includes('@lid');
        const isGroup = finalJid.includes('@g.us');

        // Most Evolution APIs accept the full JID in the 'number' field 
        // IF it's not a standard phone number.
        const target = (isLid || isGroup) ? finalJid : finalJid.split('@')[0];

        const payload: any = {
            number: target,
            text: text,
            checkContact: false,  // Bypass flag 1 (camelCase)
            check_contact: false, // Bypass flag 2 (snake_case)
            forceSend: true,      // Bypass flag 3
            linkPreview: false,   // Bypass flag 4 (disabling preview helps skip checks)
            textMessage: {
                text: text
            },
            options: {
                delay: isLid ? 1200 : 0,
                presence: "composing",
                linkPreview: false,
                quoted: quoted ? { key: quoted.key, message: quoted.message } : undefined
            }
        };

        console.log(`[EvolutionAPI] Sending text to ${target} (Instance: ${this.instanceName})`);

        try {
            const response = await this.client.post(`/message/sendText/${this.instanceName}`, payload);
            return response.data;
        } catch (error: any) {
            if (error.response?.data) {
                console.error(`[EvolutionAPI] DETALHE DO ERRO ${error.response.status}:`, JSON.stringify(error.response.data));
            }

            // FALLBACK 1: Simplified Payload & Smart JID Discovery
            if (isLid && (error.response?.status === 400 || error.response?.status === 404)) {
                console.warn(`[EvolutionAPI] LID send failed (${error.response.status}), activating 'Pulo do Gato' (Smart JID Discovery)...`);

                // STRATEGY A: Check API Contact/Profile (Standard)
                try {
                    // 1. Force a "refresh" of this JID in the server cache
                    await this.resyncContact(remoteJid);

                    // 2. Try to find via standard findContact
                    const contactInfo = await this.findContact(remoteJid);
                    const resolvedJid = contactInfo?.id || contactInfo?.remoteJid || (Array.isArray(contactInfo) ? contactInfo[0]?.id : null);

                    if (resolvedJid && resolvedJid.includes('@s.whatsapp.net') && resolvedJid !== remoteJid) {
                        console.log(`[EvolutionAPI] Smart Resolution (API) found Phone JID: ${resolvedJid}. Retrying send...`);
                        return this.sendTextMessage(resolvedJid, text, quoted);
                    }
                } catch (resolveErr) {
                    console.warn("Smart resolution (API) failed", resolveErr);
                }

                // STRATEGY B: 'O Pulo do Gato' - Scan Message History for Hidden JID
                // This is the user's specific request: "look at the JSON... participant... user"
                try {
                    console.log(`[EvolutionAPI] Searching message history for real JID...`);
                    const recentMessages = await this.fetchMessages(remoteJid, 10);

                    for (const msg of recentMessages) {
                        // Check all possible hiding spots for the real number
                        const candidate =
                            msg.remoteJidAlt || // Evolution v2.3+
                            msg.senderPn ||     // Evolution v2.3+
                            msg.participant ||
                            msg.key?.participant ||
                            msg.user ||
                            (msg.key?.remoteJid && msg.key.remoteJid.includes('@s.whatsapp.net') ? msg.key.remoteJid : null);

                        if (candidate && candidate.includes('@s.whatsapp.net')) {
                            console.log(`[EvolutionAPI] 'Pulo do Gato' found real JID in history (${candidate}). Retrying send...`);
                            // Recursively try sending to the discovered real number
                            return this.sendTextMessage(candidate, text, quoted);
                        }
                    }
                } catch (historyErr) {
                    console.warn("'Pulo do Gato' history scan failed", historyErr);
                }

                // FALLBACK 2: Brute force with simplified payload (Last Resort)
                try {
                    console.log(`[EvolutionAPI] Trying brute force send to LID...`);
                    const fallbackResponse = await this.client.post(`/message/sendText/${this.instanceName}`, {
                        number: remoteJid,
                        text: text,
                        textMessage: {
                            text: text
                        },
                        checkContact: false,
                        check_contact: false,
                        forceSend: true,
                        linkPreview: false
                    });
                    return fallbackResponse.data;
                } catch (fError: any) {
                    // FALLBACK 3: QUOTED MESSAGE STRATEGY
                    if (quoted) {
                        console.log(`[EvolutionAPI] Trying QUOTED fallback for LID...`);
                        try {
                            const quoteResponse = await this.client.post(`/message/sendText/${this.instanceName}`, {
                                number: remoteJid,
                                text: text,
                                textMessage: {
                                    text: text
                                },
                                checkContact: false,
                                forceSend: true,
                                quoted: { key: quoted.key, message: quoted.message }
                            });
                            return quoteResponse.data;
                        } catch (qErr) {
                            console.warn("Quoted fallback failed", qErr);
                        }
                    }

                    if (fError.response?.data) {
                        console.error(`[EvolutionAPI] DETALHE DO ERRO FALLBACK:`, JSON.stringify(fError.response.data));
                    }
                    throw fError;
                }
            }
            console.error(`[EvolutionAPI] Error sending text to ${target}:`, error.response?.data || error.message);
            throw error;
        }
    }

    async sendMediaMessage(
        remoteJid: string,
        mediaType: "image" | "video" | "audio" | "document",
        mediaUrl: string,
        caption?: string,
        fileName?: string
    ): Promise<any> {
        // GLOBAL LID RESOLUTION
        let finalJid = remoteJid;
        if (remoteJid.includes('@lid')) {
            const savedMap = JSON.parse(localStorage.getItem('lid_mappings') || '{}');
            if (savedMap[remoteJid]) {
                finalJid = savedMap[remoteJid];
            }
        }

        const target = (finalJid.includes('@lid') || finalJid.includes('@g.us'))
            ? finalJid
            : finalJid.split('@')[0];

        const endpoint = `/message/sendMedia/${this.instanceName}`;
        console.log(`[EvolutionAPI] Sending media to ${target} using instance ${this.instanceName}`);

        try {
            const response = await this.client.post(endpoint, {
                number: target,
                checkContact: false,
                forceSend: true,
                options: {
                    delay: 0,
                    presence: "composing"
                },
                mediaMessage: {
                    mediatype: mediaType,
                    media: mediaUrl,
                    caption,
                    fileName,
                }
            });
            return response.data;
        } catch (error: any) {
            if (error.response?.data) {
                console.error(`[EvolutionAPI] DETALHE DO ERRO MEDIA ${error.response.status}:`, JSON.stringify(error.response.data));
            }

            // FALLBACK 1: Smart Resolution for Media
            const isLid = remoteJid.includes('@lid');
            if (isLid && (error.response?.status === 400 || error.response?.status === 404)) {
                console.warn(`[EvolutionAPI] LID media send failed (${error.response.status}), trying smart resolution...`);

                try {
                    await this.resyncContact(remoteJid);
                    const contactInfo = await this.findContact(remoteJid);
                    const resolvedJid = contactInfo?.id || contactInfo?.remoteJid || (Array.isArray(contactInfo) ? contactInfo[0]?.id : null);

                    if (resolvedJid && resolvedJid.includes('@s.whatsapp.net') && resolvedJid !== remoteJid) {
                        console.log(`[EvolutionAPI] Smart Resolution found Phone JID: ${resolvedJid}. Retrying media send...`);
                        return this.sendMediaMessage(resolvedJid, mediaType, mediaUrl, caption, fileName);
                    }
                } catch (resolveErr) {
                    console.warn("Smart resolution failed for media", resolveErr);
                }

                // FALLBACK 2: Brute force payload
                try {
                    const fallbackResponse = await this.client.post(endpoint, {
                        number: remoteJid,
                        checkContact: false,
                        check_contact: false,
                        forceSend: true,
                        linkPreview: false,
                        mediaMessage: {
                            mediatype: mediaType,
                            media: mediaUrl,
                            caption,
                            fileName,
                        }
                    });
                    return fallbackResponse.data;
                } catch (fError: any) {
                    if (fError.response?.data) {
                        console.error(`[EvolutionAPI] DETALHE DO ERRO FALLBACK MEDIA:`, JSON.stringify(fError.response.data));
                    }
                    throw fError;
                }
            }

            console.error(`[EvolutionAPI] Error sending media to ${target}:`, error.response?.data || error.message);
            throw error;
        }
    }

    // Sync messages from Evolution API directly into Supabase
    // This catches messages sent from the phone that webhooks may have missed
    async syncChatFromEvolution(phone: string, jid: string): Promise<void> {
        if (!this.supabase) return;
        try {
            console.log(`[EvolutionAPI] syncChatFromEvolution: Syncing ${phone} from Evolution API...`);
            const result = await this.proxyInvoke('sync_chat', { phone, jid });
            if (result?.saved > 0) {
                console.log(`[EvolutionAPI] syncChatFromEvolution: ✅ ${result.saved} novas mensagens salvas para ${phone}`);
            } else {
                console.log(`[EvolutionAPI] syncChatFromEvolution: Nenhuma mensagem nova para ${phone}`);
            }
        } catch (err: any) {
            console.warn(`[EvolutionAPI] syncChatFromEvolution error for ${phone}:`, err.message);
        }
    }

    // Background sync tracker to avoid duplicate sync calls
    private _syncingChats = new Set<string>();
    private _lastSyncTime: Record<string, number> = {};

    async fetchMessages(remoteJid: string, count: number = 50): Promise<EvolutionMessage[]> {
        if (this.supabase) {
            try {
                console.log(`[EvolutionAPI] fetchMessages: Buscando do Supabase para JID: ${remoteJid}...`);
                const phone = remoteJid.split('@')[0];

                // NORMALIZAÇÃO DO 9º DÍGITO (Brasil) e LIDs
                const variants: string[] = [];
                const addVariants = (p: string) => {
                    const cleanP = p.replace(/\D/g, '');
                    if (!variants.includes(cleanP)) variants.push(cleanP);
                    if (cleanP.startsWith('55') && cleanP.length === 13 && cleanP[4] === '9') {
                        const without9 = cleanP.substring(0, 4) + cleanP.substring(5);
                        if (!variants.includes(without9)) variants.push(without9);
                    } else if (cleanP.startsWith('55') && cleanP.length === 12) {
                        const with9 = cleanP.substring(0, 4) + '9' + cleanP.substring(4);
                        if (!variants.includes(with9)) variants.push(with9);
                    }
                };

                addVariants(phone);

                // Add LID mappings to variants so we fetch both LID and real phone messages
                try {
                    const map = JSON.parse(localStorage.getItem('lid_mappings') || '{}');
                    // Check if current phone is a LID mapped to a real number
                    if (map[`${phone}@lid`]) addVariants(map[`${phone}@lid`].split('@')[0]);
                    if (map[phone]) addVariants(map[phone].split('@')[0]);
                    // Check if current phone is a real number mapped from LIDs
                    Object.entries(map).forEach(([lid, mapped]) => {
                        const mappedPhone = String(mapped).split('@')[0].replace(/\D/g, '');
                        if (variants.includes(mappedPhone)) {
                            addVariants(lid.split('@')[0]);
                        }
                    });
                } catch (e) { }

                console.log(`[EvolutionAPI] Buscando variantes consolidadas (LID+Phone):`, variants);

                // SYNC HÍBRIDO: Buscar mensagens da Evolution API e salvar no Supabase
                // para pegar mensagens enviadas diretamente pelo celular que o webhook perdeu
                const now = Date.now();
                const lastSync = this._lastSyncTime[phone] || 0;
                const SYNC_INTERVAL = 30000; // Sincronizar no máximo a cada 30 segundos
                const isFirstSync = lastSync === 0; // Never synced this chat before

                if (!this._syncingChats.has(phone) && (now - lastSync) > SYNC_INTERVAL) {
                    this._syncingChats.add(phone);
                    this._lastSyncTime[phone] = now;

                    if (isFirstSync) {
                        // AWAIT on first sync so messages are available before we query
                        try {
                            await this.syncChatFromEvolution(phone, remoteJid);
                        } catch (err: any) {
                            console.warn('[EvolutionAPI] First sync error:', err.message);
                        } finally {
                            this._syncingChats.delete(phone);
                        }
                    } else {
                        // Fire-and-forget for subsequent syncs (UI already has data)
                        this.syncChatFromEvolution(phone, remoteJid).catch(err => {
                            console.warn('[EvolutionAPI] Background sync error:', err.message);
                        }).finally(() => {
                            this._syncingChats.delete(phone);
                        });
                    }
                }

                // Buscar mensagens do Supabase usando 'in' para pegar todas as variantes
                const { data: messages, error } = await this.supabase
                    .from('whatsapp_messages')
                    .select('*')
                    .in('contact_phone', variants)
                    .order('created_at', { ascending: false })
                    .limit(count);

                if (error) {
                    console.error('[EvolutionAPI] Supabase error:', error);
                    return [];
                }

                // DEDUPLICATION: Remover duplicatas por wa_message_id
                const uniqueMessages = new Map();
                messages?.forEach((msg: any) => {
                    const msgId = msg.wa_message_id || msg.id;
                    if (msgId && !uniqueMessages.has(msgId)) {
                        uniqueMessages.set(msgId, msg);
                    }
                });
                const dedupedMessages = Array.from(uniqueMessages.values());

                // Ordenar explicitamente: Mais antigas primeiro (ordem cronológica para o chat)
                const sortedMessages = dedupedMessages.sort((a: any, b: any) =>
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );

                // Converter formato do Supabase para formato Evolution
                const converted = sortedMessages.map((msg: any) => ({
                    key: {
                        remoteJid: remoteJid,
                        fromMe: msg.direction === 'outbound',
                        id: msg.wa_message_id || msg.id
                    },
                    message: {
                        conversation: msg.content
                    },
                    messageTimestamp: new Date(msg.created_at).getTime() / 1000,
                    pushName: msg.contact_name || phone
                }));

                console.log(`[EvolutionAPI] fetchMessages: ${converted.length} mensagens ordenadas cronologicamente`);
                return converted;
            } catch (e: any) {
                console.error("fetchMessages Supabase error:", e.message);
                return [];
            }
        }

        const fetchLimit = Math.min(Math.max(count * 3, 500), 5000);

        try {
            // v2.3.0 uses findMessages endpoint
            const response = await this.client.post(`/chat/findMessages/${this.instanceName}`, {
                where: {
                    key: {
                        remoteJid: remoteJid
                    }
                },
                limit: fetchLimit,
                offset: 0
            });

            let messages = [];
            const data = response.data;

            console.log('[EvolutionAPI] fetchMessages response type:', typeof data, 'isArray:', Array.isArray(data));
            if (data && !Array.isArray(data)) {
                console.log('[EvolutionAPI] fetchMessages response keys:', Object.keys(data));
            }

            if (Array.isArray(data)) {
                messages = data;
                console.log('[EvolutionAPI] ✓ fetchMessages using direct array, count:', messages.length);
            } else if (data && 'messages' in data) {
                if (Array.isArray(data.messages)) {
                    messages = data.messages;
                    console.log('[EvolutionAPI] ✓ fetchMessages using data.messages, count:', messages.length);
                } else if (data.messages && typeof data.messages === 'object') {
                    console.log('[EvolutionAPI] fetchMessages: messages is an object. Keys:', Object.keys(data.messages));

                    const messagesObj = data.messages;
                    if (Array.isArray(messagesObj.records)) {
                        messages = messagesObj.records;
                        console.log('[EvolutionAPI] ✓ fetchMessages using data.messages.records (paginated), count:', messages.length);
                    } else if (Array.isArray(messagesObj.data)) {
                        messages = messagesObj.data;
                        console.log('[EvolutionAPI] ✓ fetchMessages using data.messages.data, count:', messages.length);
                    } else if (Array.isArray(messagesObj.messages)) {
                        messages = messagesObj.messages;
                        console.log('[EvolutionAPI] ✓ fetchMessages using data.messages.messages, count:', messages.length);
                    } else if (Array.isArray(messagesObj.rows)) {
                        messages = messagesObj.rows;
                        console.log('[EvolutionAPI] ✓ fetchMessages using data.messages.rows, count:', messages.length);
                    } else {
                        const values = Object.values(messagesObj);
                        if (values.length > 0 && values.every((v: any) => v && typeof v === 'object' && ('key' in v || 'message' in v))) {
                            messages = values;
                            console.log('[EvolutionAPI] ✓ fetchMessages using Object.values(messages), count:', messages.length);
                        } else {
                            console.warn('[EvolutionAPI] fetchMessages: Could not extract array. Sample:', JSON.stringify(messagesObj).slice(0, 200));
                        }
                    }
                } else {
                    console.warn('[EvolutionAPI] fetchMessages "messages" key exists but is not an array or object:', typeof data.messages);
                }
            } else if (data && 'data' in data && Array.isArray(data.data)) {
                messages = data.data;
                console.log('[EvolutionAPI] ✓ fetchMessages using data.data, count:', messages.length);
            } else {
                console.warn('[EvolutionAPI] ⚠ fetchMessages unexpected format. Keys:', data ? Object.keys(data) : 'none');
            }

            // Manual filtering is MANDATORY because v1.7.4 often ignores the where clause
            let filtered = messages.filter((m: any) => {
                const msgJid = m.key?.remoteJid || m.remoteJid || "";
                return isSameJid(msgJid, remoteJid);
            });

            // DE-DUPLICATION: Remove duplicates by message ID (key.id)
            const uniqueMessages2 = new Map();
            filtered.forEach((m: any) => {
                const msgId = m.key?.id || m.id;
                if (msgId && !uniqueMessages2.has(msgId)) {
                    uniqueMessages2.set(msgId, m);
                }
            });

            const finalMessages = Array.from(uniqueMessages2.values());

            // Sort by timestamp descending (newest first)
            return finalMessages.sort((a: any, b: any) => {
                const tsA = Number(a.messageTimestamp || 0);
                const tsB = Number(b.messageTimestamp || 0);
                return tsB - tsA;
            }).slice(0, count);

        } catch (error: any) {
            console.error("Evolution API findMessages error:", error.response?.data || error.message);
            return [];
        }
    }

    // Contacts - Busca do Supabase diretamente
    async fetchContacts(): Promise<EvolutionContact[]> {
        if (this.supabase) {
            try {
                console.log('[EvolutionAPI] fetchContacts: Buscando do Supabase...');

                // Buscar clientes do Supabase
                const { data: customers, error } = await this.supabase
                    .from('customers')
                    .select('*');

                if (error) {
                    console.error('[EvolutionAPI] Supabase error:', error);
                    return [];
                }

                const processed = customers?.map((c: any) => ({
                    id: c.phone ? `${c.phone}@s.whatsapp.net` : c.id,
                    name: c.name || c.phone || 'Desconhecido',
                    pushName: c.name,
                    profilePictureUrl: null
                })).filter((c: any) => c.id) || [];

                console.log(`[EvolutionAPI] Processed ${processed.length} contacts from Supabase.`);
                return processed;
            } catch (e: any) {
                console.error("fetchContacts Supabase error:", e.message);
                return [];
            }
        }

        try {
            const response = await this.client.post(`/chat/findContacts/${this.instanceName}`, { where: {}, limit: 2000 });
            // v2.3.0 can return an object or an array
            const rawData = response.data;
            const contacts = Array.isArray(rawData) ? rawData : (rawData?.records || rawData?.data || (typeof rawData === 'object' ? Object.values(rawData) : []));

            const processed = contacts.map((c: any) => ({
                id: c.remoteJid || c.id || c.jid, // Use remoteJid as ID for matching in v2.3.0
                name: c.pushName || c.name || c.verifiedName,
                pushName: c.pushName,
                profilePictureUrl: c.profilePicUrl
            })).filter((c: any) => c.id);

            console.log(`[EvolutionAPI] Processed ${processed.length} agenda contacts from database.`);
            return processed;
        } catch (e: any) {
            console.error("fetchContacts error:", e.message);
            return [];
        }
    }

    async getProfilePicture(remoteJid: string): Promise<string | null> {
        try {
            const response = await this.client.post(`/chat/fetchProfilePictureUrl/${this.instanceName}`, {
                number: remoteJid,
            });
            return response.data?.profilePictureUrl || null;
        } catch (e: any) {
            return null;
        }
    }

    async fetchContactInfo(remoteId: string): Promise<any> {
        if (!remoteId) return null;
        try {
            // Use findChats with a specific ID filter as a reliable alternative to the failing contact route
            const response = await this.client.post(`/chat/findChats/${this.instanceName}`, {
                where: {
                    id: remoteId
                },
                limit: 1
            });

            const data = response.data;
            const records = Array.isArray(data) ? data : (data?.records || data?.chats || data?.data || []);

            if (records.length > 0) {
                const chatData = records[0];
                const jid = chatData.id || chatData.remoteJid || chatData.key?.remoteJid;

                // LEARN FROM CONTACT INFO: If this is an LID, try to find the mapped JID
                const lid = chatData.lid || chatData.remoteJidAlt;
                if (jid && lid && jid.includes('@s.whatsapp.net') && lid.includes('@lid')) {
                    const map = JSON.parse(localStorage.getItem('lid_mappings') || '{}');
                    map[lid] = jid;
                    localStorage.setItem('lid_mappings', JSON.stringify(map));
                }

                return {
                    id: jid,
                    pushName: chatData.pushName || chatData.name || chatData.contact?.pushName || chatData.contact?.name || null,
                    name: chatData.name || chatData.pushName || chatData.contact?.name || chatData.contact?.pushName || null,
                    picture: chatData.picture || chatData.profilePictureUrl || chatData.contact?.profilePictureUrl || null,
                    remoteJid: jid
                };
            }
            return null;
        } catch (e: any) {
            return null;
        }
    }

    async getBase64Media(message: any): Promise<{ base64: string } | null> {
        try {
            const response = await this.client.post(`/chat/getBase64FromMediaMessage/${this.instanceName}`, {
                message: message,
                convertToMp4: false
            });
            return response.data;
        } catch (error: any) {
            console.warn("Error getting base64 media:", error.message);
            return null;
        }
    }

    // Chats - Busca do Supabase diretamente (Evolution webhook já salva lá)
    async fetchChats(deepScan: boolean = false): Promise<any[]> {
        if (this.supabase) {
            try {
                console.log('[EvolutionAPI] fetchChats: Buscando dados unificados (Mensagens + Clientes)...');

                // 1. Buscar mensagens e clientes em paralelo
                const [msgRes, custRes] = await Promise.all([
                    this.supabase.from('whatsapp_messages').select('*').order('created_at', { ascending: false }),
                    this.supabase.from('customers').select('phone, name')
                ]);

                if (msgRes.error) throw msgRes.error;

                const messages = msgRes.data || [];
                const customers = custRes.data || [];

                // Mapa para busca rápida de nomes de clientes (Prioridade A)
                const customerMap = new Map();
                customers.forEach((c: any) => {
                    const isPlaceHolder = !c.name || c.name === c.phone || /^\d+$/.test(c.name);
                    if (c.phone && !isPlaceHolder) {
                        customerMap.set(c.phone, c.name);
                    }
                });

                const chatsMap = new Map();
                messages.forEach((msg: any) => {
                    const phone = msg.contact_phone;
                    const normalizedKey = phone.startsWith('55') && phone.length === 13 && phone[4] === '9'
                        ? phone.substring(0, 4) + phone.substring(5)
                        : phone;

                    const msgName = msg.contact_name;
                    const custName = customerMap.get(phone) || customerMap.get(normalizedKey);

                    const isGeneric = (n: string) => !n || n === 'Você' || n === 'You' || n === phone || n === normalizedKey || n.includes('@') || /^\d+$/.test(n);

                    // Decisão do melhor nome: 1. Nome do cliente (banco) -> 2. Nome da mensagem -> 3. Telefone
                    const bestName = !isGeneric(custName) ? custName : (!isGeneric(msgName) ? msgName : phone);

                    if (!chatsMap.has(normalizedKey)) {
                        chatsMap.set(normalizedKey, {
                            id: `${phone}@s.whatsapp.net`,
                            remoteJid: `${phone}@s.whatsapp.net`,
                            name: bestName,
                            pushName: bestName,
                            lastMessage: msg.content,
                            messageTimestamp: new Date(msg.created_at).getTime() / 1000,
                            unreadCount: msg.status === 'received' ? 1 : 0,
                            phone: phone,
                            normalized_phone: normalizedKey
                        });
                    } else {
                        // Se já temos o chat mas o nome gravado é genérico, e esta mensagem (mesmo mais antiga) tem um nome útil, atualizamos
                        const existing = chatsMap.get(normalizedKey);
                        if (isGeneric(existing.name) && !isGeneric(msgName)) {
                            existing.name = msgName;
                            existing.pushName = msgName;
                        }
                    }
                });

                const chats = Array.from(chatsMap.values());
                console.log(`[EvolutionAPI] fetchChats: Retornando ${chats.length} chats com nomes resolvidos.`);
                return chats;
            } catch (e: any) {
                console.error("fetchChats Supabase error:", e.message);
                return [];
            }
        }

        try {
            console.log('[EvolutionAPI] fetchChats: Starting fetch for instance:', this.instanceName);

            if (!localStorage.getItem('evolution_reset_2.4.6')) {
                localStorage.removeItem('lid_mappings');
                localStorage.setItem('evolution_reset_2.4.6', 'true');
            }

            // 1. Fetch Agenda First (The absolute source of truth for names in v2.3.0)
            console.log('[EvolutionAPI] fetchChats: Fetching contacts...');
            const contactRes = await this.client.post(`/chat/findContacts/${this.instanceName}`, { where: {}, limit: 2000 });
            console.log('[EvolutionAPI] fetchChats: Contacts response:', contactRes.status, contactRes.data);
            const rawContacts = Array.isArray(contactRes.data) ? contactRes.data : Object.values(contactRes.data || {});

            const identityMap = new Map<string, string>();
            const savedMappings: Record<string, string> = JSON.parse(localStorage.getItem('lid_mappings') || '{}');

            rawContacts.forEach((c: any) => {
                const jid = c.remoteJid || c.id || c.jid;
                if (!jid) return;
                const name = c.pushName || c.name || c.verifiedName;
                if (name && !name.includes('@') && !/^\d+$/.test(name.split('@')[0])) {
                    identityMap.set(jid, name);
                }
            });

            // 2. Fetch raw chats
            console.log('[EvolutionAPI] fetchChats: Fetching chats from /chat/findChats/' + this.instanceName);
            const chatResponse = await this.client.post(`/chat/findChats/${this.instanceName}`, { where: {}, limit: 1000 });
            console.log('[EvolutionAPI] fetchChats: Chats response status:', chatResponse.status);
            console.log('[EvolutionAPI] fetchChats: Chats response data type:', typeof chatResponse.data);
            console.log('[EvolutionAPI] fetchChats: Chats response data keys:', chatResponse.data ? Object.keys(chatResponse.data) : 'null');

            const rawChatsData = chatResponse.data;
            const rawChats = Array.isArray(rawChatsData) ? rawChatsData : (rawChatsData?.records || rawChatsData?.data || Object.values(rawChatsData || {}));
            console.log('[EvolutionAPI] fetchChats: Processed rawChats count:', rawChats.length);

            // 3. Fetch recent messages for deep bridge discovery
            let recentMessages: any[] = [];
            try {
                const msgRes = await this.client.post(`/chat/findMessages/${this.instanceName}`, { where: {}, limit: 200, offset: 0 });
                const mData = msgRes.data;
                recentMessages = Array.isArray(mData) ? mData : (mData?.messages?.records || mData?.records || mData?.data || []);
            } catch (e) { }

            const lastMsgMap = new Map<string, any>();
            const allJidSet = new Set<string>();

            const registerJid = (id: string) => {
                if (!id || typeof id !== 'string' || id.length < 3) return;
                allJidSet.add(id);
            };

            rawChats.forEach((c: any) => {
                const jid = c.id || c.remoteJid || c.jid || c.lastMessage?.key?.remoteJid;
                registerJid(jid);
                if (jid) {
                    const current = lastMsgMap.get(jid);
                    if (!current || (c.lastMessage?.messageTimestamp > current.messageTimestamp)) {
                        if (c.lastMessage) lastMsgMap.set(jid, c.lastMessage);
                    }
                }
            });

            recentMessages.forEach((m: any) => {
                const jid = m.key?.remoteJid || m.remoteJid;
                registerJid(jid);

                // Identity Learning Loop (@lid -> Phone)
                const isGroup = jid?.includes('@g.us') || jid?.includes('status@broadcast');
                if (!isGroup && !m.key?.fromMe) {
                    const deepJid = m.senderPn || m.remoteJidAlt || m.participant || m.user || m.key?.participant || m.message?.senderPn || m.message?.user;
                    if (deepJid && typeof deepJid === 'string' && deepJid.includes('@s.whatsapp.net')) {
                        const cleanDeep = deepJid.split('@')[0].replace(/\D/g, '');
                        const cleanJid = String(jid).split('@')[0].replace(/\D/g, '');
                        if (cleanDeep && cleanJid && cleanDeep !== cleanJid) {
                            savedMappings[jid] = deepJid;
                            savedMappings[deepJid] = jid;
                            console.log(`[EvolutionAPI] Mapping Learned: ${jid} <-> ${deepJid}`);
                        }
                    }
                }

                const current = lastMsgMap.get(jid);
                if (!current || Number(m.messageTimestamp) > Number(current.messageTimestamp)) {
                    lastMsgMap.set(jid, m);
                }
            });

            localStorage.setItem('lid_mappings', JSON.stringify(savedMappings));

            // 4. Final Enriched Inbox Synthesis
            const enrichedInboxMap = new Map<string, any>();

            allJidSet.forEach(jid => {
                const mappedId = savedMappings[jid] || jid;
                const primaryId = mappedId.includes('@s.whatsapp.net') ? mappedId : jid;

                const apiEntry = rawChats.find((c: any) => isSameJid(c.id || c.remoteJid || c.jid || c.lastMessage?.key?.remoteJid, jid)) || {};
                const bestMsg = lastMsgMap.get(jid) || lastMsgMap.get(primaryId);

                const timestamp = Math.max(
                    Number(apiEntry.messageTimestamp || 0),
                    Number(bestMsg?.messageTimestamp || 0)
                );

                const existing = enrichedInboxMap.get(primaryId);
                if (!existing) {
                    const resolvedName = identityMap.get(primaryId) || identityMap.get(jid) || resolveContactName(apiEntry, bestMsg, primaryId);
                    enrichedInboxMap.set(primaryId, {
                        ...apiEntry,
                        id: primaryId,
                        remoteJid: primaryId,
                        messageTimestamp: timestamp,
                        unreadCount: apiEntry.unreadCount || 0,
                        lastMessage: bestMsg ? extractMessageContent(bestMsg).content : null,
                        name: resolvedName
                    });
                } else {
                    existing.unreadCount = (existing.unreadCount || 0) + (apiEntry.unreadCount || 0);
                    if (timestamp > Number(existing.messageTimestamp)) {
                        existing.messageTimestamp = timestamp;
                        if (bestMsg) existing.lastMessage = extractMessageContent(bestMsg).content;
                    }
                    const isRealLabel = (n: string) => n && !n.includes('@') && !/^\d+$/.test(n.split('@')[0]) && n !== "Desconhecido" && n !== "Você";
                    if (!isRealLabel(existing.name)) {
                        const alternative = identityMap.get(primaryId) || identityMap.get(jid) || resolveContactName(apiEntry, bestMsg, jid);
                        if (isRealLabel(alternative)) existing.name = alternative;
                    }
                }
            });

            const finalInbox = Array.from(enrichedInboxMap.values())
                .filter(c => !(c.id?.endsWith('@newsletter') || c.id?.endsWith('@broadcast') || c.id === 'status@broadcast'))
                .sort((a, b) => Number(b.messageTimestamp) - Number(a.messageTimestamp));

            console.log(`[EvolutionAPI] Final processed inbox: ${finalInbox.length} conversations.`);
            console.log('[EvolutionAPI] fetchChats: First 3 conversations:', finalInbox.slice(0, 3).map((c: any) => ({ id: c.id, name: c.name })));
            return finalInbox;
        } catch (e: any) {
            console.error("fetchChats error:", e.message);
            return [];
        }
    }

    async markRead(remoteJid: string): Promise<any> {
        try {
            await this.client.post(`/chat/readMessages/${this.instanceName}`, { number: remoteJid, readMessages: true });
        } catch (e) {
            try {
                await this.client.post(`/chat/markRead/${this.instanceName}`, { number: remoteJid });
            } catch (e2) { }
        }
        return null;
    }

    async setWebhook(webhookUrl: string, events: string[]): Promise<any> {
        const response = await this.client.post(`/webhook/set/${this.instanceName}`, {
            webhook: { enabled: true, url: webhookUrl, webhookByEvents: true, events },
        });
        return response.data;
    }
}

// Helpers 2.4.6
export function extractMessageContent(message: any): { type: string; content: string } {
    const msg = message?.message || message;
    if (!msg) return { type: "unknown", content: "" };
    if (msg.conversation) return { type: "text", content: msg.conversation };
    if (msg.extendedTextMessage?.text) return { type: "text", content: msg.extendedTextMessage.text };
    if (msg.imageMessage) return { type: "image", content: "📷 Foto" };
    if (msg.videoMessage) return { type: "video", content: "🎥 Vídeo" };
    if (msg.audioMessage) return { type: "audio", content: "🎵 Áudio" };
    if (msg.documentMessage) return { type: "document", content: "📄 Documento" };
    return { type: "unknown", content: "" };
}

export function isSameJid(jid1: string, jid2: string): boolean {
    if (!jid1 || !jid2) return false;

    const clean = (j: string) => {
        // Extrair apenas os dígitos do número (antes do @)
        let n = String(j).split("@")[0].split(":")[0].replace(/\D/g, "");

        // Se começar com 55 (Brasil)
        if (n.startsWith("55")) {
            // Normalizar 9º dígito: se tiver 13 dígitos e o 5º for 9, remove o 9
            if (n.length === 13 && n[4] === "9") {
                n = n.substring(0, 4) + n.substring(5);
            }
        } else if (n.length === 11 && n[2] === "9") {
            // Se tiver 11 dígitos sem o 55 e o 3º for 9 (DDD + 9 + número)
            n = n.substring(0, 2) + n.substring(3);
        }

        return n;
    };

    const c1 = clean(jid1);
    const c2 = clean(jid2);

    if (c1 && c2 && (c1 === c2 || c1 === "55" + c2 || "55" + c1 === c2)) return true;

    return false;
}

export function formatPhoneNumber(jid: string): string {
    if (!jid) return "";
    let number = String(jid).split("@")[0].split(":")[0].replace(/\D/g, "");

    // Se não tem 55 mas tem 10/11 dígitos, assume que é Brasil
    if (!number.startsWith("55") && (number.length === 10 || number.length === 11)) {
        number = "55" + number;
    }

    if (number.startsWith("55") && number.length >= 10) {
        const area = number.substring(2, 4);
        const rest = number.substring(4);
        if (rest.length === 9) {
            return `(${area}) ${rest.substring(0, 5)}-${rest.substring(5)}`;
        } else if (rest.length === 8) {
            return `(${area}) ${rest.substring(0, 4)}-${rest.substring(4)}`;
        }
    }

    // Fallback para outros formatos ou números incompletos
    if (number.length > 10) {
        return `+${number}`;
    }

    return number;
}

export function resolveContactName(chat: any, message?: any, jid?: string): string {
    const finalJid = jid || chat?.remoteJid || chat?.id || message?.key?.remoteJid || "";
    const phoneNumber = finalJid.split('@')[0];
    const isFromMe = message?.key?.fromMe || message?.fromMe;

    const candidates = [
        !isFromMe ? message?.pushName : null,
        chat?.pushName,
        chat?.name,
        !isFromMe ? message?.key?.pushName : null
    ];

    const invalidNames = ['você', 'you', 'eu', 'me', 'desconhecido', 'unknown', 'null', 'undefined'];

    for (let cand of candidates) {
        if (cand && typeof cand === 'string' && cand.length >= 2) {
            const cleanName = cand.trim();
            if (!cleanName.includes('240605') && cleanName !== phoneNumber && !invalidNames.includes(cleanName.toLowerCase())) {
                return cleanName.startsWith('~') ? cleanName.substring(1).trim() : cleanName;
            }
        }
    }
    return formatPhoneNumber(finalJid) || phoneNumber || "Desconhecido";
}
