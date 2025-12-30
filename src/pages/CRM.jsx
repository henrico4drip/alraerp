import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/api/supabaseClient'
import { base44 } from '@/api/base44Client'
import { Send, Search, Phone, User, ShoppingBag, DollarSign, Calendar } from 'lucide-react'
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

    // 1. Fetch Conversations (Unique Phones)
    const { data: conversations = [], isLoading: isLoadingConv } = useQuery({
        queryKey: ['whatsapp_conversations'],
        queryFn: async () => {
            // Get unique phones from messages. 
            // Note: Supabase doesn't support SELECT DISTINCT ON nicely in JS client without rpc usually, 
            // or we just fetch all and dedup in JS for MVP if volume is low.
            // Better: Create a view or RPC in future. For MVP, fast fetch latest messages.

            const { data, error } = await supabase
                .from('whatsapp_messages')
                .select('contact_phone, content, created_at, status, direction')
                .order('created_at', { ascending: false })
                .limit(500) // Limit for MVP

            if (error) throw error

            // Dedup by phone
            const map = new Map()
            data.forEach(msg => {
                if (!map.has(msg.contact_phone)) {
                    map.set(msg.contact_phone, msg)
                }
            })

            return Array.from(map.values())
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
            const cPhone = String(c.phone).replace(/\D/g, '')
            return cPhone === conv.contact_phone || cPhone.endsWith(conv.contact_phone)
        })
        return {
            ...conv,
            customerName: customer?.name || conv.contact_phone,
            customerData: customer
        }
    }).filter(c => c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || c.contact_phone.includes(searchTerm))

    // 3. Fetch Messages for Selected Phone
    const { data: messages = [], isLoading: isLoadingMsgs } = useQuery({
        queryKey: ['whatsapp_messages', selectedPhone],
        queryFn: async () => {
            if (!selectedPhone) return []
            const { data, error } = await supabase
                .from('whatsapp_messages')
                .select('*')
                .eq('contact_phone', selectedPhone)
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
    const activeConversation = enrichedConversations.find(c => c.contact_phone === selectedPhone)
    const activeCustomer = activeConversation?.customerData

    return (
        <div className="flex h-[calc(100vh-64px-48px)] bg-gray-50 border-t border-gray-200 overflow-hidden">
            {/* 1. Conversations List (Left) */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 mb-3">Mensagens</h2>
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
                                        <p className="font-medium text-sm text-gray-900">R$ 150,00</p>
                                        <p className="text-xs text-gray-400">Ontem</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                        <Calendar className="w-4 h-4 text-gray-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Frequência</p>
                                        <p className="font-medium text-sm text-gray-900">3x por mês</p>
                                    </div>
                                </div>
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
