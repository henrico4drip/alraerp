// CRM Storage - IndexedDB wrapper for caching WhatsApp messages locally
// Provides instant message display while API loads fresh data

const DB_NAME = 'crm_cache';
const DB_VERSION = 1;
const MESSAGES_STORE = 'messages';

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
                const store = db.createObjectStore(MESSAGES_STORE, { keyPath: 'cacheKey' });
                store.createIndex('jid', 'jid', { unique: false });
            }
        };
    });
}

export const crmStorage = {
    async getMessages(jid: string, limit: number = 200): Promise<any[]> {
        try {
            const db = await openDB();
            return new Promise((resolve) => {
                const tx = db.transaction(MESSAGES_STORE, 'readonly');
                const store = tx.objectStore(MESSAGES_STORE);
                const index = store.index('jid');
                const request = index.getAll(jid);
                request.onsuccess = () => {
                    const results = (request.result || [])
                        .map((r: any) => r.data)
                        .sort((a: any, b: any) => Number(a.messageTimestamp || 0) - Number(b.messageTimestamp || 0))
                        .slice(-limit);
                    resolve(results);
                };
                request.onerror = () => resolve([]);
            });
        } catch {
            return [];
        }
    },

    async saveMessages(jid: string, messages: any[]): Promise<void> {
        try {
            const db = await openDB();
            const tx = db.transaction(MESSAGES_STORE, 'readwrite');
            const store = tx.objectStore(MESSAGES_STORE);
            for (const msg of messages) {
                const id = msg.key?.id || msg.id;
                if (!id) continue;
                store.put({
                    cacheKey: `${jid}_${id}`,
                    jid,
                    data: msg,
                    timestamp: Date.now()
                });
            }
        } catch {
            // Silently fail - cache is optional
        }
    },

    async clear(): Promise<void> {
        try {
            const db = await openDB();
            const tx = db.transaction(MESSAGES_STORE, 'readwrite');
            tx.objectStore(MESSAGES_STORE).clear();
        } catch {
            // Silently fail
        }
    }
};
