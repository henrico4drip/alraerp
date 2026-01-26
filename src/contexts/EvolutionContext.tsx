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
    customers: any[]; // New: List of registered customers from ERP DB
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
        try {
            return saved ? JSON.parse(saved) : { contacts: 0, chats: 0, messages: 0 };
        } catch {
            return { contacts: 0, chats: 0, messages: 0 };
        }
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
        try {
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    const lidMapMemo = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem('lid_mappings') || '{}');
        } catch (e) { return {}; }
    }, [isSyncing, contacts]);

    const [customNames, setCustomNames] = useState<Record<string, string>>(() => {
        const saved = localStorage.getItem('evolution_custom_names');
        try {
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    const setCustomName = (jid: string, name: string) => {
        setCustomNames(prev => {
            const next = { ...prev, [jid]: name };
            localStorage.setItem('evolution_custom_names', JSON.stringify(next));
            return next;
        });
    };

    useEffect(() => {
        localStorage.setItem('evolution_discovered_names', JSON.stringify(discoveredNames));
    }, [discoveredNames]);

    const [messageCache, setMessageCache] = useState<Record<string, any[]>>({});

    const updateMessageCache = (jid: string, newMessages: any[]) => {
        setMessageCache(prev => {
            const existing = prev[jid] || [];
            if (JSON.stringify(existing) === JSON.stringify(newMessages)) return prev;
            return { ...prev, [jid]: newMessages };
        });
    };

    useEffect(() => {
        if (!user?.id) {
            setApi(null);
            return;
        }

        console.log(`[EvolutionContext] Initializing API for instance ${instanceName}`);
        setApi(new EvolutionAPI(
            import.meta.env.VITE_EVOLUTION_API_URL || '',
            import.meta.env.VITE_EVOLUTION_API_KEY || 'Henrico9516',
            instanceName,
            supabase
        ));
    }, [user?.id, instanceName]);

    const checkStatus = async () => {
        if (!api || !instanceName) return;
        try {
            const status = await api.getInstanceStatus();
            const rawState = status?.instance?.state || status?.state || status?.status || status?.instance?.status || "";
            const state = typeof rawState === 'string' ? rawState.toUpperCase() : "";
            const connected = state === 'OPEN' || state === 'CONNECTED' || state === 'ISLOGGED';
            setIsConnected(connected);
            if (connected) {
                setQrCode(null);
                setPairingCode(null);
            }
            setError(null);
        } catch (err: any) {
            setIsConnected(false);
            if (err.message?.includes('404') || err.message?.includes('not found')) {
                // Ignore 404s for status checks (instance not created yet)
            } else {
                setError(err.message);
            }
        }
    };

    const connect = async () => {
        if (!api || !instanceName) return;
        setLoading(true);
        setError(null);
        try {
            const qrData = await api.getQRCode();
            const rawBase64 = qrData?.base64 || qrData?.instance?.qrcode?.base64 || qrData?.qrcode?.base64;
            const rawCode = qrData?.code || qrData?.instance?.qrcode?.code || qrData?.qrcode?.code || (typeof qrData === 'string' ? qrData : null);
            const rawPairing = qrData?.pairingCode || qrData?.instance?.qrcode?.pairingCode || qrData?.qrcode?.pairingCode;

            if (rawBase64) {
                setQrCode(String(rawBase64).startsWith('data:image') ? rawBase64 : `data:image/png;base64,${rawBase64}`);
                setPairingCode(null);
            } else if (rawCode) {
                const img = await QRCode.toDataURL(String(rawCode));
                setQrCode(img);
                setPairingCode(null);
            }

            if (rawPairing) setPairingCode(String(rawPairing));

            const rawConnState = qrData?.status || qrData?.instance?.state || "";
            const state = typeof rawConnState === 'string' ? rawConnState.toUpperCase() : "";
            if (state === 'CONNECTED' || state === 'OPEN') {
                setIsConnected(true);
                setQrCode(null);
                setPairingCode(null);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const autoSync = async () => {
        if (!api || !isConnected || isSyncing) return;
        setIsSyncing(true);
        try {
            console.log("[EvolutionContext] Running deep auto-sync (DB + WA)...");

            // 1. Fetch DB Customers (Priority 1)
            const { data: dbCustomers } = await supabase.from('customers').select('name, phone');
            const customerList = dbCustomers || [];
            setCustomers(customerList);

            // 2. Fetch WA Contacts
            const contactsRes = await api.fetchContacts();
            const contactsList = Array.isArray(contactsRes) ? contactsRes : [];
            setContacts(contactsList);

            // 3. Discovery with Priority
            const discovered: Record<string, string> = {};
            const invalidNames = ['Você', 'You', 'Eu', 'Me', 'Desconhecido', 'Unknown', 'Null', 'Undefined'];

            contactsList.forEach((c: any) => {
                const jid = c.id || c.remoteJid || c.jid;
                const phone = jid.split('@')[0];

                // Priority: Check DB Match first
                const dbMatch = customerList.find((db: any) =>
                    db.phone?.replace(/\D/g, '').includes(phone.replace(/\D/g, ''))
                );

                const name = dbMatch?.name || c.name || c.pushName || c.verifiedName;
                if (jid && name) {
                    const cleanName = String(name).trim();
                    const isNotPhone = cleanName !== phone;
                    const isNotInvalid = !invalidNames.some(inv => cleanName.toLowerCase() === inv.toLowerCase());
                    if (isNotPhone && isNotInvalid && cleanName.length > 1) {
                        discovered[jid] = cleanName;
                    }
                }
            });

            if (Object.keys(discovered).length > 0) {
                setDiscoveredNames(prev => ({ ...prev, ...discovered }));
            }
        } catch (err) {
            console.error("Auto sync error:", err);
        } finally {
            setIsSyncing(false);
            setHasAutoSynced(true);
        }
    };

    const syncContacts = async () => {
        if (!api || !isConnected) return;
        try {
            return await api.syncContacts();
        } catch (e) {
            console.error("Sync contacts error:", e);
        }
    };

    const disconnect = async () => {
        if (!api) return;
        setLoading(true);
        setError(null);
        try {
            await api.logoutInstance();
            setIsConnected(false);
            setQrCode(null);
            setPairingCode(null);
            setHasAutoSynced(false);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (api) {
            checkStatus();
            const interval = setInterval(checkStatus, 15000);
            return () => clearInterval(interval);
        }
    }, [api]);

    useEffect(() => {
        if (isConnected && !loading && api && !hasAutoSynced) {
            autoSync();
        }
    }, [isConnected, loading, api, hasAutoSynced]);

    const resolveName = useCallback((jid: string, fallback?: string) => {
        if (!jid) return fallback || "Desconhecido";
        let targetJid = jid;
        if (lidMapMemo[jid]) targetJid = lidMapMemo[jid];

        const contact = contacts.find(c => {
            const cid = c.id || c.remoteJid || "";
            return isSameJid(cid, targetJid) || (jid !== targetJid && isSameJid(cid, jid));
        });

        const phoneNumber = targetJid.split('@')[0];

        // Check DB Customer List (High priority for cross-device naming)
        const dbContact = customers.find(cust =>
            cust.phone?.replace(/\D/g, '').includes(phoneNumber.replace(/\D/g, ''))
        );

        const candidates = [
            customNames[jid],
            customNames[targetJid],
            dbContact?.name,
            contact?.name,
            discoveredNames[jid],
            discoveredNames[targetJid],
            fallback,
            contact?.pushName,
            contact?.pushname
        ];

        for (let name of candidates) {
            if (name && typeof name === 'string' && name.length >= 2) {
                const clean = name.trim();
                const isId = clean.includes('240605') || clean === phoneNumber || clean === jid.split('@')[0];
                const isInvalid = ['desconhecido', 'unknown', 'undefined', 'null'].includes(clean.toLowerCase());
                if (!isId && !isInvalid) return clean.startsWith('~') ? clean.substring(1).trim() : clean;
            }
        }

        const cleanJid = targetJid.split('@')[0];
        const formatted = formatPhoneNumber(targetJid);
        const isFallbackValid = fallback && !['desconhecido', 'unknown', 'undefined', 'null'].includes(String(fallback).toLowerCase());

        if (isFallbackValid) return fallback!;
        if (formatted && formatted.length > 5) return formatted;
        if (cleanJid) return cleanJid;

        return "Desconhecido";
    }, [lidMapMemo, contacts, customNames, discoveredNames]);

    return (
        <EvolutionContext.Provider
            value={{
                api,
                isConnected,
                instanceName,
                qrCode,
                pairingCode,
                loading,
                error,
                connect,
                disconnect,
                checkStatus,
                stats,
                setStats,
                isSyncing,
                autoSync,
                resolveName,
                discoveredNames,
                setDiscoveredNames,
                customNames,
                setCustomName,
                contacts,
                customers,
                messageCache,
                updateMessageCache,
                syncContacts
            }}
        >
            {children}
        </EvolutionContext.Provider>
    );
}

export function useEvolution() {
    const context = useContext(EvolutionContext);
    if (!context) {
        throw new Error('useEvolution must be used within EvolutionProvider');
    }
    return context;
}
