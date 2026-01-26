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
        try {
            const saved = localStorage.getItem('evolution_stats');
            return saved ? JSON.parse(saved) : { contacts: 0, chats: 0, messages: 0 };
        } catch { return { contacts: 0, chats: 0, messages: 0 }; }
    });

    const setStats = (newStats: any) => {
        if (!newStats) return;
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
        try {
            const saved = localStorage.getItem('evolution_discovered_names');
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    });

    const [customNames, setCustomNames] = useState<Record<string, string>>(() => {
        try {
            const saved = localStorage.getItem('evolution_custom_names');
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    });

    const lidMapMemo = useMemo(() => {
        try { return JSON.parse(localStorage.getItem('lid_mappings') || '{}'); } catch { return {}; }
    }, [contacts.length]);

    useEffect(() => {
        if (Object.keys(discoveredNames).length > 0) {
            localStorage.setItem('evolution_discovered_names', JSON.stringify(discoveredNames));
        }
    }, [discoveredNames]);

    const [messageCache, setMessageCache] = useState<Record<string, any[]>>({});

    const updateMessageCache = (jid: string, newMessages: any[]) => {
        if (!jid) return;
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
            // 1. Fetch WA Contacts
            const contactsList = await api.fetchContacts();
            if (Array.isArray(contactsList)) setContacts(contactsList);

            // 2. Fetch CRM Customers
            const { data: dbCustomers } = await supabase.from('customers').select('name, phone');
            if (Array.isArray(dbCustomers)) setCustomers(dbCustomers);

            // 3. Identification Bridge
            if (Array.isArray(contactsList)) {
                const discovered: Record<string, string> = {};
                contactsList.forEach((c: any) => {
                    const jid = c.id || c.remoteJid;
                    const name = c.name || c.pushName;
                    if (jid && name && name.length > 1) {
                        if (name !== jid.split('@')[0]) discovered[jid] = name;
                    }
                });
                if (Object.keys(discovered).length > 0) {
                    setDiscoveredNames(prev => ({ ...prev, ...discovered }));
                }
            }
        } catch (err) { console.error("Sync error:", err); }
        finally { setIsSyncing(false); setHasAutoSynced(true); }
    };

    const setCustomName = (jid: string, name: string) => {
        setCustomNames(prev => {
            const next = { ...prev, [jid]: name };
            localStorage.setItem('evolution_custom_names', JSON.stringify(next));
            return next;
        });
    };

    const resolveName = useCallback((jid: string, fallback?: string) => {
        if (!jid) return fallback || "Desconhecido";
        let targetJid = jid;
        if (lidMapMemo && lidMapMemo[jid]) targetJid = lidMapMemo[jid];

        const phoneNumber = targetJid.split('@')[0];

        if (customNames[jid]) return customNames[jid];
        if (customNames[targetJid]) return customNames[targetJid];

        if (Array.isArray(customers)) {
            const dbMatch = customers.find(c => c.phone && String(c.phone).replace(/\D/g, '').includes(phoneNumber.replace(/\D/g, '')));
            if (dbMatch?.name) return dbMatch.name;
        }

        if (discoveredNames[jid]) return discoveredNames[jid];
        if (discoveredNames[targetJid]) return discoveredNames[targetJid];

        const formatted = formatPhoneNumber(targetJid);
        if (formatted && formatted.length > 5) return formatted;

        return phoneNumber || fallback || "Desconhecido";
    }, [lidMapMemo, contacts.length, customNames, discoveredNames, customers]);

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
        if (api) { checkStatus(); const interval = setInterval(checkStatus, 30000); return () => clearInterval(interval); }
    }, [api]);

    useEffect(() => {
        if (isConnected && !loading && api && !hasAutoSynced) autoSync();
    }, [isConnected, loading, api, hasAutoSynced]);

    const contextValue = useMemo(() => ({
        api, isConnected, instanceName, qrCode, pairingCode, loading, error, connect, disconnect, checkStatus,
        stats, setStats, isSyncing, autoSync, resolveName, discoveredNames, setDiscoveredNames, customNames,
        setCustomName, contacts, customers, messageCache, updateMessageCache, syncContacts
    }), [api, isConnected, instanceName, qrCode, pairingCode, loading, error, stats, isSyncing, contacts.length, customers.length, discoveredNames, customNames]);

    return (
        <EvolutionContext.Provider value={contextValue}>
            {children}
        </EvolutionContext.Provider>
    );
}

export function useEvolution() {
    const context = useContext(EvolutionContext);
    if (!context) throw new Error('useEvolution must be used within EvolutionProvider');
    return context;
}
