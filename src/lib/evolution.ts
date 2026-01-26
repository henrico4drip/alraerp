import axios, { AxiosInstance } from "axios";

export interface EvolutionInstance {
    instanceName: string;
    instanceId?: string;
    status: string;
    owner?: string;
}

export interface EvolutionMessage {
    remoteJidAlt?: string;
    senderPn?: string;
    fromMe?: boolean;
    participant?: string;
    user?: string;
    key: {
        remoteJid: string;
        fromMe: boolean;
        id: string;
        participant?: string;
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
    public readonly version: string = "2.4.9-fixed-complete";

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

        // Debug Interceptors
        this.client.interceptors.request.use(config => {
            console.log(`[EvolutionAPI] Request: ${config.method?.toUpperCase()} ${config.url}`);
            return config;
        });

        this.client.interceptors.response.use(
            response => response,
            error => {
                console.error(`[EvolutionAPI] Error from ${error.config?.url}:`, error.message);
                return Promise.reject(error);
            }
        );
    }

    private async proxyInvoke(action: string, payload?: any) {
        if (!this.supabase) throw new Error("Supabase client not provided for proxy mode");
        try {
            const { data, error } = await this.supabase.functions.invoke('whatsapp-proxy', {
                body: { action, payload }
            });
            if (error) throw error;
            return data;
        } catch (err: any) {
            console.error(`[EvolutionAPI] Proxy Error:`, err.message);
            throw err;
        }
    }

    private async smartRequest(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: any): Promise<any> {
        const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        const useProxy = !!this.supabase && !isLocalhost;

        if (useProxy) {
            const pathLower = path.toLowerCase();
            // Specialized routing
            if (pathLower.includes('/chat/findchats')) return this.proxyInvoke('fetch_inbox', body);
            if (pathLower.includes('/chat/findcontacts') || pathLower.includes('/contact/findcontacts')) return this.proxyInvoke('fetch_contacts', body);
            if (pathLower.includes('/instance/connect')) return this.proxyInvoke('connect', body);
            if (pathLower.includes('/instance/create')) return this.proxyInvoke('connect', body);
            if (pathLower.includes('/instance/connectionstate')) return this.proxyInvoke('get_status', body);
            if (pathLower.includes('/message/sendtext')) return this.proxyInvoke('send_message', body);

            return this.proxyInvoke('proxy_request', { path, method, body });
        } else {
            const response = await (method === 'GET'
                ? this.client.get(path)
                : method === 'POST'
                    ? this.client.post(path, body)
                    : method === 'PUT'
                        ? this.client.put(path, body)
                        : this.client.delete(path));
            return response.data;
        }
    }

    async createInstance(instanceName: string): Promise<any> {
        return this.smartRequest('POST', "/instance/create", {
            instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
        });
    }

    async getInstanceStatus(): Promise<any> {
        try {
            return await this.smartRequest('GET', `/instance/connectionState/${this.instanceName}`);
        } catch (error: any) {
            if (error.response?.status === 404) {
                try {
                    return await this.smartRequest('GET', `/instance/displayState/${this.instanceName}`);
                } catch { throw error; }
            }
            throw error;
        }
    }

    async getQRCode(): Promise<any> {
        try {
            const data = await this.smartRequest('GET', `/instance/connect/${this.instanceName}`);
            if (data?.qrcode) return data.qrcode;
            if (data?.instance?.qrcode) return data.instance.qrcode;
            return data;
        } catch (error: any) {
            if (error.response?.data) return error.response.data;
            throw error;
        }
    }

    async logoutInstance(): Promise<any> {
        return this.smartRequest('DELETE', `/instance/logout/${this.instanceName}`);
    }

    async fetchContacts(): Promise<EvolutionContact[]> {
        try {
            const rawData = await this.smartRequest('POST', `/chat/findContacts/${this.instanceName}`, { where: {}, limit: 2000 });
            const contacts = Array.isArray(rawData) ? rawData : (rawData?.records || rawData?.data || Object.values(rawData || {}));
            return contacts.map((c: any) => ({
                id: c.remoteJid || c.id || c.jid,
                name: c.pushName || c.name || c.verifiedName,
                pushName: c.pushName,
                profilePictureUrl: c.profilePicUrl
            })).filter((c: any) => c.id);
        } catch (e) { return []; }
    }

    async fetchMessages(remoteJid: string, count: number = 100): Promise<EvolutionMessage[]> {
        try {
            const data = await this.smartRequest('POST', `/chat/findMessages/${this.instanceName}`, {
                where: { key: { remoteJid: remoteJid } },
                limit: count,
                offset: 0
            });
            const messages = Array.isArray(data) ? data : (data?.messages?.records || data?.records || data?.data || []);
            return messages.filter((m: any) => isSameJid(m.key?.remoteJid || m.remoteJid, remoteJid))
                .sort((a: any, b: any) => Number(b.messageTimestamp || 0) - Number(a.messageTimestamp || 0))
                .slice(0, count);
        } catch (e) { return []; }
    }

    async fetchChats(): Promise<any[]> {
        try {
            const rawContactsData = await this.smartRequest('POST', `/chat/findContacts/${this.instanceName}`, { where: {}, limit: 2000 });
            const rawContacts = Array.isArray(rawContactsData) ? rawContactsData : Object.values(rawContactsData || {});

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

            const rawChatsData = await this.smartRequest('POST', `/chat/findChats/${this.instanceName}`, { where: {}, limit: 1000 });
            const rawChats = Array.isArray(rawChatsData) ? rawChatsData : (rawChatsData?.records || rawChatsData?.data || Object.values(rawChatsData || {}));

            let recentMessages: any[] = [];
            try {
                const mData = await this.smartRequest('POST', `/chat/findMessages/${this.instanceName}`, { where: {}, limit: 200, offset: 0 });
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
                const current = lastMsgMap.get(jid);
                if (!current || Number(m.messageTimestamp) > Number(current.messageTimestamp)) {
                    lastMsgMap.set(jid, m);
                }
            });

            const enrichedInboxMap = new Map<string, any>();

            allJidSet.forEach(jid => {
                const mappedId = savedMappings[jid] || jid;
                const apiEntry = rawChats.find((c: any) => isSameJid(c.id || c.remoteJid || c.jid, jid)) || {};
                const bestMsg = lastMsgMap.get(jid) || lastMsgMap.get(mappedId);

                const timestamp = Math.max(
                    Number(apiEntry.messageTimestamp || 0),
                    Number(bestMsg?.messageTimestamp || 0)
                );

                const existing = enrichedInboxMap.get(jid);
                if (!existing) {
                    const resName = identityMap.get(jid) || identityMap.get(mappedId) || resolveContactName(apiEntry, bestMsg, jid);
                    enrichedInboxMap.set(jid, {
                        ...apiEntry,
                        id: jid,
                        remoteJid: jid,
                        messageTimestamp: timestamp,
                        unreadCount: apiEntry.unreadCount || 0,
                        lastMessage: bestMsg ? extractMessageContent(bestMsg).content : null,
                        name: resName
                    });
                }
            });

            const finalInbox = Array.from(enrichedInboxMap.values())
                .filter(c => !(c.id?.endsWith('@newsletter') || c.id === 'status@broadcast'))
                .sort((a, b) => Number(b.messageTimestamp) - Number(a.messageTimestamp));

            return finalInbox;
        } catch (e) { return []; }
    }

    async sendTextMessage(remoteJid: string, text: string, quoted?: any): Promise<any> {
        const isLid = remoteJid.includes('@lid');
        const target = (isLid || remoteJid.includes('@g.us')) ? remoteJid : remoteJid.split('@')[0];
        const payload = {
            number: target,
            text,
            checkContact: false,
            forceSend: true,
            options: { delay: isLid ? 1000 : 0, quoted: quoted ? { key: quoted.key, message: quoted.message } : undefined }
        };
        try {
            return await this.smartRequest('POST', `/message/sendText/${this.instanceName}`, payload);
        } catch (error: any) { throw error; }
    }

    async markRead(remoteJid: string): Promise<any> {
        try {
            return await this.smartRequest('POST', `/chat/readMessages/${this.instanceName}`, { number: remoteJid, readMessages: true });
        } catch (e) { }
    }

    async getBase64Media(message: any): Promise<{ base64: string } | null> {
        try {
            return await this.smartRequest('POST', `/chat/getBase64FromMediaMessage/${this.instanceName}`, { message });
        } catch (e) { return null; }
    }

    async fetchContactInfo(remoteId: string): Promise<any> {
        try {
            const data = await this.smartRequest('POST', `/chat/findChats/${this.instanceName}`, { where: { id: remoteId }, limit: 1 });
            const records = Array.isArray(data) ? data : (data?.records || []);
            return records.length > 0 ? records[0] : null;
        } catch (e) { return null; }
    }
}

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
            if (cleanName !== phoneNumber && !invalidNames.includes(cleanName.toLowerCase())) {
                return cleanName.startsWith('~') ? cleanName.substring(1).trim() : cleanName;
            }
        }
    }
    return formatPhoneNumber(finalJid) || phoneNumber || "Desconhecido";
}
