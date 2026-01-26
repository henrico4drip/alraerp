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

    private async proxyInvoke(action: string, payload?: any) {
        if (!this.supabase) throw new Error("Supabase client not provided for proxy mode");
        console.log(`[EvolutionAPI] Proxy Invoke: ${action}`);
        const { data, error } = await this.supabase.functions.invoke('whatsapp-proxy', {
            body: { action, payload }
        });
        if (error) {
            console.error(`[EvolutionAPI] Proxy Error:`, error);
            throw error;
        }
        return data;
    }

    private async request(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: any) {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        // ALWAYS use proxy in production to avoid HTTPS/HTTP mixed content blocked errors
        const useProxy = !!this.supabase && !isLocalhost;

        if (useProxy) {
            console.log(`[EvolutionAPI] [PROXY MODE] ${method} ${path}`);

            // Check for routes that have specialized handlers in the proxy
            const pathLower = path.toLowerCase();
            if (pathLower.includes('/chat/findchats/')) return this.proxyInvoke('fetch_inbox', body);
            if (pathLower.includes('/chat/findcontacts/')) return this.proxyInvoke('fetch_contacts', body);
            if (pathLower.includes('/instance/create')) return this.proxyInvoke('connect', body);
            if (pathLower.includes('/instance/connect/')) return this.proxyInvoke('connect', body);
            if (pathLower.includes('/instance/connectionstate/')) return this.proxyInvoke('get_status', body);
            if (pathLower.includes('/message/sendtext/')) return this.proxyInvoke('send_message', body);

            // For all other routes, use the generic proxy_request
            return this.proxyInvoke('proxy_request', {
                path,
                method,
                body: body ? (typeof body === 'string' ? JSON.parse(body) : body) : undefined
            });
        }

        console.log(`[EvolutionAPI] [DIRECT MODE] ${method} ${path}`);
        // Standard direct request (localhost/dev only)
        const response = await (method === 'GET'
            ? this.client.get(path)
            : method === 'POST'
                ? this.client.post(path, body)
                : method === 'PUT'
                    ? this.client.put(path, body)
                    : this.client.delete(path));

        return response.data;
    }

    // Instance Management
    async createInstance(instanceName: string): Promise<any> {
        return this.request('POST', "/instance/create", {
            instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
        });
    }

    async getInstanceStatus(): Promise<any> {
        try {
            return await this.request('GET', `/instance/connectionState/${this.instanceName}`);
        } catch (error: any) {
            // Fallback for older v1.x or variations
            if (error.response?.status === 404) {
                try {
                    return await this.request('GET', `/instance/displayState/${this.instanceName}`);
                } catch {
                    throw error;
                }
            }
            throw error;
        }
    }

    async getQRCode(): Promise<any> {
        try {
            const data = await this.request('GET', `/instance/connect/${this.instanceName}`);

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
            const data = await this.request('GET', "/instance/fetchInstances");

            if (Array.isArray(data)) return data;
            if (Array.isArray(data?.instances)) return data.instances;
            if (data?.data && Array.isArray(data.data)) return data.data;

            return [];
        } catch {
            return [];
        }
    }

    async deleteInstance(): Promise<any> {
        return this.request('DELETE', `/instance/delete/${this.instanceName}`);
    }

    async logoutInstance(): Promise<any> {
        return this.request('DELETE', `/instance/logout/${this.instanceName}`);
    }

    async restartInstance(): Promise<any> {
        return this.request('PUT', `/instance/restart/${this.instanceName}`);
    }

    async findContact(jid: string): Promise<any> {
        return this.fetchContactInfo(jid);
    }

    async syncContacts(): Promise<any> {
        try {
            return await this.request('POST', `/contact/sync/${this.instanceName}`);
        } catch (e) {
            return null;
        }
    }

    async resyncContact(jid: string): Promise<boolean> {
        try {
            // HACK V2: Fetching the profile picture forces the server to look up the user's public record,
            // which often populates the internal LID->Phone mapping cache.
            await this.request('POST', `/chat/fetchProfilePictureUrl/${this.instanceName}`, {
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
            return await this.request('POST', `/message/sendText/${this.instanceName}`, payload);
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
                    return await this.request('POST', `/message/sendText/${this.instanceName}`, {
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
                } catch (fError: any) {
                    // FALLBACK 3: QUOTED MESSAGE STRATEGY
                    if (quoted) {
                        console.log(`[EvolutionAPI] Trying QUOTED fallback for LID...`);
                        try {
                            return await this.request('POST', `/message/sendText/${this.instanceName}`, {
                                number: remoteJid,
                                text: text,
                                textMessage: {
                                    text: text
                                },
                                checkContact: false,
                                forceSend: true,
                                quoted: { key: quoted.key, message: quoted.message }
                            });
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
            return await this.request('POST', endpoint, {
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
                    return await this.request('POST', endpoint, {
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

    async fetchMessages(remoteJid: string, count: number = 50): Promise<EvolutionMessage[]> {
        if (this.supabase) {
            const data = await this.proxyInvoke('sync_chat', { jid: remoteJid, phone: remoteJid.split('@')[0] });
            // The sync_chat in proxy saves to DB, but as a fallback for the CRM UI, 
            // we might still want to hit the API for instant view.
            // However, user wants unification, so we'll trust the proxy or the DB.
            // Since proxy 'sync_chat' doesn't return the messages array currently, 
            // we'll keep doing the API hit for now but with the Unified URL/Key if it's available.
        }

        const fetchLimit = Math.min(Math.max(count + 20, 100), 5000);

        try {
            // v2.3.0 uses findMessages endpoint
            const data = await this.request('POST', `/chat/findMessages/${this.instanceName}`, {
                where: {
                    key: {
                        remoteJid: remoteJid
                    }
                },
                limit: fetchLimit,
                offset: 0
            });

            let messages = [];
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
                    // The messages property is an object, not an array - inspect its structure
                    console.log('[EvolutionAPI] fetchMessages: messages is an object. Keys:', Object.keys(data.messages));

                    // Try common nested paths where the actual array might be
                    const messagesObj = data.messages;
                    if (Array.isArray(messagesObj.records)) {
                        // Evolution API v2.3.0 paginated format: { total, pages, currentPage, records: [...] }
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
                        // Convert object values to array as last resort
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
            const uniqueMessages = new Map();
            filtered.forEach((m: any) => {
                const msgId = m.key?.id || m.id;
                if (msgId && !uniqueMessages.has(msgId)) {
                    uniqueMessages.set(msgId, m);
                }
            });

            const finalMessages = Array.from(uniqueMessages.values());

            // Sort by timestamp descending (newest first)
            return finalMessages.sort((a: any, b: any) => {
                const tsA = Number(a.messageTimestamp || 0);
                const tsB = Number(b.messageTimestamp || 0);
                return tsB - tsA;
            }).slice(0, count);

        } catch (error: any) {
            console.error("Evolution API findMessages error:", error.response?.data || error.message);
            // If the specific search fails, we can't do much without a local DB
            return [];
        }
    }

    // Contacts
    async fetchContacts(): Promise<EvolutionContact[]> {
        try {
            const rawData = await this.request('POST', `/chat/findContacts/${this.instanceName}`, { where: {}, limit: 2000 });
            // v2.3.0 can return an object or an array
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
            const data = await this.request('POST', `/chat/fetchProfilePictureUrl/${this.instanceName}`, {
                number: remoteJid,
            });
            return data?.profilePictureUrl || null;
        } catch (e: any) {
            return null;
        }
    }

    async fetchContactInfo(remoteId: string): Promise<any> {
        if (!remoteId) return null;
        try {
            // Use findChats with a specific ID filter as a reliable alternative to the failing contact route
            const data = await this.request('POST', `/chat/findChats/${this.instanceName}`, {
                where: {
                    id: remoteId
                },
                limit: 1
            });

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
            return await this.request('POST', `/chat/getBase64FromMediaMessage/${this.instanceName}`, {
                message: message,
                convertToMp4: false
            });
        } catch (error: any) {
            console.warn("Error getting base64 media:", error.message);
            return null;
        }
    }

    // Chats
    async fetchChats(deepScan: boolean = false): Promise<any[]> {
        try {
            if (!localStorage.getItem('evolution_reset_2.4.6')) {
                localStorage.removeItem('lid_mappings');
                localStorage.setItem('evolution_reset_2.4.6', 'true');
            }

            // 1. Fetch Agenda First (The absolute source of truth for names in v2.3.0)
            const contactData = await this.request('POST', `/chat/findContacts/${this.instanceName}`, { where: {}, limit: 2000 });
            const rawContacts = Array.isArray(contactData) ? contactData : Object.values(contactData || {});

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
            const rawChatsData = await this.request('POST', `/chat/findChats/${this.instanceName}`, { where: {}, limit: 1000 });
            const rawChats = Array.isArray(rawChatsData) ? rawChatsData : (rawChatsData?.records || rawChatsData?.data || Object.values(rawChatsData || {}));

            // 3. Fetch recent messages for deep bridge discovery
            let recentMessages: any[] = [];
            try {
                const mData = await this.request('POST', `/chat/findMessages/${this.instanceName}`, { where: {}, limit: 200, offset: 0 });
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
                if (jid?.includes('@lid') && !m.key?.fromMe) {
                    const deepJid = m.senderPn || m.remoteJidAlt || m.participant || m.user || m.key?.participant;
                    if (deepJid && deepJid.includes('@s.whatsapp.net')) {
                        savedMappings[jid] = deepJid;
                        savedMappings[deepJid] = jid;
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
            return finalInbox;
        } catch (e: any) {
            console.error("fetchChats error:", e.message);
            return [];
        }
    }

    async markRead(remoteJid: string): Promise<any> {
        try {
            await this.request('POST', `/chat/readMessages/${this.instanceName}`, { number: remoteJid, readMessages: true });
        } catch (e) {
            try {
                await this.request('POST', `/chat/markRead/${this.instanceName}`, { number: remoteJid });
            } catch (e2) { }
        }
        return null;
    }

    async setWebhook(webhookUrl: string, events: string[]): Promise<any> {
        return this.request('POST', `/webhook/set/${this.instanceName}`, {
            webhook: { enabled: true, url: webhookUrl, webhookByEvents: true, events },
        });
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

export function isSameJid(jid1: string, jid2: string, savedMap?: Record<string, string>): boolean {
    if (!jid1 || !jid2) return false;
    const clean = (j: string) => {
        const n = String(j).split("@")[0].split(":")[0];
        if (n.startsWith("55") && n.length === 13 && n[4] === "9") return n.substring(0, 4) + n.substring(5);
        return n;
    };
    if (clean(jid1) === clean(jid2)) return true;
    try {
        const map = savedMap || JSON.parse(localStorage.getItem('lid_mappings') || '{}');
        return clean(map[jid1] || jid1) === clean(map[jid2] || jid2);
    } catch (e) { }
    return false;
}

export function formatPhoneNumber(jid: string): string {
    if (!jid) return "";
    const number = jid.split("@")[0].split(":")[0];
    if (number.startsWith("55") && number.length >= 10) {
        const area = number.substring(2, 4);
        const rest = number.substring(4);
        return `(${area}) ${rest.length === 9 ? rest.substring(0, 5) : rest.substring(0, 4)}-${rest.length === 9 ? rest.substring(5) : rest.substring(4)}`;
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
