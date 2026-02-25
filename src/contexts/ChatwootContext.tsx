import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { chatwootApi } from '../lib/chatwoot';
import { toast } from 'sonner';

interface ChatwootContextType {
    conversations: any[];
    messages: Record<number, any[]>;
    isLoading: boolean;
    activeConversationId: number | null;
    setActiveConversationId: (id: number | null) => void;
    fetchConversations: (status?: 'open' | 'resolved' | 'all') => Promise<void>;
    loadMoreConversations: () => Promise<void>;
    fetchMessages: (conversationId: number) => Promise<void>;
    loadMoreMessages: (conversationId: number) => Promise<void>;
    sendMessage: (conversationId: number, content: string) => Promise<void>;
    sendFile: (conversationId: number, file: File, caption?: string) => Promise<void>;
    resolveConversation: (conversationId: number) => Promise<void>;
    deleteConversation: (conversationId: number) => Promise<void>;
    syncEvolutionHistory: () => Promise<void>;
    isSyncingHistory: boolean;
    isFetchingHistory: boolean;
    isFetchingMoreConvos: boolean;
    hasMoreConversations: boolean;
    hasMoreMessages: Record<number, boolean>;
}

const ChatwootContext = createContext<ChatwootContextType | null>(null);

export const useChatwoot = () => {
    const context = useContext(ChatwootContext);
    if (!context) {
        throw new Error('useChatwoot must be used within a ChatwootProvider');
    }
    return context;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract a normalized phone number from a conversation's sender metadata.
 * Now relies on Chatwoot + Evolution API to provide correct phone data natively.
 */
function extractPhone(convo: any): string | null {
    const sender = convo?.meta?.sender || {};
    const raw = sender.phone_number || sender.identifier || '';
    if (!raw) return null;
    return normalizePhone(raw);
}

function normalizePhone(raw: string): string | null {
    let digits = raw.split('@')[0].replace(/\D/g, '');

    // Normalize Brazilian 9th digit: 13 digits with 9 at position 4 → remove it
    if (digits.startsWith('55') && digits.length === 13 && digits[4] === '9') {
        digits = '55' + digits.substring(2, 4) + digits.substring(5);
    }

    return digits.length >= 10 ? digits : null;
}

/**
 * Simple deduplication: group conversations by normalized phone.
 * Keep the most recent conversation and merge unread counts.
 */
function deduplicateConversations(rawList: any[]): any[] {
    const convoMap = new Map<string, any>();

    const sorted = [...rawList].sort((a, b) =>
        new Date(b.last_activity_at || 0).getTime() - new Date(a.last_activity_at || 0).getTime()
    );

    for (const convo of sorted) {
        const phone = extractPhone(convo);
        const identifier = convo?.meta?.sender?.identifier || '';
        const key = phone || identifier || `id_${convo.id}`;

        const existing = convoMap.get(key);
        if (!existing) {
            convoMap.set(key, {
                ...convo,
                _mergedUnread: convo.unread_count || 0
            });
        } else {
            const totalUnread = (existing._mergedUnread || 0) + (convo.unread_count || 0);

            if (new Date(convo.last_activity_at || 0) > new Date(existing.last_activity_at || 0)) {
                convoMap.set(key, { ...convo, _mergedUnread: totalUnread });
            } else {
                convoMap.set(key, { ...existing, _mergedUnread: totalUnread });
            }
        }
    }

    return Array.from(convoMap.values());
}

function deduplicateMessages(msgList: any[]): any[] {
    const seen = new Set<string>();
    return msgList.filter(m => {
        if (m.id) {
            const key = `id_${m.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
        }
        if (m.source_id) {
            const key = `src_${m.source_id}`;
            if (seen.has(key)) return false;
            seen.add(key);
        }
        if (!m.id && !m.source_id && m.content) {
            const key = `tmp_${m.content}_${m.created_at}`;
            if (seen.has(key)) return false;
            seen.add(key);
        }
        return true;
    });
}

/**
 * Parse Chatwoot API response into an array, handling all known response formats.
 */
function parseConvoResponse(response: any): any[] {
    const result: any = response?.data || response;
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.payload)) return result.payload;
    if (Array.isArray(result?.data)) return result.data;
    if (Array.isArray(result?.data?.payload)) return result.data.payload;
    if (result?.data && typeof result.data === 'object') return result.data.payload || [];
    return [];
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const ChatwootProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [conversations, setConversations] = useState<any[]>([]);
    const [messages, setMessages] = useState<Record<number, any[]>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncingHistory, setIsSyncingHistory] = useState(false);
    const [isFetchingHistory, setIsFetchingHistory] = useState(false);
    const [isFetchingMoreConvos, setIsFetchingMoreConvos] = useState(false);
    const [hasMoreConversations, setHasMoreConversations] = useState(true);
    const [currentConvoPage, setCurrentConvoPage] = useState(1);
    const [hasMoreMessages, setHasMoreMessages] = useState<Record<number, boolean>>({});
    const [activeConversationId, setActiveConversationId] = useState<number | null>(null);

    const fetchConversations = useCallback(async (status: 'open' | 'resolved' | 'all' = 'open') => {
        setIsLoading(true);
        try {
            const response = await chatwootApi.getConversations(status);
            const convoList = parseConvoResponse(response);
            const deduped = deduplicateConversations(convoList);
            setConversations(deduped);
            setCurrentConvoPage(1);
            setHasMoreConversations(convoList.length >= 20);
        } catch (error) {
            console.error('[ChatwootContext] Failed to fetch conversations', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const loadMoreConversations = useCallback(async () => {
        if (isFetchingMoreConvos || !hasMoreConversations) return;

        try {
            setIsFetchingMoreConvos(true);
            const nextPage = currentConvoPage + 1;

            const response = await chatwootApi.getConversations('open', nextPage);
            const convoList = parseConvoResponse(response);

            if (convoList.length === 0) {
                setHasMoreConversations(false);
                return;
            }

            setConversations(prev => {
                const combined = [...prev, ...convoList];
                return deduplicateConversations(combined);
            });

            setCurrentConvoPage(nextPage);
            if (convoList.length < 15) {
                setHasMoreConversations(false);
            }
        } catch (error) {
            console.error('[ChatwootContext] Failed to load more conversations', error);
        } finally {
            setIsFetchingMoreConvos(false);
        }
    }, [currentConvoPage, isFetchingMoreConvos, hasMoreConversations]);

    const fetchMessages = useCallback(async (conversationId: number) => {
        try {
            const response = await chatwootApi.getAllMessages(conversationId);
            let msgList = parseConvoResponse(response);
            msgList = deduplicateMessages(msgList);

            // Sort by created_at (most reliable for order) then ID
            msgList.sort((a, b) => {
                const timeA = a.created_at || 0;
                const timeB = b.created_at || 0;
                if (timeA !== timeB) return timeA - timeB;
                return (a.id || 0) - (b.id || 0);
            });

            setMessages(prev => ({ ...prev, [conversationId]: msgList }));
            if (msgList.length >= 20) {
                setHasMoreMessages(prev => ({ ...prev, [conversationId]: true }));
            }
        } catch (error) {
            console.error(`[ChatwootContext] Failed to fetch messages for ${conversationId}`, error);
        }
    }, []);

    const loadMoreMessages = useCallback(async (conversationId: number) => {
        if (isFetchingHistory) return;

        try {
            setIsFetchingHistory(true);
            const currentMsgs = messages[conversationId] || [];
            const firstMsg = currentMsgs[0];
            const firstMsgId = firstMsg?.id;

            if (!firstMsgId) {
                setIsFetchingHistory(false);
                return;
            }

            const response = await chatwootApi.getMessages(conversationId, firstMsgId);
            let moreMsgs = parseConvoResponse(response);

            if (moreMsgs.length === 0) {
                setHasMoreMessages(prev => ({ ...prev, [conversationId]: false }));
                return;
            }

            setMessages(prev => {
                const existing = prev[conversationId] || [];
                const combined = [...moreMsgs, ...existing];
                const clean = deduplicateMessages(combined);
                return {
                    ...prev,
                    [conversationId]: clean.sort((a, b) => {
                        const timeA = a.created_at || 0;
                        const timeB = b.created_at || 0;
                        if (timeA !== timeB) return timeA - timeB;
                        return (a.id || 0) - (b.id || 0);
                    })
                };
            });

            if (moreMsgs.length < 20) {
                setHasMoreMessages(prev => ({ ...prev, [conversationId]: false }));
            }
        } catch (error) {
            console.error(`[ChatwootContext] Load more error:`, error);
        } finally {
            setIsFetchingHistory(false);
        }
    }, [messages, isFetchingHistory]);

    const sendMessage = useCallback(async (conversationId: number, content: string) => {
        try {
            const response = await chatwootApi.sendMessage(conversationId, content);
            const newMessageData = (response as any).data;
            if (newMessageData && newMessageData.id) {
                setMessages(prev => {
                    const existing = prev[conversationId] || [];
                    return { ...prev, [conversationId]: [...existing, newMessageData] };
                });
            }
        } catch (error) {
            console.error(`[ChatwootContext] Error sending message:`, error);
            throw error;
        }
    }, []);

    const sendFile = useCallback(async (conversationId: number, file: File, caption?: string) => {
        try {
            // Placeholder: We need to implement file upload in chatwootApi first
            const response = await (chatwootApi as any).sendAttachment(conversationId, file, caption);
            const newMessageData = (response as any).data;
            if (newMessageData && newMessageData.id) {
                setMessages(prev => {
                    const existing = prev[conversationId] || [];
                    return { ...prev, [conversationId]: [...existing, newMessageData] };
                });
            }
        } catch (error) {
            console.error(`[ChatwootContext] Error sending file:`, error);
            throw error;
        }
    }, []);

    const resolveConversation = useCallback(async (conversationId: number) => {
        try {
            await chatwootApi.toggleStatus(conversationId, 'resolved');
            setConversations(prev => prev.filter(c => c.id !== conversationId));
            if (activeConversationId === conversationId) setActiveConversationId(null);
            toast.success('Conversa arquivada com sucesso.');
        } catch (error) {
            console.error(`[ChatwootContext] Error resolving:`, error);
            toast.error('Erro ao arquivar conversa.');
        }
    }, [activeConversationId]);

    const deleteConversation = useCallback(async (conversationId: number) => {
        try {
            await chatwootApi.deleteConversation(conversationId);
            setConversations(prev => prev.filter(c => c.id !== conversationId));
            if (activeConversationId === conversationId) setActiveConversationId(null);
            toast.success('Conversa deletada permanentemente.');
        } catch (error) {
            console.error(`[ChatwootContext] Error deleting:`, error);
            toast.error('Erro ao deletar conversa.');
        }
    }, [activeConversationId]);

    const syncEvolutionHistory = useCallback(async () => {
        setIsSyncingHistory(true);
        try {
            const { supabase } = await import('@/api/supabaseClient');
            const { error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: { action: 'connect' }
            });

            if (error) throw error;
            toast.success('Sincronização iniciada! Verifique as conversas em instantes. 🚀');

            setTimeout(() => fetchConversations('open'), 3000);
            setTimeout(() => fetchConversations('open'), 10000);
        } catch (err) {
            console.error('[ChatwootContext] Sync history error:', err);
            toast.error('Erro ao iniciar sincronização de histórico.');
        } finally {
            setIsSyncingHistory(false);
        }
    }, [fetchConversations]);

    useEffect(() => {
        if (activeConversationId) {
            fetchMessages(activeConversationId);
        }
    }, [activeConversationId, fetchMessages]);

    // Initial fetch + periodic refresh
    useEffect(() => {
        fetchConversations('open');

        const interval = setInterval(() => {
            fetchConversations('open');
            if (activeConversationId) fetchMessages(activeConversationId);
        }, 15000);
        return () => clearInterval(interval);
    }, [fetchConversations, fetchMessages, activeConversationId]);

    // Auto-archive system/noise conversations
    useEffect(() => {
        const systemConvos = conversations.filter(c => {
            const name = (c.meta?.sender?.name || '').toLowerCase();
            const contactName = (c.meta?.sender?.push_name || '').toLowerCase();
            return name.includes('evolutionapi') || contactName.includes('evolutionapi');
        });

        if (systemConvos.length > 0) {
            const clean = async () => {
                for (const c of systemConvos) {
                    try {
                        await resolveConversation(c.id);
                    } catch (e) {
                        console.error(`[ChatwootContext] Failed to auto-resolve ${c.id}:`, e);
                    }
                }
            };
            clean();
        }
    }, [conversations, resolveConversation]);

    return (
        <ChatwootContext.Provider
            value={{
                conversations,
                messages,
                isLoading,
                activeConversationId,
                setActiveConversationId,
                fetchConversations,
                loadMoreConversations,
                fetchMessages,
                loadMoreMessages,
                sendMessage,
                sendFile,
                resolveConversation,
                deleteConversation,
                syncEvolutionHistory,
                isSyncingHistory,
                isFetchingHistory,
                isFetchingMoreConvos,
                hasMoreConversations,
                hasMoreMessages,
            }}
        >
            {children}
        </ChatwootContext.Provider>
    );
};
