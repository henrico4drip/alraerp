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
        remoteJidAlt?: string;
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
    public readonly version: string = "2.4.9-unified";

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

        // Debugging interceptors
        this.client.interceptors.request.use(config => {
            console.log(`[EvolutionAPI] Request: ${config.method?.toUpperCase()} ${config.url}`);
            return config;
        });

        this.client.interceptors.response.use(
            response => {
                console.log(`[EvolutionAPI] Response: ${response.status} from ${response.config.url}`);
                return response;
            },
            error => {
                console.error(`[EvolutionAPI] Error: ${error.response?.status || 'Network Error'} from ${error.config?.url}`);
                return Promise.reject(error);
            }
        );
    }

    private async proxyInvoke(action: string, payload?: any) {
        if (!this.supabase) throw new Error("Supabase client not provided for proxy mode");
        const { data, error } = await this.supabase.functions.invoke('whatsapp-proxy', {
            body: { action, payload }
        });
        if (error) throw error;
        return data;
    }

    private async smartRequest(method: 'GET' | 'POST', path: string, body?: any): Promise<any> {
        const isLocalhost = typeof window !== 'undefined' &&
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

        // Se não for localhost, PRECISA usar o proxy para evitar Mixed Content (HTTP vs HTTPS)
        const useProxy = !isLocalhost;

        if (useProxy && this.supabase) {
            console.log(`[EvolutionAPI] [PROXY] ${method} ${path}`);
            return this.proxyInvoke('proxy_request', { path, method, body });
        } else {
            console.log(`[EvolutionAPI] [DIRECT] ${method} ${path}`);
            const response = method === 'GET'
                ? await this.client.get(path)
                : await this.client.post(path, body);
            return response.data;
        }
    }

    // Instance management
    async createInstance(instanceName: string): Promise<any> {
        if (this.supabase) return this.proxyInvoke('connect');
        return this.smartRequest('POST', "/instance/create", {
            instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
        });
    }

    async getInstanceStatus(): Promise<any> {
        if (this.supabase) return this.proxyInvoke('get_status');
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
        if (this.supabase) return this.proxyInvoke('connect');
        try {
            const data = await this.smartRequest('GET', `/instance/connect/${this.instanceName}`);
            if (data?.qrcode) return data.qrcode;
            if (data?.instance?.qrcode) return data.instance.qrcode;
            if (typeof data === 'string') return { code: data };
            return data;
        } catch (error: any) {
            if (error.response?.data) return error.response.data;
            throw error;
        }
    }

    async logoutInstance(): Promise<any> {
        if (this.supabase) return this.proxyInvoke('logout');
        const response = await this.client.delete(`/instance/logout/${this.instanceName}`);
        return response.data;
    }

    async syncContacts(): Promise<any> {
        try {
            return await this.smartRequest('POST', `/contact/sync/${this.instanceName}`);
        } catch { return null; }
    }

    async resyncContact(jid: string): Promise<boolean> {
        try {
            await this.smartRequest('POST', `/chat/fetchProfilePictureUrl/${this.instanceName}`, { number: jid });
            return true;
        } catch { return false; }
    }

    // Messages
    async sendTextMessage(remoteJid: string, text: string, quoted?: any): Promise<any> {
        if (this.supabase) {
            return this.proxyInvoke('send_message', { jid: remoteJid, message: text, phone: remoteJid.split('@')[0] });
        }

        let finalJid = remoteJid;
        const savedMap = JSON.parse(localStorage.getItem('lid_mappings') || '{}');
        if (remoteJid.includes('@lid') && savedMap[remoteJid]) {
            finalJid = savedMap[remoteJid];
        }

        const isLid = finalJid.includes('@lid');
        const target = (isLid || finalJid.includes('@g.us')) ? finalJid : finalJid.split('@')[0];

        const payload = {
            number: target,
            text,
            checkContact: false,
            forceSend: true,
            textMessage: { text },
            options: {
                delay: isLid ? 1200 : 0,
                presence: "composing",
                quoted: quoted ? { key: quoted.key, message: quoted.message } : undefined
            }
        };

        try {
            return await this.smartRequest('POST', `/message/sendText/${this.instanceName}`, payload);
        } catch (error: any) {
            // Smart JID resolution fallback if LID fails
            if (isLid && (error.response?.status === 400 || error.response?.status === 404)) {
                try {
                    await this.resyncContact(remoteJid);
                    const history = await this.fetchMessages(remoteJid, 5);
                    for (const m of history) {
                        const candidate = m.remoteJidAlt || m.senderPn || m.participant || m.key?.participant || m.user;
                        if (candidate && candidate.includes('@s.whatsapp.net')) {
                            return this.sendTextMessage(candidate, text, quoted);
                        }
                    }
                } catch { }
            }
            throw error;
        }
    }

    async sendMediaMessage(remoteJid: string, mediaType: string, mediaUrl: string, caption?: string, fileName?: string): Promise<any> {
        const payload = {
            number: remoteJid.includes('@lid') || remoteJid.includes('@g.us') ? remoteJid : remoteJid.split('@')[0],
            checkContact: false,
            forceSend: true,
            mediaMessage: { mediatype: mediaType, media: mediaUrl, caption, fileName }
        };
        return this.smartRequest('POST', `/message/sendMedia/${this.instanceName}`, payload);
    }

    async fetchMessages(remoteJid: string, count: number = 100): Promise<EvolutionMessage[]> {
        try {
            const data = await this.smartRequest('POST', `/chat/findMessages/${this.instanceName}`, {
                where: { key: { remoteJid } },
                limit: Math.min(count + 20, 1000),
                offset: 0
            });

            let messages = Array.isArray(data) ? data : (data?.messages?.records || data?.records || data?.data || []);
            let filtered = messages.filter((m: any) => isSameJid(m.key?.remoteJid || m.remoteJid, remoteJid));

            const unique = new Map();
            filtered.forEach((m: any) => {
                const id = m.key?.id || m.id;
                if (id && !unique.has(id)) unique.set(id, m);
            });

            return Array.from(unique.values())
                .sort((a: any, b: any) => Number(b.messageTimestamp || 0) - Number(a.messageTimestamp || 0))
                .slice(0, count);
        } catch { return []; }
    }

    async fetchContacts(): Promise<EvolutionContact[]> {
        try {
            const rawData = await this.smartRequest('POST', `/chat/findContacts/${this.instanceName}`, { where: {}, limit: 2000 });
            const contacts = Array.isArray(rawData) ? rawData : (rawData?.records || rawData?.data || Object.values(rawData || {}));

            return contacts.map((c: any) => ({
                id: c.remoteJid || c.id || c.jid,
                name: c.pushName || c.name || c.verifiedName,
                profilePictureUrl: c.profilePicUrl
            })).filter((c: any) => c.id);
        } catch { return []; }
    }

    async fetchChats(): Promise<any[]> {
        try {
            const rawContacts = await this.fetchContacts();
            const identityMap = new Map();
            rawContacts.forEach(c => identityMap.set(c.id, c.name));

            const chatData = await this.smartRequest('POST', `/chat/findChats/${this.instanceName}`, { where: {}, limit: 1000 });
            const rawChats = Array.isArray(chatData) ? chatData : (chatData?.records || chatData?.data || Object.values(chatData || {}));

            const msgData = await this.smartRequest('POST', `/chat/findMessages/${this.instanceName}`, { where: {}, limit: 200, offset: 0 });
            const recentMessages = Array.isArray(msgData) ? msgData : (msgData?.messages?.records || msgData?.records || msgData?.data || []);

            const savedMappings = JSON.parse(localStorage.getItem('lid_mappings') || '{}');
            recentMessages.forEach((m: any) => {
                const jid = m.key?.remoteJid || m.remoteJid;
                if (jid?.includes('@lid') && !m.key?.fromMe) {
                    const alt = m.senderPn || m.remoteJidAlt || m.participant || m.user;
                    if (alt && alt.includes('@s.whatsapp.net')) {
                        savedMappings[jid] = alt;
                        savedMappings[alt] = jid;
                    }
                }
            });
            localStorage.setItem('lid_mappings', JSON.stringify(savedMappings));

            return rawChats.map((c: any) => {
                const jid = c.id || c.remoteJid;
                const name = identityMap.get(jid) || identityMap.get(savedMappings[jid]) || c.name || c.pushName || jid.split('@')[0];
                return {
                    ...c,
                    id: jid,
                    name,
                    lastMessage: c.lastMessage ? extractMessageContent(c.lastMessage).content : null,
                    messageTimestamp: Number(c.messageTimestamp || 0)
                };
            }).sort((a, b) => b.messageTimestamp - a.messageTimestamp);
        } catch { return []; }
    }

    async markRead(remoteJid: string): Promise<any> {
        try {
            await this.smartRequest('POST', `/chat/readMessages/${this.instanceName}`, { number: remoteJid, readMessages: true });
        } catch {
            try {
                await this.smartRequest('POST', `/chat/markRead/${this.instanceName}`, { number: remoteJid });
            } catch { }
        }
        return null;
    }

    async getBase64Media(message: any): Promise<any> {
        try {
            return await this.smartRequest('POST', `/chat/getBase64FromMediaMessage/${this.instanceName}`, { message });
        } catch { return null; }
    }
}

export function isSameJid(j1: string, j2: string, lidMap?: Record<string, string>): boolean {
    if (!j1 || !j2) return false;
    const p1 = (lidMap?.[j1] || j1).split('@')[0].split(':')[0];
    const p2 = (lidMap?.[j2] || j2).split('@')[0].split(':')[0];
    return p1 === p2;
}

export function formatPhoneNumber(jid: string): string {
    if (!jid) return "";
    const num = jid.split('@')[0].split(':')[0];
    if (num.startsWith('55') && num.length >= 12) {
        return `(${num.slice(2, 4)}) ${num.slice(4, 9)}-${num.slice(9)}`;
    }
    return num;
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
