import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/api/supabaseClient'
import { base44 } from '@/api/base44Client'
import {
    Send, Search, Phone, User, ShoppingBag, DollarSign,
    Calendar, RefreshCw, Brain, Sparkles, TrendingUp,
    CheckCircle2, Clock, Trophy, EyeOff, Loader2,
    MoreVertical, Info, MessageSquare, Image as ImageIcon,
    FileText, Mic, Video, Check, CheckCheck, Filter,
    ChevronLeft, UserPlus, Link as LinkIcon, AlertCircle,
    X, ArrowDown, ExternalLink, MessageCircle
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogTrigger, DialogFooter
} from '@/components/ui/dialog'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { format, isToday, isYesterday, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs) {
    return twMerge(clsx(inputs))
}

export default function CRM() {
    // console.log("[CRM] Component initializing...");
    const queryClient = useQueryClient()
    const navigate = useNavigate()

    // --- State ---
    const [selectedPhone, setSelectedPhone] = useState(null)
    const [messageText, setMessageText] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [filterStatus, setFilterStatus] = useState('all')
    const [showDetails, setShowDetails] = useState(true)
    const [isSyncing, setIsSyncing] = useState(false)
    const [isSyncingChat, setIsSyncingChat] = useState(false)
    const [isRerankingAll, setIsRerankingAll] = useState(false)
    const [isRegistering, setIsRegistering] = useState(false)
    const [isLinking, setIsLinking] = useState(false)
    const [newCustomerName, setNewCustomerName] = useState('')
    const [linkSearch, setLinkSearch] = useState('')

    const messagesEndRef = useRef(null)
    const chatContainerRef = useRef(null)
    const textareaRef = useRef(null)

    // --- Helpers ---
    const normalizeForMatch = (phone) => {
        let s = String(phone || '').replace(/\D/g, '')
        if (s.length > 13) return null
        if (s.startsWith('55') && s.length > 10) s = s.slice(2)
        if (s.length === 11 && s[2] === '9') s = s.slice(0, 2) + s.slice(3)
        if (s.length < 8) return null
        return s
    }

    const formatPhoneDisplay = (phone) => {
        let s = String(phone || '').replace(/\D/g, '')
        if (s.length > 14) return 'ID: ' + s.slice(0, 6) + '...'
        if (s.startsWith('55')) s = s.slice(2)
        if (s.length === 11) return `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7)}`
        if (s.length === 10) return `(${s.slice(0, 2)}) ${s.slice(2, 6)}-${s.slice(6)}`
        return phone
    }

    // --- Queries ---
    const { data: settings = {} } = useQuery({
        queryKey: ['settings'],
        queryFn: async () => {
            const list = await base44.entities.Settings.list()
            return list[0] || {}
        }
    })

    const hiddenPhones = settings.whatsapp_hidden_phones || []

    const { data: conversations = [], isLoading: isLoadingConv } = useQuery({
        queryKey: ['whatsapp_conversations'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('distinct_chats')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(200)

            if (error) throw error

            const map = new Map()
            data.forEach(msg => {
                const norm = normalizeForMatch(msg.contact_phone)
                if (!norm) return
                if (!map.has(norm)) {
                    map.set(norm, { ...msg, relatedPhones: new Set([msg.contact_phone]) })
                } else {
                    const existing = map.get(norm)
                    existing.relatedPhones.add(msg.contact_phone)
                    if ((!existing.contact_name || existing.contact_name === existing.contact_phone) && msg.contact_name && msg.contact_name !== msg.contact_phone) {
                        existing.contact_name = msg.contact_name
                    }
                    if (new Date(msg.created_at) > new Date(existing.created_at)) {
                        existing.created_at = msg.created_at
                        existing.content = msg.content
                        existing.direction = msg.direction
                    }
                }
            })

            return Array.from(map.values()).map(c => ({
                ...c,
                relatedPhones: Array.from(c.relatedPhones)
            }))
        }
    })

    const { data: customers = [] } = useQuery({
        queryKey: ['customers'],
        queryFn: () => base44.entities.Customer.list(),
        initialData: []
    })

    // Enriched Logic
    const enrichedConversations = useMemo(() => {
        let mapped = conversations.map(conv => {
            const convMatch = normalizeForMatch(conv.contact_phone)
            const customer = customers.find(c => normalizeForMatch(c.phone) === convMatch)

            return {
                ...conv,
                customerName: customer?.name || conv.contact_name || formatPhoneDisplay(conv.contact_phone),
                customerData: customer,
                aiScore: customer?.ai_score || 0,
                isWaiting: conv.direction === 'inbound'
            }
        }).filter(c => !hiddenPhones.includes(normalizeForMatch(c.contact_phone)))

        // Filter logic
        if (filterStatus === 'waiting') mapped = mapped.filter(c => c.isWaiting)
        if (filterStatus === 'ai') mapped = mapped.filter(c => c.aiScore > 70)

        if (searchTerm) {
            mapped = mapped.filter(c =>
                c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.contact_phone.includes(searchTerm)
            )
        }

        return mapped.sort((a, b) => {
            if (filterStatus === 'ai') return b.aiScore - a.aiScore
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
    }, [conversations, customers, searchTerm, filterStatus, hiddenPhones])

    const activeConversation = enrichedConversations.find(c => c.contact_phone === selectedPhone)
    const activeCustomer = activeConversation?.customerData

    // --- Messages Infinite Query ---
    // --- Messages Infinite Query (Final Stability Fix) ---
    const messagesQuery = useInfiniteQuery({
        queryKey: ['messages_crm_v3', selectedPhone], // Unique key to force fresh state
        queryFn: async ({ pageParam = 0 }) => {
            if (!selectedPhone) return []
            try {
                // Broaden search to include all possible variations of the phone (55, 9th digit, etc)
                const variants = new Set(activeConversation?.relatedPhones || [])
                const base = String(selectedPhone).replace(/\D/g, '')
                variants.add(base)

                // Add standard Brazilian variants
                if (base.startsWith('55')) variants.add(base.slice(2))
                else variants.add('55' + base)

                // Handle 9th digit for all currently known variants
                Array.from(variants).forEach(v => {
                    const is55 = v.startsWith('55')
                    const p = is55 ? v.slice(2) : v
                    if (p.length === 10) variants.add((is55 ? '55' : '') + p.slice(0, 2) + '9' + p.slice(2))
                    else if (p.length === 11 && p[2] === '9') variants.add((is55 ? '55' : '') + p.slice(0, 2) + p.slice(3))
                })

                const phonesToFetch = Array.from(variants)

                console.log('[CRM] Fetching messages for phone variants:', phonesToFetch)

                const { data, error } = await supabase
                    .from('whatsapp_messages')
                    .select('*')
                    .in('contact_phone', phonesToFetch)
                    .order('created_at', { ascending: false })
                    .range(pageParam, pageParam + 49)

                if (error) throw error
                console.log(`[CRM] Query returned ${data?.length || 0} messages for offset ${pageParam}`)
                return data || []
            } catch (err) {
                console.error('[CRM] Data Fetch Error:', err)
                return []
            }
        },
        initialPageParam: 0,
        getNextPageParam: (lPage, _aPages, lPageParam) => {
            // Using lPage for lastPage and _aPages to avoid 'pages' name collision if internal
            if (!lPage || !Array.isArray(lPage) || lPage.length < 50) return undefined
            return (lPageParam || 0) + 50
        },
        enabled: !!selectedPhone,
        staleTime: 1000 * 60 // 1 minute stale time
    })

    const msgsStableData = messagesQuery.data
    const isLoadingMsgs = messagesQuery.isLoading
    const fetchNextPage = messagesQuery.fetchNextPage
    const hasNextPage = messagesQuery.hasNextPage
    const isFetchingNextPage = messagesQuery.isFetchingNextPage
    const refetchMsgs = messagesQuery.refetch

    const messages = useMemo(() => {
        console.log('[CRM] Processing messages. msgsStableData:', msgsStableData)

        // Extreme defensive check for msgsStableData shape
        if (!msgsStableData || !msgsStableData.pages || !Array.isArray(msgsStableData?.pages)) {
            console.log('[CRM] No pages data, returning empty array')
            return []
        }

        const pagesArray = msgsStableData.pages
        if (!Array.isArray(pagesArray)) {
            console.log('[CRM] pagesArray is not an array, returning empty')
            return []
        }

        const flattened = pagesArray.flat().filter(Boolean)
        console.log(`[CRM] Flattened ${flattened.length} messages from ${pagesArray.length} pages`)

        const chronological = [...flattened].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )

        const filtered = []
        const seenIds = new Set()
        let skippedCount = 0

        chronological.forEach((m, idx) => {
            if (!m) {
                skippedCount++
                return
            }

            // Use wa_message_id as primary key, fall back to database id only
            const id = m.wa_message_id || m.id

            if (!id) {
                console.warn('[CRM] Message without ID:', m)
                filtered.push(m)
                return
            }

            if (!seenIds.has(id)) {
                seenIds.add(id)
                filtered.push(m)
            } else {
                skippedCount++
                if (skippedCount <= 5) {
                    console.log(`[CRM] Skipping duplicate ${idx}: ID=${id}`)
                }
            }
        })

        console.log(`[CRM] Final messages after dedup: ${filtered.length} (skipped ${skippedCount})`)
        return filtered
    }, [msgsStableData])

    // Scroll Handler for Infinite Scroll (at the top)
    const handleScroll = (e) => {
        const target = e.currentTarget

        // CASE 1: Still have pages in the LOCAL DATABASE
        if (target.scrollTop === 0 && hasNextPage && !isFetchingNextPage) {
            console.log('[CRM] Fetching next page from Supabase DB...')
            const prevHeight = target.scrollHeight
            fetchNextPage().then(() => {
                setTimeout(() => {
                    if (chatContainerRef.current) {
                        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight - prevHeight
                    }
                }, 100)
            })
            return
        }

        // CASE 2: Reached the top of the DB history, but user keeps pulling. 
        // Trigger a background sync from WhatsApp API for the NEXT page of history.
        if (target.scrollTop === 0 && !hasNextPage && !isSyncingChat && selectedPhone && messages.length >= 20) {
            console.log('[CRM] Reached top of local history. Triggering Deep Sync from WhatsApp API...')
            // API Page is roughly (current messages / 100) + 1
            const apiPage = Math.floor(messages.length / 100) + 1
            handleSyncChat(apiPage)
        }
    }

    // --- Realtime ---
    useEffect(() => {
        if (!selectedPhone) return
        const channel = supabase.channel(`chat-${selectedPhone}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' },
                payload => {
                    const msg = payload.new
                    // Simple check without activeConversation dependency
                    if (msg.contact_phone === selectedPhone) {
                        queryClient.invalidateQueries({ queryKey: ['whatsapp_messages', selectedPhone] })
                    }
                })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [selectedPhone, queryClient])

    // --- Sync Functions ---
    // Auto-sync older history when opening a chat with few messages
    useEffect(() => {
        if (selectedPhone && messages.length < 10 && !isSyncingChat) {
            handleSyncChat()
        }
    }, [selectedPhone])

    const handleSyncAll = async () => {
        if (isSyncing) return
        setIsSyncing(true)
        try {
            // Fetch list of phones to sync (enrichedConversations contains what's on screen)
            const phones = enrichedConversations.slice(0, 50).map(c => c.contact_phone)

            await supabase.functions.invoke('whatsapp-proxy', {
                body: {
                    action: 'sync_bulk',
                    payload: {
                        limit: 50,
                        messagesPerChat: 50,
                        phones: phones // Sync exactly what user sees
                    }
                }
            })

            // Re-fetch conversations list after a delay to show new messages
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['whatsapp_conversations'] })
                if (selectedPhone) refetchMsgs()
            }, 3000)
        } catch (err) {
            console.error('Bulk sync failed:', err)
        } finally {
            setIsSyncing(false)
        }
    }

    const handleSyncChat = async (page = 1) => {
        // Ensure page is a number (it might be a React Event if called from onClick)
        const actualPage = typeof page === 'number' ? page : 1

        if (!selectedPhone || isSyncingChat) return
        setIsSyncingChat(true)
        console.log(`[CRM] Initiating Deep Sync for ${selectedPhone} (API Page ${actualPage})...`)
        try {
            const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: {
                    action: 'sync_chat',
                    payload: {
                        phone: selectedPhone,
                        limit: 100,
                        page: actualPage
                    }
                }
            })

            if (error) throw error
            console.log('[CRM] RAW SYNC DATA:', data)

            const { found = 0, newSaved = 0, totalInDb = 0 } = data || {}
            console.log(`[CRM] Sync Result: Found ${found} messages, Saved ${newSaved} new. Total in DB: ${totalInDb}`)

            // Always refresh if we got a successful response
            setTimeout(async () => {
                await queryClient.invalidateQueries({ queryKey: ['whatsapp_conversations'] })
                await refetchMsgs()
                console.log('[CRM] Chat UI updated.')
            }, 1000)
        } catch (err) {
            console.error('[CRM] Sync failed:', err)
        } finally {
            setIsSyncingChat(false)
        }
    }

    const { data: activeCustomerSales = [] } = useQuery({
        queryKey: ['customer_sales', activeCustomer?.id],
        queryFn: async () => {
            if (!activeCustomer?.id) return []
            const { data } = await supabase.from('sales').select('*').eq('customer_id', activeCustomer.id).order('sale_date', { ascending: false }).limit(5)
            return data || []
        },
        enabled: !!activeCustomer?.id
    })

    // --- Actions ---
    const sendMessage = useMutation({
        mutationFn: async (text) => {
            if (!selectedPhone || !text.trim()) return
            const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: { action: 'send_message', payload: { phone: selectedPhone, message: text } }
            })
            if (error) throw error
            return data
        },
        onSuccess: () => {
            setMessageText('')
            queryClient.invalidateQueries({ queryKey: ['whatsapp_messages', selectedPhone] })
        }
    })

    const handleSend = () => {
        if (!messageText.trim() || sendMessage.isPending) return
        sendMessage.mutate(messageText)
    }

    // Scroll to bottom
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages])

    // --- Components ---
    const ChatMessage = ({ msg, isLast }) => {
        const isOut = msg.direction === 'outbound'
        const time = format(new Date(msg.created_at), 'HH:mm')

        return (
            <div className={cn(
                "flex w-full mb-1 group",
                isOut ? "justify-end" : "justify-start"
            )}>
                <div className={cn(
                    "max-w-[70%] px-3 py-2 rounded-2xl relative shadow-sm",
                    isOut
                        ? "bg-emerald-600 text-white rounded-tr-none"
                        : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
                )}>
                    {msg.media_url && (
                        <div className="mb-2 rounded overflow-hidden cursor-pointer" onClick={() => window.open(msg.media_url, '_blank')}>
                            <img src={msg.media_url} alt="Mídia" className="max-w-full h-auto object-cover max-h-64" />
                        </div>
                    )}
                    <div className="text-[14.5px] whitespace-pre-wrap break-words leading-relaxed">
                        {msg.content}
                    </div>
                    <div className={cn(
                        "flex items-center gap-1 justify-end mt-1 text-[10px]",
                        isOut ? "text-emerald-100" : "text-gray-400"
                    )}>
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
        <div className="flex fixed top-[64px] bottom-0 left-0 right-0 bg-[#F0F2F5] overflow-hidden z-20 font-sans">

            {/* --- LIST PANEL --- */}
            <div className="w-[350px] bg-white border-r border-gray-200 flex flex-col h-full shrink-0">
                <header className="p-4 bg-[#F0F2F5] flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-gray-800">Mensagens</h2>
                            {isSyncing && <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />}
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost" size="icon"
                                className="h-9 w-9 rounded-full bg-white shadow-sm"
                                onClick={() => navigate('/lead-ranking')}
                            >
                                <Trophy className="w-4 h-4 text-amber-500" />
                            </Button>
                            <Button
                                variant="ghost" size="icon"
                                className="h-9 w-9 rounded-full bg-white shadow-sm"
                                onClick={handleSyncAll}
                                title="Sincronizar Histórico de Todas as Conversas"
                                disabled={isSyncing}
                            >
                                <RefreshCw className={cn("w-4 h-4 text-emerald-500", isSyncing && "animate-spin")} />
                            </Button>
                        </div>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar nome ou número..."
                            className="pl-9 bg-white border-transparent focus:border-emerald-500 rounded-lg h-9 text-sm"
                        />
                    </div>

                    <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
                        <button
                            onClick={() => setFilterStatus('all')}
                            className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                                filterStatus === 'all' ? "bg-emerald-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100"
                            )}>
                            Todas
                        </button>
                        <button
                            onClick={() => setFilterStatus('waiting')}
                            className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                                filterStatus === 'waiting' ? "bg-emerald-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100"
                            )}>
                            Aguardando
                        </button>
                        <button
                            onClick={() => setFilterStatus('ai')}
                            className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                                filterStatus === 'ai' ? "bg-emerald-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100"
                            )}>
                            Top Qualificados
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {isLoadingConv ? (
                        <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
                    ) : enrichedConversations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400">
                            <MessageSquare className="w-12 h-12 mb-2 opacity-20" />
                            <p className="text-sm">Nenhuma conversa encontrada</p>
                        </div>
                    ) : enrichedConversations.map((conv, idx) => {
                        const active = selectedPhone === conv.contact_phone
                        const isOut = conv.direction === 'outbound'
                        const time = format(new Date(conv.created_at), 'HH:mm')
                        const convKey = conv.id || conv.contact_phone || `conv-${idx}`

                        return (
                            <div
                                key={convKey}
                                onClick={() => setSelectedPhone(conv.contact_phone)}
                                className={cn(
                                    "flex items-center gap-3 p-3 cursor-pointer transition-all border-b border-gray-100 hover:bg-gray-50",
                                    active ? "bg-gray-100 hover:bg-gray-100" : ""
                                )}
                            >
                                <div className="relative">
                                    <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                                        <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(conv.customerName)}&background=random`} />
                                        <AvatarFallback>{conv.customerName[0]}</AvatarFallback>
                                    </Avatar>
                                    {conv.aiScore > 80 && (
                                        <div className="absolute -top-1 -right-1 bg-amber-400 text-white rounded-full p-0.5 border-2 border-white">
                                            <Sparkles className="w-3 h-3 fill-current" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <h3 className="text-[15px] font-semibold text-gray-900 truncate">{conv.customerName}</h3>
                                        <span className="text-[11px] text-gray-400 shrink-0">{time}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-gray-500 truncate max-w-[180px]">
                                            {isOut && <span className="text-gray-400 mr-1">Você:</span>}
                                            {conv.content}
                                        </p>
                                        {conv.isWaiting && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* --- CHAT PANEL --- */}
            <div className="flex-1 flex flex-col h-full bg-[#E5DDD5] relative overflow-hidden">
                {!selectedPhone ? (
                    <div className="flex-1 flex flex-col items-center justify-center bg-[#F8F9FA] text-center">
                        <div className="w-64 h-64 opacity-10 mb-6 bg-emerald-600 rounded-full flex items-center justify-center">
                            <MessageCircle className="w-32 h-32 text-white" />
                        </div>
                        <h2 className="text-2xl font-light text-gray-600 mb-2">Selecione uma conversa</h2>
                        <p className="text-gray-400 max-w-sm">Mantenha seu CRM atualizado e responda seus clientes rapidamente.</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <header className="h-[64px] bg-[#F0F2F5] flex items-center justify-between px-4 border-b border-gray-200 shrink-0 z-10 shadow-sm">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(activeConversation?.customerName || '')}&background=random`} />
                                </Avatar>
                                <div className="min-w-0">
                                    <h3 className="text-[15px] font-bold text-gray-900 leading-tight truncate">{activeConversation?.customerName}</h3>
                                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
                                        Visto por último recentemente
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost" size="icon"
                                    className="rounded-full text-gray-500 hover:bg-gray-200"
                                    onClick={handleSyncChat}
                                    title="Sincronizar histórico"
                                    disabled={isSyncingChat}
                                >
                                    <RefreshCw className={cn("w-5 h-5", isSyncingChat && "animate-spin")} />
                                </Button>
                                <Button
                                    variant="ghost" size="icon"
                                    className={cn("rounded-full text-gray-500 hover:bg-gray-200", showDetails && "text-emerald-600 bg-emerald-50")}
                                    onClick={() => setShowDetails(!showDetails)}
                                    title="Detalhes do contato"
                                >
                                    <Info className="w-5 h-5" />
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="rounded-full text-gray-500 hover:bg-gray-200">
                                            <MoreVertical className="w-5 h-5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => window.open(`https://wa.me/${selectedPhone.replace(/\D/g, '')}`, '_blank')}>
                                            <ExternalLink className="w-4 h-4 mr-2" /> Abrir no WhatsApp
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-red-600">
                                            <EyeOff className="w-4 h-4 mr-2" /> Ocultar Contato
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </header>

                        {/* Messages Area */}
                        <div
                            ref={chatContainerRef}
                            onScroll={handleScroll}
                            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-1 relative scroll-smooth custom-scrollbar bg-chat-pattern"
                            style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundOpacity: 0.05 }}
                        >
                            {/* Syncing Overlay Indicator */}
                            {isSyncingChat && (
                                <div className="sticky top-0 left-0 right-0 z-20 flex justify-center mb-4">
                                    <div className="bg-white/90 backdrop-blur-sm border border-emerald-100 px-4 py-1.5 rounded-full shadow-md flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <Loader2 className="w-3 h-3 text-emerald-500 animate-spin" />
                                        <span className="text-[11px] font-medium text-emerald-700">Sincronizando histórico...</span>
                                    </div>
                                </div>
                            )}

                            {isFetchingNextPage && <div className="flex justify-center p-2"><Loader2 className="w-4 h-4 text-emerald-500 animate-spin" /></div>}

                            {isLoadingMsgs ? (
                                <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
                            ) : messages.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-gray-400 italic">Nenhuma mensagem encontrada. Sincronize o histórico para carregar conversas antigas.</div>
                            ) : (
                                <>
                                    {/* Date separators and messages */}
                                    {messages.map((msg, i) => {
                                        const prev = messages[i - 1]
                                        const showDate = !prev || !isSameDay(new Date(msg.created_at), new Date(prev.created_at))
                                        // Combined key for absolute uniqueness
                                        const msgKey = `msg-${msg.id || msg.wa_message_id || i}-${i}`

                                        return (
                                            <React.Fragment key={msgKey}>
                                                {showDate && (
                                                    <div className="flex justify-center my-4">
                                                        <span className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-lg text-[11px] font-semibold text-gray-500 shadow-sm uppercase tracking-wider">
                                                            {isToday(new Date(msg.created_at)) ? 'Hoje' : isYesterday(new Date(msg.created_at)) ? 'Ontem' : format(new Date(msg.created_at), "d 'de' MMMM", { locale: ptBR })}
                                                        </span>
                                                    </div>
                                                )}
                                                <ChatMessage msg={msg} isLast={i === messages.length - 1} />
                                            </React.Fragment>
                                        )
                                    })}
                                    <div ref={messagesEndRef} className="h-4" />
                                </>
                            )}
                        </div>

                        {/* Input Area */}
                        <footer className="p-3 bg-[#F0F2F5] border-t border-gray-200 shrink-0">
                            <div className="flex items-end gap-3 max-w-5xl mx-auto">
                                <div className="flex flex-1 items-end bg-white rounded-xl shadow-sm border border-gray-100 p-1.5 focus-within:border-emerald-500 transition-all">
                                    <Button variant="ghost" size="icon" className="rounded-xl text-gray-500 hover:text-emerald-600 shrink-0">
                                        <ImageIcon className="w-5 h-5" />
                                    </Button>
                                    <Textarea
                                        ref={textareaRef}
                                        value={messageText}
                                        onChange={e => {
                                            setMessageText(e.target.value)
                                            e.target.style.height = 'auto'
                                            e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px'
                                        }}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                handleSend()
                                            }
                                        }}
                                        placeholder="Digite uma mensagem..."
                                        className="flex-1 border-none focus-visible:ring-0 min-h-[40px] max-h-[150px] py-2 px-3 bg-transparent resize-none text-[15px]"
                                    />
                                    <Button variant="ghost" size="icon" className="rounded-xl text-gray-500 hover:text-emerald-600 shrink-0">
                                        <Mic className="w-5 h-5" />
                                    </Button>
                                </div>
                                <Button
                                    onClick={handleSend}
                                    disabled={!messageText.trim() || sendMessage.isPending}
                                    className="h-[52px] w-[52px] rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shrink-0 transition-transform active:scale-95"
                                >
                                    {sendMessage.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6 text-white" />}
                                </Button>
                            </div>
                        </footer>
                    </>
                )}
            </div>

            {/* --- DETAILS PANEL --- */}
            <AnimatePresence>
                {showDetails && selectedPhone && (
                    <motion.div
                        initial={{ x: 300, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 300, opacity: 0 }}
                        className="w-[320px] bg-white border-l border-gray-200 flex flex-col h-full shrink-0 shadow-lg z-10"
                    >
                        <header className="h-[64px] border-b border-gray-100 flex items-center px-4 justify-between bg-white shrink-0">
                            <h2 className="font-bold text-gray-800">Detalhes do Contato</h2>
                            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={() => setShowDetails(false)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </header>

                        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8 custom-scrollbar">
                            {/* Profile Info */}
                            <div className="flex flex-col items-center text-center">
                                <Avatar className="h-24 w-24 mb-4 border-4 border-emerald-50 shadow-md">
                                    <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(activeConversation?.customerName || '')}&background=random&size=128`} />
                                </Avatar>
                                <h3 className="text-lg font-bold text-gray-900 leading-tight mb-1">{activeConversation?.customerName}</h3>
                                <p className="text-sm text-gray-500 mb-4 font-mono">{formatPhoneDisplay(selectedPhone)}</p>

                                <div className="flex items-center gap-2">
                                    {activeCustomer ? (
                                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none px-3 py-1">
                                            <User className="w-3 h-3 mr-1" /> Cliente Registrado
                                        </Badge>
                                    ) : (
                                        <Button
                                            size="sm" variant="outline"
                                            className="h-8 border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50 rounded-lg text-xs"
                                            onClick={() => setIsRegistering(true)}
                                        >
                                            <UserPlus className="w-3 h-3 mr-1" /> Criar como Cliente
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Lead Analysis */}
                            <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><Brain className="w-4 h-4" /></div>
                                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Análise de IA</span>
                                    </div>
                                    <Badge className={cn(
                                        "font-bold",
                                        activeConversation?.aiScore >= 80 ? "bg-amber-400" : "bg-gray-200 text-gray-600"
                                    )}>
                                        Score: {activeConversation?.aiScore || 0}
                                    </Badge>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <div className="text-[11px] text-gray-400 font-bold uppercase mb-1">Status do Lead</div>
                                        <div className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                                            {activeCustomer?.ai_status || 'Aguardando Análise'}
                                        </div>
                                    </div>

                                    {activeCustomer?.ai_recommendation && (
                                        <div>
                                            <div className="text-[11px] text-gray-400 font-bold uppercase mb-1">Recomendação</div>
                                            <div className="text-xs text-gray-600 leading-relaxed bg-white/80 p-3 rounded-xl border border-emerald-50">
                                                {activeCustomer.ai_recommendation}
                                            </div>
                                        </div>
                                    )}

                                    <Button
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md rounded-xl h-10 group"
                                        size="sm"
                                        onClick={() => queryClient.invalidateQueries({ queryKey: ['customers'] })}
                                    >
                                        <Sparkles className="w-3 h-3 mr-2 group-hover:animate-spin-slow" /> Atualizar Análise
                                    </Button>
                                </div>
                            </div>

                            {/* Purchase History */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                        <ShoppingBag className="w-4 h-4 text-emerald-500" /> Histórico de Compras
                                    </h4>
                                    <Badge variant="outline" className="text-[10px] uppercase">{activeCustomerSales.length} Pedidos</Badge>
                                </div>

                                <div className="space-y-2">
                                    {activeCustomerSales.length === 0 ? (
                                        <div className="text-[11px] text-gray-400 text-center py-4 border border-dashed rounded-xl">Nenhuma compra registrada</div>
                                    ) : activeCustomerSales.map((sale) => (
                                        <div key={sale.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                                            <div>
                                                <div className="text-xs font-bold text-gray-800">{format(new Date(sale.sale_date), 'dd/MM/yy')}</div>
                                                <div className="text-[10px] text-gray-500 uppercase">{sale.payment_method}</div>
                                            </div>
                                            <div className="text-sm font-bold text-emerald-600">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.total_amount)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- Modals for Customer Mgmt --- */}
            <Dialog open={isRegistering} onOpenChange={setIsRegistering}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Novo Cliente</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nome do Cliente</label>
                            <Input
                                value={newCustomerName}
                                onChange={e => setNewCustomerName(e.target.value)}
                                placeholder="Digite o nome..."
                            />
                        </div>
                        <div className="space-y-2 opacity-50">
                            <label className="text-sm font-medium">Telefone</label>
                            <Input value={selectedPhone || ''} disabled />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsRegistering(false)}>Cancelar</Button>
                        <Button className="bg-emerald-600" onClick={() => {
                            if (!newCustomerName) return
                            base44.entities.Customer.create({ name: newCustomerName, phone: selectedPhone }).then(() => {
                                queryClient.invalidateQueries({ queryKey: ['customers'] })
                                setIsRegistering(false)
                                setNewCustomerName('')
                            })
                        }}>Salvar Cliente</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* CSS for custom scrollbar and patterns */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }
                .bg-chat-pattern { background-size: 400px; background-attachment: fixed; }
                @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin-slow { animation: spin-slow 3s linear infinite; }
            `}} />
        </div>
    )
}
