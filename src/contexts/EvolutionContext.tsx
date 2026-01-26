import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { EvolutionAPI, isSameJid, formatPhoneNumber } from '../lib/evolution';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../api/supabaseClient';
import QRCode from 'qrcode';

interface EvolutionContextType {
    api: EvolutionAPI | null;
    isConnected: boolean;
    instanceName: string;
    qrCode: string | null;
    pairingCode: string | null;
    loading: boolean;
    error: string | null;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    checkStatus: () => Promise<void>;
    stats: { contacts: number; chats: number; messages: number };
    setStats: (stats: { contacts: number; chats: number; messages: number }) => void;
    isSyncing: boolean;
    autoSync: () => Promise<void>;
    resolveName: (jid: string, fallback?: string) => string;
    discoveredNames: Record<string, string>;
    setDiscoveredNames: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    customNames: Record<string, string>;
    setCustomName: (jid: string, name: string) => void;
    contacts: any[];
    customers: any[];
    messageCache: Record<string, any[]>;
    updateMessageCache: (jid: string, messages: any[]) => void;
    syncContacts: () => Promise<any>;
}

const EvolutionContext = createContext<EvolutionContextType | undefined>(undefined);

export function EvolutionProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [customers, setCustomers] = useState<any[]>([]);

    const instanceName = useMemo(() => {
        if (!user?.id) return '';
        return `erp_${user.id.split('-')[0]}`;
    }, [user?.id]);

    const [stats, setStatsState] = useState(() => {
        const saved = localStorage.getItem('evolution_stats');
        try { return saved ? JSON.parse(saved) : { contacts: 0, chats: 0, messages: 0 }; } catch { return { contacts: 0, chats: 0, messages: 0 }; }
    });

    const setStats = (newStats: { contacts: number; chats: number; messages: number }) => {
        setStatsState(newStats);
        localStorage.setItem('evolution_stats', JSON.stringify(newStats));
    };

    const [api, setApi] = useState<EvolutionAPI | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [pairingCode, setPairingCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasAutoSynced, setHasAutoSynced] = useState(false);
    const [contacts, setContacts] = useState<any[]>([]);

    const [discoveredNames, setDiscoveredNames] = useState<Record<string, string>>(() => {
        const saved = localStorage.getItem('evolution_discovered_names');
        try { return saved ? JSON.parse(saved) : {}; } catch { return {}; }
    });

    const [customNames, setCustomNames] = useState<Record<string, string>>(() => {
        const saved = localStorage.getItem('evolution_custom_names');
        try { return saved ? JSON.parse(saved) : {}; } catch { return {}; }
    });

    const lidMapMemo = useMemo(() => {
        try { return JSON.parse(localStorage.getItem('lid_mappings') || '{}'); } catch { return {}; }
    }, [contacts]);

    useEffect(() => {
        if (Object.keys(discoveredNames).length > 0) {
            localStorage.setItem('evolution_discovered_names', JSON.stringify(discoveredNames));
        }
    }, [discoveredNames]);

    const [messageCache, setMessageCache] = useState<Record<string, any[]>>({});

    const updateMessageCache = (jid: string, newMessages: any[]) => {
        setMessageCache(prev => ({ ...prev, [jid]: newMessages }));
    };

    useEffect(() => {
        if (!user?.id) { setApi(null); return; }
        setApi(new EvolutionAPI(import.meta.env.VITE_EVOLUTION_API_URL || '', import.meta.env.VITE_EVOLUTION_API_KEY || 'Henrico9516', instanceName, supabase));
    }, [user?.id, instanceName]);

    const checkStatus = async () => {
        if (!api || !instanceName) return;
        try {
            const status = await api.getInstanceStatus();
            const rawState = status?.instance?.state || status?.state || status?.status || "";
            const state = typeof rawState === 'string' ? rawState.toUpperCase() : "";
            const connected = state === 'OPEN' || state === 'CONNECTED' || state === 'ISLOGGED';
            setIsConnected(connected);
            if (connected) { setQrCode(null); setPairingCode(null); }
        } catch (err) { setIsConnected(false); }
    };

    const autoSync = async () => {
        if (!api || !isConnected) return;
        setIsSyncing(true);
        try {
            console.log("[EvolutionContext] Auto-syncing identity data...");

            // 1. Fetch CRM Customers
            const { data: dbCustomers } = await supabase.from('customers').select('name, phone');
            if (dbCustomers) setCustomers(dbCustomers);

            // 2. Fetch WA Contacts
            const contactsList = await api.fetchContacts();
            if (Array.isArray(contactsList) && contactsList.length > 0) {
                setContacts(contactsList);

                const discovered: Record<string, string> = {};
                contactsList.forEach((c: any) => {
                    const jid = c.id || c.remoteJid;
                    const name = c.name || c.pushName;
                    if (jid && name && name.length > 1) {
                        const isPhone = name === jid.split('@')[0];
                        if (!isPhone) discovered[jid] = name;
                    }
                });
                if (Object.keys(discovered).length > 0) {
                    setDiscoveredNames(prev => ({ ...prev, ...discovered }));
                }
            }
        } catch (err) { console.error("Sync error:", err); }
        finally { setIsSyncing(false); setHasAutoSynced(true); }
    };

    const resolveName = useCallback((jid: string, fallback?: string) => {
        if (!jid) return fallback || "Desconhecido";
        let targetJid = jid;
        if (lidMapMemo[jid]) targetJid = lidMapMemo[jid];

        const phoneNumber = targetJid.split('@')[0];

        // 1. Priority: Custom name set in CRM
        if (customNames[jid]) return customNames[jid];
        if (customNames[targetJid]) return customNames[targetJid];

        // 2. Priority: DB Customer Name
        const dbMatch = customers.find(c => c.phone?.replace(/\D/g, '').includes(phoneNumber.replace(/\D/g, '')));
        if (dbMatch?.name) return dbMatch.name;

        // 3. Priority: Discovered name from WA
        if (discoveredNames[jid]) return discoveredNames[jid];
        if (discoveredNames[targetJid]) return discoveredNames[targetJid];

        // 4. Priority: Profile Name in current list
        const contact = contacts.find(c => isSameJid(c.id || c.remoteJid, targetJid, lidMapMemo));
        if (contact?.name || contact?.pushName) return contact.name || contact.pushName;

        // 5. Fallback: Phone Number
        const formatted = formatPhoneNumber(targetJid);
        if (formatted && formatted.length > 5) return formatted;
        if (phoneNumber && phoneNumber.length > 5) return phoneNumber;

        return fallback || "Desconhecido";
    }, [lidMapMemo, contacts, customNames, discoveredNames, customers]);

    const connect = async () => {
        if (!api) return;
        setLoading(true);
        try {
            const qrData = await api.getQRCode();
            const rawBase64 = qrData?.base64 || qrData?.instance?.qrcode?.base64;
            const rawCode = qrData?.code || qrData?.instance?.qrcode?.code || (typeof qrData === 'string' ? qrData : null);
            if (rawBase64) setQrCode(rawBase64.startsWith('data:image') ? rawBase64 : `data:image/png;base64,${rawBase64}`);
            else if (rawCode) setQrCode(await QRCode.toDataURL(String(rawCode)));
            if (qrData?.pairingCode) setPairingCode(String(qrData.pairingCode));
        } catch (err) { } finally { setLoading(false); }
    };

    const syncContacts = async () => { if (api && isConnected) return await api.syncContacts(); };
    const disconnect = async () => { if (api) { await api.logoutInstance(); setIsConnected(false); setQrCode(null); } };

    useEffect(() => {
        if (api) { checkStatus(); const interval = setInterval(checkStatus, 20000); return () => clearInterval(interval); }
    }, [api]);

    useEffect(() => {
        if (isConnected && !loading && api && !hasAutoSynced) autoSync();
    }, [isConnected, loading, api, hasAutoSynced]);

    return (
        <EvolutionContext.Provider value={{
            api, isConnected, instanceName, qrCode, pairingCode, loading, error, connect, disconnect, checkStatus,
            stats, setStats, isSyncing, autoSync, resolveName, discoveredNames, setDiscoveredNames, customNames,
            setCustomName, contacts, customers, messageCache, updateMessageCache, syncContacts
        }}>
            {children}
        </EvolutionContext.Provider>
    );
}

export function useEvolution() {
    const context = useContext(EvolutionContext);
    if (!context) throw new Error('useEvolution must be used within EvolutionProvider');
    return context;
}
