import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/api/supabaseClient'
import { base44 } from '@/api/base44Client'
import { Send, Search, Phone, User, ShoppingBag, DollarSign, Calendar, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function CRM() {
    const queryClient = useQueryClient()
    const [selectedPhone, setSelectedPhone] = useState(null)
    const [messageText, setMessageText] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [isSyncing, setIsSyncing] = useState(false)

    // Periodic Sync Effect
    useEffect(() => {
        const interval = setInterval(async () => {
            if (isSyncing) return
            setIsSyncing(true)
            try {
                const { data } = await supabase.functions.invoke('whatsapp-proxy', {
                    body: { action: 'sync_recent' }
                })
                if (data?.count > 0) {
                    console.log('Background Sync: Found', data.count, 'new messages')
                    queryClient.invalidateQueries({ queryKey: ['whatsapp_conversations'] })
                    if (selectedPhone) {
                        queryClient.invalidateQueries({ queryKey: ['whatsapp_messages', selectedPhone] })
                    }
                }
            } catch (e) {
                console.error('Background sync failed:', e)
            } finally {
                setIsSyncing(false)
            }
        }, 30000) // 30 seconds

        return () => clearInterval(interval)
    }, [selectedPhone, isSyncing, queryClient])

    // 1. Fetch Conversations (Unique Phones)
    const { data: conversations = [], isLoading: isLoadingConv, error: listError } = useQuery({
        queryKey: ['whatsapp_conversations'],
        queryFn: async () => {
            console.log('Fetching conversations...')
            const { data, error } = await supabase
                .from('whatsapp_messages')
                .select('contact_phone, content, created_at, status, direction')
                .order('created_at', { ascending: false })
                .limit(500)

            if (error) {
                console.error('Error fetching conversations:', error)
                throw error
            }

            console.log('Raw messages fetched:', data?.length)

            // Dedup by phone
            const map = new Map()

            // Helper to normalize phone for grouping (Area Code + Last 8 digits)
            const normalizePhone = (phone) => {
                let s = String(phone || '').replace(/\D/g, '')
                if (s.startsWith('55') && s.length > 11) s = s.slice(2) // Remove 55 country code
                if (s.length > 8) return s.slice(0, 2) + s.slice(-8) // Area + Last 8
                return s
            }

            data.forEach(msg => {
                if (!msg.contact_phone) return
                const key = normalizePhone(msg.contact_phone)

                if (!map.has(key)) {
                    map.set(key, {
                        ...msg,
                        relatedPhones: new Set([msg.contact_phone])
                    })
                } else {
                    map.get(key).relatedPhones.add(msg.contact_phone)
                }
            })

            const deduped = Array.from(map.values()).map(c => ({
                ...c,
                relatedPhones: Array.from(c.relatedPhones)
            }))
            console.log('Deduped conversations:', deduped.length)
            return deduped
        }
    })

    // 2. Fetch Customers to map names
    const { data: customers = [] } = useQuery({
        queryKey: ['customers'],
        queryFn: () => base44.entities.Customers.list(),
        initialData: []
    })

    // Merge conversation with customer info
    const enrichedConversations = conversations.map(conv => {
        const customer = customers.find(c => {
            const rawClientPhone = String(c.phone || '').replace(/\D/g, '')
            const rawConvPhone = String(conv.contact_phone || '').replace(/\D/g, '')

            // Check matching last 8 digits (ignoring country/area code variations slightly)
            // Ideally should match exactly, but BR numbers have 8 or 9 digits and sometimes leading 55
            return rawClientPhone.endsWith(rawConvPhone.slice(-8)) && rawConvPhone.endsWith(rawClientPhone.slice(-8))
        })
        return {
            ...conv,
            customerName: customer?.name || conv.contact_phone,
            customerData: customer
        }
    }).filter(c => c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || c.contact_phone.includes(searchTerm))

    // Helper to identify active conversation
    const activeConversation = enrichedConversations.find(c => c.contact_phone === selectedPhone)

    // 3. Fetch Messages for Selected Phone (and its variants)
    const { data: messages = [], isLoading: isLoadingMsgs } = useQuery({
        queryKey: ['whatsapp_messages', selectedPhone, activeConversation?.relatedPhones],
        queryFn: async () => {
            if (!selectedPhone) return []

            // If we have related phones (merged contacts), fetch for all of them
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
        refetchInterval: 5000 // Poll every 5s for new messages
    })

    // 4. Send Message Mutation
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
            queryClient.invalidateQueries(['whatsapp_messages', selectedPhone])
            queryClient.invalidateQueries(['whatsapp_conversations'])
        }
    })

    const handleSend = () => {
        if (!messageText.trim() || !selectedPhone) return
        sendMessageMutation.mutate({ phone: selectedPhone, text: messageText })
    }

    // Get selected customer details
    const activeCustomer = activeConversation?.customerData

    // 5. Fetch Customer Sales for History & Favorites
    const { data: activeCustomerSales = [] } = useQuery({
        queryKey: ['customer_sales', activeCustomer?.id],
        queryFn: async () => {
            if (!activeCustomer?.id) return []
            // Fetch sales from 'sales' table for this customer
            const { data, error } = await supabase
                .from('sales')
                .select('*') // Need items column
                .eq('customer_id', activeCustomer.id)
                .order('sale_date', { ascending: false })
                .limit(50)

            if (error) {
                console.error('Error fetching sales:', error)
                return []
            }
            return data
        },
        enabled: !!activeCustomer?.id
    })

    // Calculate Top Products
    const topProducts = React.useMemo(() => {
        if (!activeCustomerSales?.length) return []
        const counts = {}

        activeCustomerSales.forEach(sale => {
            const items = sale.items || []
            let parsedItems = items
            // Handle if Supabase returns JSON column as string (rare in js client but possible)
            if (typeof items === 'string') {
                try { parsedItems = JSON.parse(items) } catch { }
            }

            if (Array.isArray(parsedItems)) {
                parsedItems.forEach(item => {
                    // product_id or id or name as key
                    const key = item.product_id || item.name
                    const name = item.name || item.product_name || 'Item'
                    if (!key) return

                    if (!counts[key]) counts[key] = { name, count: 0 }
                    counts[key].count += (Number(item.quantity) || 1)
                })
            }
        })

        return Object.values(counts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
    }, [activeCustomerSales])

    return (
        <div className="flex h-[calc(100vh-64px-48px)] bg-gray-50 border-t border-gray-200 overflow-hidden">
            {/* 1. Conversations List (Left) */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-bold text-gray-800">Mensagens</h2>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                queryClient.invalidateQueries(['whatsapp_conversations'])
                                queryClient.invalidateQueries(['whatsapp_messages'])
                            }}
                            disabled={isLoadingConv}
                            className="h-8 w-8 text-gray-400 hover:text-emerald-600"
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoadingConv ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <Input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar conversa..."
                            className="pl-9 bg-gray-50 border-none"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {enrichedConversations.length === 0 && !isLoadingConv && (
                        <div className="p-8 text-center text-gray-400">
                            <p className="text-sm">Nenhuma conversa encontrada.</p>
                            <p className="text-xs mt-2">Sincronize o histórico ou inicie uma nova conversa.</p>
                        </div>
                    )}
                    {enrichedConversations.map(conv => (
                        <div
                            key={conv.contact_phone}
                            onClick={() => setSelectedPhone(conv.contact_phone)}
                            className={`p-4 border-b border-gray-50 cursor-pointer transition-colors hover:bg-gray-50 ${selectedPhone === conv.contact_phone ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : ''}`}
                        >
                            <div className="flex items-center gap-3">
                                <Avatar>
                                    <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(conv.customerName)}&background=10b981&color=fff`} />
                                    <AvatarFallback>{conv.customerName.substring(0, 2)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className="font-semibold text-gray-900 truncate">{conv.customerName}</h3>
                                        <span className="text-xs text-gray-400">{format(new Date(conv.created_at), 'HH:mm')}</span>
                                    </div>
                                    <p className="text-sm text-gray-500 truncate">
                                        {conv.direction === 'outbound' && <span className="text-gray-400 mr-1">você:</span>}
                                        {conv.content}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 2. Chat Area (Center) */}
            <div className="flex-1 flex flex-col bg-[#e5ddd5]/30 relative">
                {selectedPhone ? (
                    <>
                        <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between shadow-sm z-10">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(activeConversation?.customerName || '')}&background=10b981&color=fff`} />
                                    <AvatarFallback>?</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="font-bold text-gray-900">{activeConversation?.customerName}</h3>
                                    <p className="text-xs text-gray-500">+{selectedPhone}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[70%] rounded-xl px-4 py-2 shadow-sm text-sm ${msg.direction === 'outbound' ? 'bg-[#d9fdd3] text-gray-900 rounded-tr-none' : 'bg-white text-gray-900 rounded-tl-none'}`}>
                                        <p>{msg.content}</p>
                                        <div className="text-[10px] text-gray-500 text-right mt-1 opacity-70">
                                            {format(new Date(msg.created_at), 'HH:mm')}
                                            {msg.direction === 'outbound' && <span className="ml-1">✓</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div id="scroll-anchor"></div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-200">
                            <div className="flex gap-2">
                                <Input
                                    value={messageText}
                                    onChange={e => setMessageText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                    placeholder="Digite uma mensagem..."
                                    className="bg-white border-gray-300 rounded-full"
                                />
                                <Button
                                    onClick={handleSend}
                                    disabled={sendMessageMutation.isPending || !messageText.trim()}
                                    className="rounded-full w-12 h-10 bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    {sendMessageMutation.isPending ? '...' : <Send className="w-5 h-5 -ml-0.5" />}
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <Phone className="w-8 h-8 opacity-50" />
                        </div>
                        <p>Selecione uma conversa para começar</p>
                    </div>
                )}
            </div>

            {/* 3. Customer Info (Right) */}
            {selectedPhone && (
                <div className="w-72 bg-white border-l border-gray-200 p-6 hidden lg:block">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6">Detalhes do Cliente</h3>

                    {activeCustomer ? (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="w-20 h-20 bg-emerald-100 rounded-full mx-auto flex items-center justify-center text-emerald-600 mb-3 text-2xl font-bold">
                                    {activeCustomer.name.substring(0, 2).toUpperCase()}
                                </div>
                                <h2 className="font-bold text-gray-900 text-lg">{activeCustomer.name}</h2>
                                <p className="text-sm text-gray-500">Cliente desde {new Date(activeCustomer.created_date).getFullYear()}</p>
                            </div>

                            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                                <div className="flex items-center gap-2 mb-1 text-emerald-700 font-medium">
                                    <DollarSign className="w-4 h-4" />
                                    Cashback Saldo
                                </div>
                                <div className="text-2xl font-black text-emerald-800">
                                    R$ {Number(activeCustomer.cashback_balance || 0).toFixed(2)}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                        <ShoppingBag className="w-4 h-4 text-gray-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Última Compra</p>
                                        <p className="font-medium text-sm text-gray-900">
                                            {activeCustomerSales?.[0] ? `R$ ${activeCustomerSales[0].total_amount?.toFixed(2)}` : 'R$ 0,00'}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {activeCustomerSales?.[0] ? format(new Date(activeCustomerSales[0].sale_date || activeCustomerSales[0].created_at), "d 'de' MMMM", { locale: ptBR }) : 'Nunca'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                        <Calendar className="w-4 h-4 text-gray-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Frequência</p>
                                        <p className="font-medium text-sm text-gray-900">{activeCustomerSales?.length || 0} compras</p>
                                    </div>
                                </div>

                                {/* Seção de Favoritos */}
                                {topProducts.length > 0 && (
                                    <div className="pt-4 border-t border-gray-100 mt-4">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Itens Favoritos</p>
                                        <div className="space-y-3">
                                            {topProducts.map((prod, idx) => (
                                                <div key={idx} className="flex items-center justify-between text-sm">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                                        <span className="truncate text-gray-700 font-medium">{prod.name}</span>
                                                    </div>
                                                    <span className="text-xs text-gray-400 shrink-0">{prod.count}x</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-gray-500 mt-10">
                            <User className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p>Número não cadastrado como cliente.</p>
                            <Button variant="outline" className="mt-4 w-full">Cadastrar Cliente</Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
