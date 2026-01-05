import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/api/supabaseClient'
import { base44 } from '@/api/base44Client'
import { Send, Search, Phone, User, ShoppingBag, DollarSign, Calendar, RefreshCw, Brain, Sparkles, TrendingUp, CheckCircle2, Clock, Trophy, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function CRM() {
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const [selectedPhone, setSelectedPhone] = useState(null)
    const [messageText, setMessageText] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [isSyncing, setIsSyncing] = useState(false)
    const [isRegistering, setIsRegistering] = useState(false)
    const [isLinking, setIsLinking] = useState(false)
    const [newCustomerName, setNewCustomerName] = useState('')
    const [linkSearch, setLinkSearch] = useState('')
    const [sortBy, setSortBy] = useState('recent') // 'recent' or 'ai'
    const [isRerankingAll, setIsRerankingAll] = useState(false)

    const { data: settings = {} } = useQuery({
        queryKey: ['settings'],
        queryFn: async () => {
            const list = await base44.entities.Settings.list()
            return list[0] || {}
        }
    })

    const hiddenPhones = settings.whatsapp_hidden_phones || []

    // URL Params for pre-filling
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const phone = params.get('phone')
        const msg = params.get('message')
        if (phone) setSelectedPhone(phone)
        if (msg) setMessageText(msg)

        // Clean up URL without refreshing
        if (phone || msg) {
            const newUrl = window.location.pathname
            window.history.replaceState({}, '', newUrl)
        }
    }, [])

    // Canonicalize phone (find the actual contact_phone string in metadata)
    useEffect(() => {
        if (!selectedPhone || !conversations.length) return

        // If strict match already exists, do nothing
        if (conversations.find(c => c.contact_phone === selectedPhone)) return

        // Try normalized match
        const targetNorm = normalizeForMatch(selectedPhone)
        const match = conversations.find(c => normalizeForMatch(c.contact_phone) === targetNorm)

        if (match) {
            console.log(`[CRM] Canonical mapping: ${selectedPhone} -> ${match.contact_phone}`)
            setSelectedPhone(match.contact_phone)
        }
    }, [selectedPhone, conversations])

    // Reset customer management states when selection changes
    useEffect(() => {
        setIsRegistering(false)
        setIsLinking(false)
        setNewCustomerName('')
        setLinkSearch('')
    }, [selectedPhone])

    const normalizeForMatch = (phone) => {
        let s = String(phone || '').replace(/\D/g, '')
        // Ignore extremely long numbers (likely IDs or broadcast lists) - Strict limit 14 digits (standard is 13 max: 55 + 2 DDD + 9 + 8 digits)
        if (s.length > 14) return null

        if (s.startsWith('55') && s.length > 10) s = s.slice(2)
        if (s.length === 11 && s[2] === '9') return s.slice(0, 2) + s.slice(3)
        return s
    }

    const formatPhoneDisplay = (phone) => {
        let s = String(phone || '').replace(/\D/g, '')
        if (s.length > 14) return 'ID: ' + s.slice(0, 6) + '...' // Handle weird long IDs
        if (s.startsWith('55')) s = s.slice(2)
        if (s.length === 11) return `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7)}`
        if (s.length === 10) return `(${s.slice(0, 2)}) ${s.slice(2, 6)}-${s.slice(6)}`
        return phone
    }

    const syncLock = React.useRef(false)
    // Periodic Sync Effect
    useEffect(() => {
        const interval = setInterval(async () => {
            if (syncLock.current) return
            syncLock.current = true
            setIsSyncing(true)
            try {
                const { data } = await supabase.functions.invoke('whatsapp-proxy', {
                    body: { action: 'sync_recent' }
                })
                if (data?.count > 0) {
                    queryClient.invalidateQueries({ queryKey: ['whatsapp_conversations'] })
                    if (selectedPhone) {
                        queryClient.invalidateQueries({ queryKey: ['whatsapp_messages', selectedPhone] })
                    }
                }
            } catch (e) {
                console.error('Background sync failed:', e)
            } finally {
                syncLock.current = false
                setIsSyncing(false)
            }
        }, 30000)

        return () => clearInterval(interval)
    }, [selectedPhone, queryClient])

    // 1. Fetch Conversations
    const { data: conversations = [], isLoading: isLoadingConv } = useQuery({
        queryKey: ['whatsapp_conversations'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('whatsapp_messages')
                .select('contact_phone, contact_name, content, created_at, status, direction')
                .order('created_at', { ascending: false })
                .limit(2000)

            if (error) throw error

            const map = new Map()
            data.forEach(msg => {
                if (!msg.contact_phone) return

                // Filter out weird long IDs (Status updates / Broadcast lists)
                // Also ensure we only process valid phone numbers
                const rawPhone = String(msg.contact_phone).replace(/\D/g, '')
                if (rawPhone.length > 14 || rawPhone.length < 8) return

                const key = normalizeForMatch(msg.contact_phone)
                if (!key) return // Skip invalid numbers

                // Try to find a good name (not just phone number)
                const candidateName = msg.contact_name && msg.contact_name !== msg.contact_phone ? msg.contact_name : null

                if (!map.has(key)) {
                    map.set(key, { ...msg, relatedPhones: new Set([msg.contact_phone]) })
                } else {
                    const existing = map.get(key)
                    existing.relatedPhones.add(msg.contact_phone)
                    // If we don't have a good name yet, and this message has one, use it
                    if ((!existing.contact_name || existing.contact_name === existing.contact_phone) && candidateName) {
                        existing.contact_name = candidateName
                    }
                }
            })

            return Array.from(map.values()).map(c => ({
                ...c,
                relatedPhones: Array.from(c.relatedPhones)
            }))
        }
    })

    // 2. Fetch Customers
    const { data: customers = [] } = useQuery({
        queryKey: ['customers'],
        queryFn: () => base44.entities.Customer.list(),
        initialData: []
    })

    // Enriched Logic
    const allEnriched = conversations.map(conv => {
        const convMatch = normalizeForMatch(conv.contact_phone)
        const customer = customers.find(c => {
            const clientMatch = normalizeForMatch(c.phone)
            return clientMatch === convMatch && clientMatch !== ''
        })

        // Use WhatsApp pushname if no customer record
        const displayName = customer?.name || (conv.contact_name && conv.contact_name !== conv.contact_phone ? conv.contact_name : formatPhoneDisplay(conv.contact_phone))

        return {
            ...conv,
            customerName: displayName,
            customerData: customer,
            aiScore: customer?.ai_score || 0,
            isWaiting: conv.direction === 'inbound'
        }
    })

    const enrichedConversations = allEnriched.filter(c => {
        const isHidden = hiddenPhones.includes(normalizeForMatch(c.contact_phone)) || hiddenPhones.includes(c.contact_phone)
        if (isHidden) return false

        return c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.contact_phone.includes(searchTerm)
    }).sort((a, b) => {
        if (sortBy === 'ai') return (b.aiScore || 0) - (a.aiScore || 0)
        return 0
    })

    const activeConversation = allEnriched.find(c => c.contact_phone === selectedPhone)
    const activeCustomer = activeConversation?.customerData

    // 3. Messages Query
    const { data: messages = [], isLoading: isLoadingMsgs } = useQuery({
        queryKey: ['whatsapp_messages', selectedPhone, activeConversation?.relatedPhones],
        queryFn: async () => {
            if (!selectedPhone) return []
            const phonesToFetch = activeConversation?.relatedPhones || [selectedPhone]
            const { data, error } = await supabase
                .from('whatsapp_messages')
                .select('*')
                .in('contact_phone', phonesToFetch)
                .order('created_at', { ascending: true })
            if (error) throw error
            return data
        },
        enabled: !!selectedPhone,
        refetchInterval: 5000
    })

    // Mutations
    const sendMessageMutation = useMutation({
        mutationFn: async ({ phone, text }) => {
            const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: { action: 'send_message', payload: { phone, message: text } }
            })
            if (error || data?.error) throw error || new Error(data?.message)
            return data
        },
        onSuccess: () => {
            setMessageText('')
            queryClient.invalidateQueries({ queryKey: ['whatsapp_messages', selectedPhone] })
            queryClient.invalidateQueries({ queryKey: ['whatsapp_conversations'] })
        }
    })

    const handleSend = () => {
        if (!messageText.trim() || !selectedPhone) return
        sendMessageMutation.mutate({ phone: selectedPhone, text: messageText })
    }

    const createCustomerMutation = useMutation({
        mutationFn: async () => {
            if (!newCustomerName.trim() || !selectedPhone) return
            return base44.entities.Customer.create({ name: newCustomerName, phone: selectedPhone })
        },
        onSuccess: () => {
            setIsRegistering(false)
            setNewCustomerName('')
            queryClient.invalidateQueries({ queryKey: ['customers'] })
            queryClient.invalidateQueries({ queryKey: ['whatsapp_conversations'] })
        }
    })

    const linkCustomerMutation = useMutation({
        mutationFn: async (customerId) => {
            if (!selectedPhone) return
            return base44.entities.Customer.update(customerId, { phone: selectedPhone })
        },
        onSuccess: () => {
            setIsLinking(false)
            setLinkSearch('')
            queryClient.invalidateQueries({ queryKey: ['customers'] })
            queryClient.invalidateQueries({ queryKey: ['whatsapp_conversations'] })
        }
    })

    const hideContactMutation = useMutation({
        mutationFn: async (phone) => {
            if (!phone) return
            const normalized = normalizeForMatch(phone)
            const currentHidden = Array.isArray(settings.whatsapp_hidden_phones) ? settings.whatsapp_hidden_phones : []
            const newHidden = [...new Set([...currentHidden, normalized || phone])]

            if (settings.id) {
                return base44.entities.Settings.update(settings.id, { whatsapp_hidden_phones: newHidden })
            } else {
                return base44.entities.Settings.create({ whatsapp_hidden_phones: newHidden })
            }
        },
        onSuccess: () => {
            setSelectedPhone(null)
            queryClient.invalidateQueries({ queryKey: ['settings'] })
            queryClient.invalidateQueries({ queryKey: ['whatsapp_conversations'] })
        }
    })

    const performAiAnalysis = async (customerId, phone) => {
        console.log(`[Analysis] Starting for ${phone}...`)

        // --- 0. CHECK IF MARKED AS DONE ---
        // Fetch current customer status first
        const { data: currentCustomer } = await supabase.from('customers').select('ai_status, last_ai_analysis').eq('id', customerId).single()

        let backendResult = { data: null, error: null }
        try {
            backendResult = await supabase.functions.invoke('whatsapp-ai-analyzer', {
                body: { customerId: customerId, phone: phone }
            })
        } catch (e) {
            console.error(`[Analysis] Backend failed for ${phone}`, e)
            backendResult.error = e
        }

        let frontendSuccess = false
        let finalData = backendResult.data || { insights: {} }

        // CLIENT-SIDE OVERRIDE
        try {
            const raw = phone.replace(/\D/g, '')
            const phonesToSearch = [raw]
            if (raw.startsWith('55')) phonesToSearch.push(raw.slice(2))
            if (raw.length > 10 && raw.startsWith('55') && raw[4] === '9') {
                phonesToSearch.push(raw.slice(0, 4) + raw.slice(5))
                phonesToSearch.push(raw.slice(2, 4) + raw.slice(5))
            }

            const { data: recentMsgs } = await supabase
                .from('whatsapp_messages')
                .select('*')
                .in('contact_phone', phonesToSearch)
                .order('created_at', { ascending: true })

            if (recentMsgs && recentMsgs.length > 0) {
                const sorted = recentMsgs
                const lastMsg = sorted[sorted.length - 1]
                const lastSender = lastMsg.direction === 'inbound' ? 'CLIENTE' : 'ATENDENTE'
                const lastMsgTime = new Date(lastMsg.created_at)
                const diffMs = new Date().getTime() - lastMsgTime.getTime()
                const minutesSinceLast = Math.floor(diffMs / 60000)

                let consecutiveClientMessages = 0
                for (let i = sorted.length - 1; i >= 0; i--) {
                    if (sorted[i].direction === 'inbound') consecutiveClientMessages++
                    else break
                }

                console.log(`[Analysis] Logic for ${phone}:`, { lastSender, consecutiveClientMessages, minutesSinceLast })

                // --- CHECK IF DONE ---
                const isDone = currentCustomer?.ai_status === 'Concluído'
                const lastAnalysisTime = currentCustomer?.last_ai_analysis ? new Date(currentCustomer.last_ai_analysis) : new Date(0)
                const isNewMessage = lastMsgTime > lastAnalysisTime

                if (isDone && !isNewMessage) {
                    console.log(`[Analysis] Skipping ${phone}: Marked as Done and no new messages.`)
                    return { insights: { score: 0, status: 'Concluído', recommendation: 'Atendimento finalizado.' } }
                }

                if (lastSender === 'CLIENTE') {
                    let forcedScore = 90
                    let urgencyReason = ''

                    if (consecutiveClientMessages >= 2) {
                        forcedScore = 100
                        urgencyReason = ' (Cliente insistente - 2+ msgs)'
                    } else if (minutesSinceLast < 60) {
                        forcedScore = 99
                        urgencyReason = ' (Recente < 1h)'
                    } else {
                        forcedScore = 95
                        urgencyReason = ' (Aguardando resposta)'
                    }

                    const currentScore = finalData?.insights?.score || 0

                    if (currentScore < forcedScore) {
                        console.log(`[Analysis] Overriding score for ${phone}: ${currentScore} -> ${forcedScore}`)

                        await supabase.from('customers').update({
                            ai_score: forcedScore,
                            ai_status: `URGENTE${urgencyReason}`,
                            ai_recommendation: finalData?.insights?.recommendation || 'Responda o cliente imediatamente.',
                            ai_suggested_message: finalData?.insights?.suggested_message || finalData?.insights?.recommendation || '',
                            last_ai_analysis: new Date().toISOString()
                        }).eq('id', customerId)

                        frontendSuccess = true

                        if (!finalData.insights) finalData.insights = {}
                        finalData.insights.score = forcedScore
                        finalData.insights.status = `URGENTE${urgencyReason}`

                        // Optimistic Cache Update
                        queryClient.setQueryData(['customers'], (old) => {
                            if (!old) return old
                            return old.map(c => c.id === customerId ? {
                                ...c, ai_score: forcedScore, ai_status: `URGENTE${urgencyReason}`
                            } : c)
                        })
                    }
                }
            }
        } catch (err) {
            console.error(`[Analysis] Frontend Override Error for ${phone}`, err)
        }

        if (frontendSuccess) return finalData
        if (backendResult.error || (backendResult.data && backendResult.data.error)) {
            throw new Error(backendResult.error?.message || backendResult.data?.error || "IA falhou")
        }
        return finalData
    }

    const markAsDoneMutation = useMutation({
        mutationFn: async (customerId) => {
            if (!customerId) return
            await supabase.from('customers').update({
                ai_score: 0,
                ai_status: 'Concluído',
                ai_recommendation: 'Atendimento marcado como concluído.',
                last_ai_analysis: new Date().toISOString()
            }).eq('id', customerId)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] })
        }
    })

    const analyzeAiMutation = useMutation({
        mutationFn: async (targetPhone = selectedPhone) => {
            const conversation = allEnriched.find(c => c.contact_phone === targetPhone)
            let customer = conversation?.customerData
            let customerId = customer?.id

            // Create customer if it doesn't exist
            if (!customerId && targetPhone) {
                console.log(`[Analysis] Creating new lead for ${targetPhone}`)
                const { data: newCustomer, error: createError } = await supabase
                    .from('customers')
                    .insert({
                        name: conversation?.contact_name || targetPhone,
                        phone: targetPhone,
                        ai_status: 'Novo Lead'
                    })
                    .select()
                    .single()

                if (createError) {
                    console.error("Failed to create lead", createError)
                    throw new Error("Falha ao criar lead: " + createError.message)
                }
                customerId = newCustomer.id
                customer = newCustomer
            }

            if (!customerId || !targetPhone) return
            return performAiAnalysis(customerId, targetPhone)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] })
            queryClient.invalidateQueries({ queryKey: ['whatsapp_conversations'] })
        }
    })



    const { data: activeCustomerSales = [] } = useQuery({
        queryKey: ['customer_sales', activeCustomer?.id],
        queryFn: async () => {
            if (!activeCustomer?.id) return []
            const { data, error } = await supabase.from('sales').select('*').eq('customer_id', activeCustomer.id).order('sale_date', { ascending: false }).limit(50)
            return error ? [] : data
        },
        enabled: !!activeCustomer?.id
    })

    const topProducts = React.useMemo(() => {
        if (!activeCustomerSales?.length) return []
        const counts = {}
        activeCustomerSales.forEach(sale => {
            const items = typeof sale.items === 'string' ? JSON.parse(sale.items || '[]') : (sale.items || [])
            if (Array.isArray(items)) {
                items.forEach(item => {
                    const key = item.product_id || item.name
                    if (!key) return
                    if (!counts[key]) counts[key] = { name: item.name || 'Item', count: 0 }
                    counts[key].count += (Number(item.quantity) || 1)
                })
            }
        })
        return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 3)
    }, [activeCustomerSales])

    const filteredExistingCustomers = customers.filter(c =>
        (c.name || '').toLowerCase().includes(linkSearch.toLowerCase()) &&
        !(c.phone && normalizeForMatch(c.phone) === normalizeForMatch(selectedPhone))
    ).slice(0, 10)

    return (
        <div className="flex h-[calc(100vh-64px-48px)] bg-gray-50 border-t border-gray-200 overflow-hidden">
            {/* Conversations List */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-bold text-gray-800">Mensagens</h2>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                title="Reanalisar IA de todos os contatos"
                                onClick={async () => {
                                    if (isRerankingAll) return
                                    setIsRerankingAll(true)
                                    try {
                                        // Include ALL enriched conversations (registered or not)
                                        const targets = enrichedConversations.filter(c => c.contact_phone)

                                        // Process in parallel (batches of 5 to avoid rate limits if needed, or all)
                                        // Using Promise.allSettled to not stop on individual errors
                                        await Promise.allSettled(targets.map(async c => {
                                            let customerId = c.customerData?.id

                                            // Create if missing
                                            if (!customerId) {
                                                const { data: newCustomer } = await supabase
                                                    .from('customers')
                                                    .insert({
                                                        name: c.contact_name || c.contact_phone,
                                                        phone: c.contact_phone,
                                                        ai_status: 'Novo Lead'
                                                    })
                                                    .select()
                                                    .single()
                                                if (newCustomer) customerId = newCustomer.id
                                            }

                                            if (customerId) {
                                                return performAiAnalysis(customerId, c.contact_phone)
                                            }
                                        }))

                                        queryClient.invalidateQueries({ queryKey: ['customers'] })
                                        queryClient.invalidateQueries({ queryKey: ['whatsapp_conversations'] })
                                    } catch (e) {
                                        console.error("Batch AI Error", e)
                                    } finally {
                                        setIsRerankingAll(false)
                                    }
                                }}
                                disabled={isRerankingAll}
                                className={`h-8 w-8 ${isRerankingAll ? 'text-purple-600 animate-pulse' : 'text-purple-400 hover:text-purple-600'}`}
                            >
                                <Sparkles className="w-4 h-4" />
                            </Button>
                            <Button
                                variant={sortBy === 'ai' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setSortBy(sortBy === 'ai' ? 'recent' : 'ai')}
                                className={`h-8 px-2 text-[10px] font-bold uppercase transition-all ${sortBy === 'ai' ? 'bg-indigo-600 hover:bg-indigo-700' : 'text-gray-400'}`}
                            >
                                <Brain className="w-3 h-3 mr-1" /> IA Rank
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate('/lead-ranking')}
                                className="h-8 px-2 text-[10px] font-bold uppercase text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            >
                                <Trophy className="w-3 h-3 mr-1" /> Ver Ranking
                            </Button>
                            <Button
                                variant="ghost" size="icon"
                                onClick={() => {
                                    queryClient.invalidateQueries({ queryKey: ['whatsapp_conversations'] })
                                    queryClient.invalidateQueries({ queryKey: ['whatsapp_messages'] })
                                }}
                                disabled={isLoadingConv}
                                className="h-8 w-8 text-gray-400"
                            >
                                <RefreshCw className={`w-4 h-4 ${isLoadingConv ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <Input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar..."
                            className="pl-9 bg-gray-50 border-none"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {enrichedConversations.map(conv => (
                        <div
                            key={conv.contact_phone}
                            onClick={() => {
                                setSelectedPhone(conv.contact_phone)
                                if (conv.customerData?.id && !conv.aiScore && !analyzeAiMutation.isPending) {
                                    analyzeAiMutation.mutate(conv.contact_phone)
                                }
                            }}
                            className={`p-4 border-b border-gray-50 cursor-pointer transition-colors hover:bg-gray-50 ${selectedPhone === conv.contact_phone ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : ''}`}
                        >
                            <div className="flex items-center gap-3">
                                <Avatar>
                                    <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(conv.customerName)}&background=10b981&color=fff`} />
                                    <AvatarFallback>{conv.customerName.substring(0, 2)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className="font-semibold text-gray-900 truncate text-sm">{conv.customerName}</h3>
                                        <span className="text-[10px] text-gray-400">{format(new Date(conv.created_at), 'HH:mm')}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-gray-500 truncate flex-1">{conv.content}</p>
                                        {conv.aiScore > 0 && (
                                            <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">{conv.aiScore}%</span>
                                        )}
                                        {conv.isWaiting && <div className="ml-1 w-2 h-2 rounded-full bg-orange-500 animate-pulse" />}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col bg-[#e5ddd5]/30 relative">
                {selectedPhone ? (
                    <>
                        <div className="p-4 bg-white border-b border-gray-200 flex items-center gap-3 shadow-sm z-10">
                            <Avatar className="h-9 w-9">
                                <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(activeConversation?.customerName || '')}&background=10b981&color=fff`} />
                                <AvatarFallback>?</AvatarFallback>
                            </Avatar>
                            <div>
                                <h3 className="font-bold text-gray-900">{activeConversation?.customerName}</h3>
                                <p className="text-xs text-gray-500">+{selectedPhone}</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[70%] rounded-xl px-4 py-2 shadow-sm text-sm ${msg.direction === 'outbound' ? 'bg-[#d9fdd3] text-gray-900 rounded-tr-none' : 'bg-white text-gray-900 rounded-tl-none'}`}>
                                        <p>{msg.content}</p>
                                        <div className="text-[10px] text-gray-500 text-right mt-1 opacity-70">
                                            {format(new Date(msg.created_at), 'HH:mm')}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-200">
                            <div className="flex gap-2">
                                <Input
                                    value={messageText}
                                    onChange={e => setMessageText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                    placeholder="Mensagem..."
                                    className="bg-white rounded-full"
                                />
                                <Button onClick={handleSend} disabled={sendMessageMutation.isPending || !messageText.trim()} className="rounded-full w-12 h-10 bg-emerald-600 hover:bg-emerald-700 text-white">
                                    <Send className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <Phone className="w-12 h-12 mb-4 opacity-20" />
                        <p>Selecione uma conversa</p>
                    </div>
                )}
            </div>

            {/* Info Panel */}
            {selectedPhone && (
                <div className="w-80 bg-white border-l border-gray-200 p-6 hidden lg:block">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6">Informações</h3>

                    {activeCustomer ? (
                        <div className="space-y-6">
                            <div className="text-center">
                                <Avatar className="h-20 w-20 mx-auto mb-3 bg-emerald-100 text-emerald-700 text-xl font-bold">
                                    <AvatarFallback>{activeCustomer.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <h2 className="font-bold text-gray-900">{activeCustomer.name}</h2>
                                <p className="text-xs text-gray-500">Saldo: R$ {Number(activeCustomer.cashback_balance || 0).toFixed(2)}</p>
                            </div>

                            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100">
                                <div className="flex items-center justify-between mb-3 text-indigo-700 font-bold text-xs uppercase">
                                    <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> IA Insights</span>
                                    <Button variant="ghost" size="sm" onClick={() => analyzeAiMutation.mutate()} className="h-6 w-6 p-0"><RefreshCw className={`w-3 h-3 ${analyzeAiMutation.isPending ? 'animate-spin' : ''}`} /></Button>
                                </div>
                                {analyzeAiMutation.isError ? (
                                    <div className="py-2 text-center relative z-10">
                                        <p className="text-[10px] text-red-500 font-bold mb-2">Erro: {analyzeAiMutation.error.message}</p>
                                        <Button variant="outline" size="sm" onClick={() => analyzeAiMutation.mutate()} className="h-7 text-[9px] px-2 border-red-200 text-red-600">Tentar de novo</Button>
                                    </div>
                                ) : activeCustomer.ai_score !== undefined ? (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <span className="text-2xl font-black text-indigo-900">{activeCustomer.ai_score}%</span>
                                            <span className="text-[10px] font-bold text-indigo-600">{activeCustomer.ai_status}</span>
                                        </div>
                                        <p className="text-xs text-indigo-800 italic leading-tight">"{activeCustomer.ai_recommendation}"</p>

                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                console.log("Copying AI suggestion to input...");
                                                setMessageText(activeCustomer.ai_suggested_message || activeCustomer.ai_recommendation);
                                            }}
                                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] h-7 mb-2"
                                        >
                                            <Send className="w-3 h-3 mr-1" /> Enviar agora
                                        </Button>

                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => markAsDoneMutation.mutate(activeCustomer.id)}
                                            className="w-full h-7 text-[10px] text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                        >
                                            <CheckCircle2 className="w-3 h-3 mr-1" /> Marcar como Concluído
                                        </Button>
                                    </div>
                                ) : (
                                    <Button size="sm" onClick={() => analyzeAiMutation.mutate()} className="w-full bg-indigo-600 text-[10px] h-8">Analisar agora</Button>
                                )}
                            </div>

                            <div className="space-y-2 pt-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        if (confirm('Deseja ocultar este contato do CRM? Você poderá reverter isso nas configurações.')) {
                                            hideContactMutation.mutate(selectedPhone)
                                        }
                                    }}
                                    className="w-full text-gray-400 hover:text-red-500 hover:border-red-200 text-[10px] h-7"
                                >
                                    <EyeOff className="w-3 h-3 mr-1" /> Ocultar do CRM
                                </Button>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <div className="flex items-center gap-3 text-sm">
                                    <ShoppingBag className="w-4 h-4 text-gray-400" />
                                    <div className="flex-1">
                                        <p className="text-[10px] text-gray-400 uppercase font-bold">Última Compra</p>
                                        <p className="font-medium">{activeCustomerSales?.[0] ? `R$ ${activeCustomerSales[0].total_amount?.toFixed(2)}` : 'Nenhuma'}</p>
                                    </div>
                                </div>
                                {topProducts.length > 0 && (
                                    <div className="pt-2">
                                        <p className="text-[10px] text-gray-400 uppercase font-bold mb-2">Favoritos</p>
                                        {topProducts.map((p, i) => (
                                            <div key={i} className="flex justify-between text-xs py-1">
                                                <span className="text-gray-600 truncate mr-2">{p.name}</span>
                                                <span className="font-bold">{p.count}x</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center space-y-4">
                            <p className="text-sm text-gray-500">Contato não identificado</p>
                            {!isRegistering && !isLinking && (
                                <div className="space-y-2">
                                    <Button onClick={() => setIsRegistering(true)} className="w-full bg-emerald-600">Cadastrar</Button>
                                    <Button onClick={() => setIsLinking(true)} variant="outline" className="w-full">Vincular</Button>
                                </div>
                            )}
                            {isRegistering && (
                                <div className="space-y-3">
                                    <Input value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} placeholder="Nome" />
                                    <div className="flex gap-2">
                                        <Button onClick={() => createCustomerMutation.mutate()} className="flex-1 bg-emerald-600">Criar</Button>
                                        <Button onClick={() => setIsRegistering(false)} variant="ghost">X</Button>
                                    </div>
                                </div>
                            )}
                            {isLinking && (
                                <div className="space-y-3">
                                    <Input value={linkSearch} onChange={e => setLinkSearch(e.target.value)} placeholder="Buscar..." />
                                    <div className="max-h-40 overflow-y-auto space-y-1">
                                        {filteredExistingCustomers.map(c => (
                                            <div key={c.id} onClick={() => linkCustomerMutation.mutate(c.id)} className="p-2 text-xs border rounded hover:bg-emerald-50 cursor-pointer text-left">
                                                <p className="font-bold">{c.name}</p>
                                                <p className="text-gray-400">{c.phone}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <Button onClick={() => setIsLinking(false)} variant="ghost">Cancelar</Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
