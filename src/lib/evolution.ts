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
    public readonly version: string = "2.4.8-secure";

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

    private async request(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: any) {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const useProxy = !!this.supabase && !isLocalhost;

        if (useProxy) {
            console.log(`[EvolutionAPI] [PROXY] ${method} ${path}`);
            // Force proxy routes to match Edge Function cases
            const pathLower = path.toLowerCase();
            if (pathLower.includes('/chat/findchats')) return this.proxyInvoke('fetch_inbox', body);
            if (pathLower.includes('/chat/findcontacts') || pathLower.includes('/contact/findcontacts')) return this.proxyInvoke('fetch_contacts', body);
            if (pathLower.includes('/instance/create')) return this.proxyInvoke('connect', body);
            if (pathLower.includes('/instance/connectionstate')) return this.proxyInvoke('get_status', body);
            if (pathLower.includes('/message/sendtext')) return this.proxyInvoke('send_message', body);

            // Generic fallback
            return this.proxyInvoke('proxy_request', { path, method, body });
        }

        console.log(`[EvolutionAPI] [DIRECT] ${method} ${path}`);
        const response = await (method === 'GET'
            ? this.client.get(path)
            : method === 'POST'
                ? this.client.post(path, body)
                : method === 'PUT'
                    ? this.client.put(path, body)
                    : this.client.delete(path));

        return response.data;
    }

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
            if (error.response?.status === 404) {
                try {
                    return await this.request('GET', `/instance/displayState/${this.instanceName}`);
                } catch { throw error; }
            }
            throw error;
        }
    }

    async getQRCode(): Promise<any> {
        try {
            const data = await this.request('GET', `/instance/connect/${this.instanceName}`);
            if (data?.qrcode) return data.qrcode;
            if (data?.instance?.qrcode) return data.instance.qrcode;
            if (typeof data === 'string') return { code: data };
            return data;
        } catch (error: any) {
            if (error.response?.data) return error.response.data;
            throw error;
        }
    }

    async deleteInstance(): Promise<any> {
        return this.request('DELETE', `/instance/delete/${this.instanceName}`);
    }

    async logoutInstance(): Promise<any> {
        return this.request('DELETE', `/instance/logout/${this.instanceName}`);
    }

    async sendTextMessage(remoteJid: string, text: string, quoted?: any): Promise<any> {
        const isLid = remoteJid.includes('@lid');
        const target = (isLid || remoteJid.includes('@g.us')) ? remoteJid : remoteJid.split('@')[0];

        const payload = {
            number: target,
            text: text,
            checkContact: false,
            forceSend: true,
            textMessage: { text: text },
            options: {
                delay: isLid ? 1000 : 0,
                quoted: quoted ? { key: quoted.key, message: quoted.message } : undefined
            }
        };

        try {
            return await this.request('POST', `/message/sendText/${this.instanceName}`, payload);
        } catch (error: any) {
            console.error(`[EvolutionAPI] Send error:`, error.message);
            throw error;
        }
    }

    async fetchMessages(remoteJid: string, count: number = 50): Promise<EvolutionMessage[]> {
        const fetchLimit = Math.min(Math.max(count + 20, 100), 1000);
        try {
            const data = await this.request('POST', `/chat/findMessages/${this.instanceName}`, {
                where: { key: { remoteJid: remoteJid } },
                limit: fetchLimit,
                offset: 0
            });

            let messages = Array.isArray(data) ? data : (data?.messages?.records || data?.records || data?.data || []);
            return messages.filter((m: any) => isSameJid(m.key?.remoteJid || m.remoteJid, remoteJid))
                .sort((a: any, b: any) => Number(b.messageTimestamp || 0) - Number(a.messageTimestamp || 0))
                .slice(0, count);
        } catch (e) { return []; }
    }

    async fetchContacts(): Promise<EvolutionContact[]> {
        try {
            const rawData = await this.request('POST', `/chat/findContacts/${this.instanceName}`, { where: {}, limit: 2000 });
            const contacts = Array.isArray(rawData) ? rawData : (rawData?.records || rawData?.data || Object.values(rawData || {}));
            return contacts.map((c: any) => ({
                id: c.remoteJid || c.id || c.jid,
                name: c.pushName || c.name || c.verifiedName,
                profilePictureUrl: c.profilePicUrl
            })).filter((c: any) => c.id);
        } catch (e) { return []; }
    }

    async fetchChats(): Promise<any[]> {
        try {
            const rawData = await this.request('POST', `/chat/findChats/${this.instanceName}`, { where: {}, limit: 1000 });
            const chats = Array.isArray(rawData) ? rawData : (rawData?.records || rawData?.data || Object.values(rawData || {}));
            return chats.map((c: any) => ({
                ...c,
                id: c.id || c.remoteJid,
                name: c.pushName || c.name || c.id?.split('@')[0] || 'Desconhecido'
            })).sort((a: any, b: any) => Number(b.messageTimestamp || 0) - Number(a.messageTimestamp || 0));
        } catch (e) { return []; }
    }

    async markRead(remoteJid: string): Promise<any> {
        try {
            return await this.request('POST', `/chat/readMessages/${this.instanceName}`, { number: remoteJid, readMessages: true });
        } catch (e) { }
        return null;
    }

    async syncContacts(): Promise<any> {
        try {
            return await this.request('POST', `/contact/sync/${this.instanceName}`);
        } catch (e) {
            return null;
        }
    }
}

export function isSameJid(j1: string, j2: string): boolean {
    if (!j1 || !j2) return false;
    const p1 = j1.split('@')[0];
    const p2 = j2.split('@')[0];
    return p1 === p2;
}

export function formatPhoneNumber(jid: string): string {
    if (!jid) return "";
    const num = jid.split('@')[0];
    if (num.length >= 12) {
        return `+${num.slice(0, 2)} (${num.slice(2, 4)}) ${num.slice(4, 9)}-${num.slice(9)}`;
    }
    return num;
}
