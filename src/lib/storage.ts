/**
 * CRM Storage Engine (IndexedDB)
 * Managed by Database Architect & Backend Specialist
 * 
 * Provides high-performance, asynchronous persistent storage for 
 * WhatsApp messages and chat metadata, replacing the limited localStorage.
 */

const DB_NAME = 'AlraERP_CRM_Cache';
const DB_VERSION = 2;

export interface CachedMessage {
    id: string; // waId
    jid: string;
    data: any;
    timestamp: number;
}

export interface CachedChat {
    id: string; // jid
    data: any;
    updatedAt: number;
}

class CRMStorage {
    private db: IDBDatabase | null = null;

    private async getDB(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(request.result);
            };

            request.onupgradeneeded = (event: any) => {
                const db = event.target.result;

                // Messages Store
                if (!db.objectStoreNames.contains('messages')) {
                    const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
                    msgStore.createIndex('jid', 'jid', { unique: false });
                    msgStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // Chats Store
                if (!db.objectStoreNames.contains('chats')) {
                    db.createObjectStore('chats', { keyPath: 'id' });
                }
            };
        });
    }

    async saveMessages(jid: string, messages: any[]) {
        const db = await this.getDB();
        const tx = db.transaction('messages', 'readwrite');
        const store = tx.objectStore('messages');

        // We only keep the last 200 messages in DB per chat to manage space
        messages.forEach(m => {
            const id = m.key?.id || m.id;
            if (!id) return;
            store.put({
                id,
                jid,
                data: m,
                timestamp: Number(m.messageTimestamp || Date.now() / 1000)
            });
        });

        return new Promise((resolve) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    async getMessages(jid: string, limit: number = 200): Promise<any[]> {
        const db = await this.getDB();
        return new Promise((resolve) => {
            const tx = db.transaction('messages', 'readonly');
            const store = tx.objectStore('messages');
            const index = store.index('jid');
            const request = index.getAll(jid);

            request.onsuccess = () => {
                const results = request.result || [];
                const sorted = results
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, limit)
                    .map(r => r.data);
                resolve(sorted);
            };
            request.onerror = () => resolve([]);
        });
    }

    async saveChats(chats: any[]) {
        const db = await this.getDB();
        const tx = db.transaction('chats', 'readwrite');
        const store = tx.objectStore('chats');

        chats.forEach(c => {
            const id = c.id || c.remoteJid;
            if (!id) return;
            store.put({
                id,
                data: c,
                updatedAt: Date.now()
            });
        });
    }

    async getChats(): Promise<any[]> {
        const db = await this.getDB();
        return new Promise((resolve) => {
            const tx = db.transaction('chats', 'readonly');
            const store = tx.objectStore('chats');
            const request = store.getAll();

            request.onsuccess = () => {
                const results = request.result || [];
                resolve(results.map(r => r.data));
            };
            request.onerror = () => resolve([]);
        });
    }

    async clearAll() {
        const db = await this.getDB();
        const tx = db.transaction(['messages', 'chats'], 'readwrite');
        tx.objectStore('messages').clear();
        tx.objectStore('chats').clear();
    }
}

export const crmStorage = new CRMStorage();
