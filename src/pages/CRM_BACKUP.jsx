import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/api/supabaseClient'
import { base44 } from '@/api/base44Client'
import {
    Send, Search, User, ShoppingBag,
    MessageSquare, Check, CheckCheck,
    ChevronLeft, X, Loader2, MessageCircle,
    ExternalLink, Info, MoreVertical, RefreshCw, Sparkles
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { format, isToday, isYesterday, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

export default function CRM() {
    const queryClient = useQueryClient()
    const navigate = useNavigate()

    // State
    const [selectedPhone, setSelectedPhone] = useState(null)
    const [messageText, setMessageText] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [isSyncing, setIsSyncing] = useState(false)

    const messagesEndRef = useRef(null)
    const textareaRef = useRef(null)

    // Helper functions
    const formatPhoneDisplay = (phone) => {
        let s = String(phone || '').replace(/\D/g, '')
        if (s.startsWith('55')) s = s.slice(2)
        if (s.length === 11) return `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7)}`
        if (s.length === 10) return `(${s.slice(0, 2)}) ${s.slice(2, 6)}-${s.slice(6)}`
        return phone
    }

    const getPhoneVariants = (phone) => {
        if (!phone) return []
        const clean = String(phone).replace(/\D/g, '')
        const variants = new Set([clean])

        let base = clean
        if (clean.startsWith('55') && clean.length > 10) base = clean.slice(2)

        variants.add(base)
        variants.add('55' + base)

        if (base.length === 10) {
            const with9 = base.slice(0, 2) + '9' + base.slice(2)
            variants.add(with9)
            variants.add('55' + with9)
        } else if (base.length === 11 && base[2] === '9') {
            const without9 = base.slice(0, 2) + base.slice(3)
            variants.add(without9)
            variants.add('55' + without9)
        }
        return Array.from(variants)
    }

    // Fetch inbox from Evolution API via Proxy
    const { data: inbox = [], isLoading: isLoadingConv, refetch: refetchInbox } = useQuery({
        queryKey: ['inbox'],
        queryFn: async () => {
            const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: { action: 'fetch_inbox' }
            })
            if (error) {
                console.error('[CRM] Inbox fetch error:', error)
                throw error
            }
            return data?.chats || []
        }
    })

    // Fetch customers
    const { data: customers = [] } = useQuery({
        queryKey: ['customers'],
        queryFn: () => base44.entities.Customer.list()
    })

    // Enrich and group conversations by normalized phone to prevent duplicates in sidebar
    // Pure Inbox filter
    const filteredConversations = useMemo(() => {
        return inbox
            .map(chat => {
                const phone = chat.id.split('@')[0]
                const fallbackName = formatPhoneDisplay(phone)

                // Try to find in customers list
                const customer = customers.find(c => {
                    const cPhone = String(c.phone || '').replace(/\D/g, '')
                    return cPhone === phone || cPhone === phone.replace(/^55/, '')
                })

                return {
                    id: chat.id,
                    contact_phone: phone,
                    customerName: customer?.name || chat.pushName || chat.name || fallbackName,
                    content: chat.lastMessage?.content || chat.lastMessage?.text || 'Conversa ativa',
                    created_at: chat.updatedAt || chat.createdAt || chat.lastMsgTimestamp ? new Date((chat.lastMsgTimestamp || 0) * 1000).toISOString() : new Date().toISOString(),
                    jid: chat.id
                }
            })
            .filter(c =>
                !searchTerm ||
                String(c.customerName).toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(c.contact_phone).includes(searchTerm)
            )
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }, [inbox, searchTerm, customers])

    const activeConversation = useMemo(() =>
        filteredConversations.find(c => c.contact_phone === selectedPhone),
        [filteredConversations, selectedPhone]
    )

    // Fetch messages with variants
    const { data: messagesData = [], isLoading: isLoadingMsgs, refetch: refetchMsgs } = useQuery({
        queryKey: ['messages', selectedPhone],
        queryFn: async () => {
            if (!selectedPhone) return []
            const variants = getPhoneVariants(selectedPhone)
            const { data, error } = await supabase
                .from('whatsapp_messages')
                .select('*')
                .in('contact_phone', variants)
                .order('created_at', { ascending: true })
                .limit(1000)

            if (data) console.log(`[CRM] Fetched ${data.length} messages for variants:`, variants)

            if (error) throw error
            return data || []
        },
        enabled: !!selectedPhone
    })

    // Frontend Deduplication & Last Message Injection
    const messages = useMemo(() => {
        const seen = new Set()
        // Start with fetched messages
        const allMessages = [...messagesData]

        // Inject last known message from inbox if list is empty or doesn't verify injection
        if (activeConversation?.content && activeConversation.content !== 'Conversa ativa') {
            // Create a pseudo-message for the last content
            const lastMsg = {
                id: 'temp-last-' + activeConversation.jid,
                wa_message_id: 'last-' + activeConversation.jid,
                content: activeConversation.content,
                direction: 'inbound', // Assume inbound mostly for inbox read, or strictly unknown
                status: 'read',
                created_at: activeConversation.created_at,
                contact_phone: activeConversation.contact_phone
            }
            // Add if meaningful and distinct (basic check)
            allMessages.push(lastMsg)
        }

        const dedupped = allMessages.filter(m => {
            if (!m) return false

            // 1. Primary Check: Unique WhatsApp ID
            if (m.wa_message_id) {
                if (seen.has(m.wa_message_id)) return false
                seen.add(m.wa_message_id)
                return true
            }

            // 2. Secondary Check: Content + Timestamp
            const ts = m.created_at ? Math.floor(new Date(m.created_at).getTime() / 1000) : 0
            const contentKey = `${m.content}-${ts}-${m.direction}`

            if (seen.has(contentKey)) return false
            seen.add(contentKey)
            return true
        }).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

        console.log(`[CRM] Renderable: ${dedupped.length} (with injection)`)
        return dedupped
    }, [messagesData, activeConversation])

    // Sync Mutation
    const syncMutation = useMutation({
        mutationFn: async () => {
            if (!selectedPhone) return
            setIsSyncing(true)
            try {
                const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                    body: {
                        action: 'sync_chat', payload: {
                            phone: selectedPhone,
                            jid: activeConversation?.jid,
                            limit: 100
                        }
                    }
                })
                if (error) throw error
                return data
            } finally {
                setIsSyncing(false)
            }
        },
        onSuccess: (data) => {
            console.log('[CRM] Sync complete. Response:', data)
            if (data?.count > 0) {
                console.log(`[CRM] History found: ${data.count} messages (${data.newSaved} new saved)`)
            } else {
                console.warn('[CRM] No historical messages found for this contact.')
            }
            refetchMsgs()
            queryClient.invalidateQueries({ queryKey: ['inbox'] })
        }
    })

    // Sync Contacts Mutation
    const syncContactsMutation = useMutation({
        mutationFn: async () => {
            setIsSyncing(true)
            try {
                const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                    body: { action: 'fetch_contacts' }
                })
                if (error) throw error
                return data
            } finally {
                setIsSyncing(false)
            }
        },
        onSuccess: (data) => {
            console.log('[CRM] Contacts sync complete:', data)
            queryClient.invalidateQueries({ queryKey: ['customers'] })
            queryClient.invalidateQueries({ queryKey: ['inbox'] })
        },
        onError: (err) => {
            console.error('[CRM] Contacts sync failed:', err)
        }
    })

    // Realtime subscription
    useEffect(() => {
        if (!selectedPhone) return
        const variants = getPhoneVariants(selectedPhone)
        const channel = supabase
            .channel(`messages_${selectedPhone}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'whatsapp_messages'
            }, (payload) => {
                const newMsg = payload.new
                if (variants.includes(newMsg.contact_phone)) {
                    console.log('[CRM] New message for active chat:', newMsg)
                    refetchMsgs()
                }
                // Always refresh inbox to move conversation to top
                queryClient.invalidateQueries({ queryKey: ['inbox'] })
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [selectedPhone, refetchMsgs, queryClient])

    // Auto-scroll
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages])

    // Send message
    const sendMutation = useMutation({
        mutationFn: async (text) => {
            const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: {
                    action: 'send_message', payload: {
                        phone: selectedPhone,
                        jid: activeConversation?.jid,
                        message: text
                    }
                }
            })
            if (error) throw error
            return data
        },
        onSuccess: () => {
            setMessageText('')
            refetchMsgs()
            queryClient.invalidateQueries({ queryKey: ['inbox'] })
        }
    })

    const handleSend = () => {
        if (!messageText.trim() || !selectedPhone || sendMutation.isPending) return
        sendMutation.mutate(messageText)
    }

    // AI Suggestion Mutation
    const aiSuggestMutation = useMutation({
        mutationFn: async () => {
            const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: { action: 'ai_suggest', payload: { messages: messages.slice(-10) } }
            })
            if (error) throw error
            return data
        },
        onSuccess: (data) => {
            if (data?.suggestion) {
                setMessageText(data.suggestion)
                if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto'
                    textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
                }
            }
        }
    })

    // Message component
    const ChatMessage = ({ msg }) => {
        const isOut = msg.direction === 'outbound'
        const time = msg.created_at ? format(new Date(msg.created_at), 'HH:mm') : '--:--'

        return (
            <div className={cn("flex w-full mb-2", isOut ? "justify-end" : "justify-start")}>
                <div className={cn(
                    "max-w-[85%] md:max-w-[70%] px-3 py-2 rounded-2xl shadow-sm relative",
                    isOut ? "bg-emerald-600 text-white rounded-tr-none" : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
                )}>
                    {msg.media_url && (
                        <div className="mb-2 rounded overflow-hidden cursor-pointer" onClick={() => window.open(msg.media_url, '_blank')}>
                            <img src={msg.media_url} alt="Mídia" className="max-w-full h-auto object-cover max-h-64" />
                        </div>
                    )}
                    <div className="text-[14.5px] whitespace-pre-wrap break-words leading-relaxed overflow-hidden">
                        {msg.content}
                    </div>
                    <div className={cn("flex items-center gap-1 justify-end mt-1 text-[10px]", isOut ? "text-emerald-100" : "text-gray-400")}>
                        {time}
                        {isOut && (
                            <div className="ml-1">
                                {msg.status === 'read' ? <CheckCheck className="w-3 h-3 text-blue-300" /> : <Check className="w-3 h-3" />}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex fixed top-[64px] bottom-0 left-0 right-0 bg-[#F0F2F5] overflow-hidden z-20 w-full max-w-full">
            {/* Conversations List */}
            <div className="w-[350px] bg-white border-r border-gray-200 flex flex-col h-full shrink-0 overflow-hidden">
                <header className="p-4 bg-[#F0F2F5] flex flex-col gap-3 shrink-0">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-800">Mensagens</h2>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => syncContactsMutation.mutate()}
                            disabled={isSyncing || syncContactsMutation.isPending}
                            title="Sincronizar Contatos"
                            className="h-8 w-8 text-gray-500 hover:text-emerald-600"
                        >
                            <RefreshCw className={cn("w-4 h-4", (isSyncing || syncContactsMutation.isPending) && "animate-spin")} />
                        </Button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar..." className="pl-9 bg-white" />
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto">
                    {isLoadingConv ? (
                        <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
                    ) : filteredConversations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400">
                            <MessageSquare className="w-12 h-12 mb-2 opacity-20" /><p className="text-sm">Nenhuma conversa encontrada</p>
                        </div>
                    ) : filteredConversations.map((conv) => (
                        <div key={conv.id || conv.contact_phone} onClick={() => setSelectedPhone(conv.contact_phone)}
                            className={cn("flex items-center gap-3 p-3 cursor-pointer transition-all border-b border-gray-100 hover:bg-gray-50", selectedPhone === conv.contact_phone && "bg-gray-100")}>
                            <Avatar className="h-12 w-12 shrink-0"><AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(conv.customerName)}&background=random`} /><AvatarFallback>{conv.customerName[0]}</AvatarFallback></Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5"><h3 className="text-[15px] font-semibold text-gray-900 truncate">{conv.customerName}</h3><span className="text-[11px] text-gray-400">{conv.created_at ? format(new Date(conv.created_at), 'HH:mm') : ''}</span></div>
                                <p className="text-sm text-gray-500 truncate">{conv.content}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col h-full bg-[#E5DDD5] min-w-0 overflow-hidden">
                {!selectedPhone ? (
                    <div className="flex-1 flex flex-col items-center justify-center bg-[#F8F9FA] text-center p-4">
                        <MessageCircle className="w-32 h-32 text-gray-300 mb-6" />
                        <h2 className="text-2xl font-light text-gray-600 mb-2">Selecione uma conversa</h2>
                        <p className="text-gray-400">Escolha um contato para começar a conversar</p>
                    </div>
                ) : (
                    <>
                        <header className="h-[64px] bg-[#F0F2F5] flex items-center justify-between px-4 border-b border-gray-200 shrink-0 min-w-0 shadow-sm">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <Avatar className="h-10 w-10 shrink-0"><AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(activeConversation?.customerName || '')}&background=random`} /></Avatar>
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-[15px] font-bold text-gray-900 truncate leading-tight">{activeConversation?.customerName}</h3>
                                    <p className="text-[11px] text-gray-400 truncate">{formatPhoneDisplay(selectedPhone)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Button variant="ghost" size="icon" onClick={() => syncMutation.mutate()} disabled={isSyncing} title="Sincronizar Histórico" className="hover:bg-gray-200 rounded-full">
                                    <RefreshCw className={cn("w-5 h-5 text-gray-600", isSyncing && "animate-spin")} />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => window.open(`https://wa.me/${selectedPhone.replace(/\D/g, '')}`, '_blank')} className="hover:bg-gray-200 rounded-full"><ExternalLink className="w-5 h-5 text-gray-600" /></Button>
                            </div>
                        </header>

                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-0.5 custom-scrollbar bg-chat-pattern">
                            {isLoadingMsgs ? (
                                <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
                            ) : messages.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-gray-500 bg-white/50 m-4 rounded-xl p-8 text-center italic">Nenhuma mensagem encontrada. Use o botão 🔄 no topo para sincronizar.</div>
                            ) : (
                                <>
                                    {messages.map((msg, i) => {
                                        const prev = messages[i - 1]
                                        const msgDate = msg.created_at ? new Date(msg.created_at) : null
                                        const prevDate = prev?.created_at ? new Date(prev.created_at) : null
                                        const showDate = msgDate && (!prevDate || !isSameDay(msgDate, prevDate))

                                        return (
                                            <React.Fragment key={msg.id || `temp-${i}`}>
                                                {showDate && (
                                                    <div className="flex justify-center my-4 sticky top-0 z-10">
                                                        <span className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-[11px] font-bold text-gray-500 shadow-sm">
                                                            {isToday(msgDate) ? 'Hoje' : isYesterday(msgDate) ? 'Ontem' : format(msgDate, "d 'de' MMMM", { locale: ptBR })}
                                                        </span>
                                                    </div>
                                                )}
                                                <ChatMessage msg={msg} />
                                            </React.Fragment>
                                        )
                                    })}
                                    <div ref={messagesEndRef} className="h-4 shrink-0" />
                                </>
                            )}
                        </div>

                        <footer className="p-3 bg-[#F0F2F5] border-t border-gray-200 shrink-0">
                            <div className="flex items-end gap-3 max-w-4xl mx-auto">
                                <div className="flex flex-1 items-end bg-white rounded-xl shadow-sm p-1.5 border border-gray-200 focus-within:border-emerald-500 transition-colors">
                                    <Textarea ref={textareaRef} value={messageText} onChange={e => {
                                        setMessageText(e.target.value)
                                        e.target.style.height = 'auto'
                                        e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px'
                                    }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                        placeholder="Digite uma mensagem..." className="flex-1 border-none focus-visible:ring-0 min-h-[40px] max-h-[150px] resize-none py-2 px-3 text-[15px]" />

                                    <Button variant="ghost" size="icon" onClick={() => aiSuggestMutation.mutate()} disabled={aiSuggestMutation.isPending || !selectedPhone}
                                        className={cn("h-10 w-10 text-amber-500 hover:bg-amber-50 hover:text-amber-600 rounded-lg shrink-0", aiSuggestMutation.isPending && "animate-pulse")}>
                                        {aiSuggestMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                    </Button>
                                </div>
                                <Button onClick={handleSend} disabled={!messageText.trim() || !selectedPhone || sendMutation.isPending} className="h-[52px] w-[52px] rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-md transition-all active:scale-95 shrink-0">
                                    {sendMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : <Send className="w-6 h-6 text-white" />}
                                </Button>
                            </div>
                        </footer>
                    </>
                )}
            </div>
            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
                .bg-chat-pattern { background-image: url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png"); background-size: 400px; background-attachment: fixed; }
            `}} />
        </div>
    )
}
