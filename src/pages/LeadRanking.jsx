import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { base44 } from '@/api/base44Client'
import { supabase } from '@/api/supabaseClient'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Brain, TrendingUp, Phone, DollarSign, Calendar, Sparkles, Send, MessageSquare, Copy, ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function LeadRanking() {
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const [sentMessages, setSentMessages] = useState({}) // Track sent messages by customer ID
    const [copiedId, setCopiedId] = useState(null) // Track copied message
    const [generatingId, setGeneratingId] = useState(null) // Track AI generation per customer
    const [isGeneratingAll, setIsGeneratingAll] = useState(false)
    const [isRerankingAll, setIsRerankingAll] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)

    // Periodic Sync Effect (Syncs with CRM message fetching)
    useEffect(() => {
        const interval = setInterval(async () => {
            if (isSyncing) return
            setIsSyncing(true)
            try {
                // Calls the same sync action as CRM
                const { data } = await supabase.functions.invoke('whatsapp-proxy', {
                    body: { action: 'sync_recent' }
                })

                // If new messages found, trigger AI Analysis and refresh
                if (data?.success && data?.updatedPhones?.length > 0) {
                    console.log('LeadRanking: New messages for', data.updatedPhones)

                    // Fetch all customers to find matching IDs (robust against formatting)
                    const { data: allCustomers } = await supabase
                        .from('customers')
                        .select('id, phone')

                    if (allCustomers) {
                        const targets = allCustomers.filter(c =>
                            c.phone && data.updatedPhones.includes(String(c.phone).replace(/\D/g, ''))
                        )

                        if (targets.length > 0) {
                            // Trigger AI for affected customers
                            await Promise.allSettled(targets.map(c =>
                                supabase.functions.invoke('whatsapp-ai-analyzer', {
                                    body: { customerId: c.id, phone: c.phone }
                                })
                            ))
                        }
                    }

                    queryClient.invalidateQueries({ queryKey: ['customers_ranking'] })
                    queryClient.invalidateQueries({ queryKey: ['whatsapp_conversations_ranking'] })
                }
            } catch (e) {
                console.error('LeadRanking sync failed:', e)
            } finally {
                setIsSyncing(false)
            }
        }, 30000) // 30 seconds interval

        return () => clearInterval(interval)
    }, [isSyncing, queryClient])

    // Send message mutation
    const sendMessageMutation = useMutation({
        mutationFn: async ({ phone, message, customerId }) => {
            const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: { action: 'send_message', payload: { phone, message } }
            })
            if (error || data?.error) throw error || new Error(data?.message || 'Erro ao enviar')

            // Mark as completed after sending
            if (customerId) {
                await supabase.from('customers').update({
                    ai_score: 0,
                    ai_status: 'Concluído',
                    ai_recommendation: 'Atendimento marcado como concluído (Mensagem enviada).',
                    last_ai_analysis: new Date().toISOString()
                }).eq('id', customerId)
            }

            return data
        },
        onSuccess: (_, variables) => {
            // Mark as sent
            setSentMessages(prev => ({ ...prev, [variables.customerId]: true }))
            // Show success feedback
            // alert('✅ Mensagem enviada com sucesso!') // Removed alert to be less intrusive or keep it? User didn't ask to remove.

            queryClient.invalidateQueries({ queryKey: ['customers_ranking'] })
            queryClient.invalidateQueries({ queryKey: ['whatsapp_conversations_ranking'] })
        },
        onError: (error) => {
            alert(`❌ Erro ao enviar mensagem: ${error.message}`)
        }
    })

    // Generate AI Suggested Message mutation
    const analyzeAiMutation = useMutation({
        mutationFn: async ({ customerId, phone }) => {
            if (!customerId || !phone) return
            const { data, error } = await supabase.functions.invoke('whatsapp-ai-analyzer', {
                body: { customerId, phone }
            })
            if (error || data?.error) throw new Error(error?.message || data?.error || 'Falha na análise de IA')
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers_ranking'] })
            queryClient.invalidateQueries({ queryKey: ['whatsapp_conversations_ranking'] })
        },
        onSettled: () => {
            setGeneratingId(null)
        }
    })

    // Fetch customers with AI scores
    const { data: customers = [], isLoading } = useQuery({
        queryKey: ['customers_ranking'],
        queryFn: async () => {
            const { data } = await supabase
                .from('customers')
                .select('*')
                .gt('ai_score', 0)
                .order('ai_score', { ascending: false })
                .limit(10)
            return data
        }
    })

    // Fetch WhatsApp conversations for phone numbers
    const { data: conversations = [] } = useQuery({
        queryKey: ['whatsapp_conversations_ranking'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('whatsapp_messages')
                .select('contact_phone, content, created_at, direction')
                .order('created_at', { ascending: false })
                .limit(1000)

            if (error) throw error

            // Get latest message per contact
            const map = new Map()
            data.forEach(msg => {
                if (!msg.contact_phone) return
                const normalized = String(msg.contact_phone || '').replace(/\D/g, '')
                if (!map.has(normalized)) {
                    map.set(normalized, msg)
                }
            })

            return Array.from(map.values())
        }
    })

    const normalizePhone = (phone) => {
        let s = String(phone || '').replace(/\D/g, '')
        if (s.startsWith('55') && s.length > 10) s = s.slice(2)
        if (s.length === 11 && s[2] === '9') return s.slice(0, 2) + s.slice(3)
        return s
    }

    const formatPhoneDisplay = (phone) => {
        let s = String(phone || '').replace(/\D/g, '')
        if (s.startsWith('55')) s = s.slice(2)
        if (s.length === 11) return `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7)}`
        if (s.length === 10) return `(${s.slice(0, 2)}) ${s.slice(2, 6)}-${s.slice(6)}`
        return phone
    }

    const getScoreColor = (score) => {
        if (score >= 80) return 'from-green-500 to-emerald-600'
        if (score >= 60) return 'from-blue-500 to-indigo-600'
        if (score >= 40) return 'from-yellow-500 to-orange-600'
        return 'from-gray-500 to-gray-600'
    }

    const getScoreLabel = (score) => {
        if (score >= 80) return 'Muito Alto'
        if (score >= 60) return 'Alto'
        if (score >= 40) return 'Médio'
        return 'Baixo'
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium">Carregando ranking...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/crm')}
                        className="mb-4 text-gray-500 hover:text-indigo-600 p-0 h-auto"
                    >
                        <ArrowLeft className="w-4 h-4 mr-1.5" />
                        Voltar ao CRM
                    </Button>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <Brain className="w-6 h-6 text-indigo-600" />
                                Ranking de Leads
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">Top 10 oportunidades de venda identificadas por IA</p>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white rounded-full shadow-sm border border-gray-200">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                                <span className="text-xs font-medium text-gray-600">Tempo real</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Ranking List */}
                {customers.length === 0 ? (
                    <Card className="p-12 text-center bg-white border border-gray-200 shadow-sm">
                        <Brain className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Nenhum lead analisado</h3>
                        <p className="text-sm text-gray-500">Interaja no CRM para gerar insights.</p>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center justify-end gap-2 mb-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                    if (isGeneratingAll) return
                                    setIsGeneratingAll(true)
                                    try {
                                        for (const c of customers) {
                                            if (c.ai_suggested_message) continue
                                            await analyzeAiMutation.mutateAsync({ customerId: c.id, phone: c.phone })
                                        }
                                    } finally {
                                        setIsGeneratingAll(false)
                                    }
                                }}
                                disabled={isGeneratingAll || analyzeAiMutation.isPending}
                                className="h-8 text-xs"
                            >
                                {isGeneratingAll ? 'Gerando...' : 'Gerar Sugestões'}
                            </Button>

                            <Button
                                size="sm"
                                onClick={async () => {
                                    if (isRerankingAll) return
                                    setIsRerankingAll(true)
                                    try {
                                        for (const c of customers) {
                                            await analyzeAiMutation.mutateAsync({ customerId: c.id, phone: c.phone })
                                        }
                                    } finally {
                                        setIsRerankingAll(false)
                                    }
                                }}
                                disabled={isRerankingAll || analyzeAiMutation.isPending}
                                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                <Sparkles className="w-3 h-3 mr-1.5" />
                                {isRerankingAll ? 'Atualizando...' : 'Atualizar Ranking'}
                            </Button>
                        </div>

                        {customers.map((customer, index) => {
                            const conversation = conversations.find(c =>
                                normalizePhone(c.contact_phone) === normalizePhone(customer.phone)
                            )
                            // We keep colors but make them less overwhelming
                            const scoreColor = getScoreColor(customer.ai_score)

                            return (
                                <Card
                                    key={customer.id}
                                    className="group relative overflow-hidden bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200"
                                >
                                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-5">
                                        {/* Left: Rank & Score */}
                                        <div className="flex sm:flex-col items-center gap-3 sm:w-24 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-gray-100 pb-4 sm:pb-0 sm:pr-4">
                                            <div className="flex flex-col items-center">
                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Rank</span>
                                                <span className="text-2xl font-black text-gray-900">#{index + 1}</span>
                                            </div>
                                            <div className={`h-px w-full sm:w-px sm:h-8 bg-gray-100`}></div>
                                            <div className="flex flex-col items-center">
                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Score</span>
                                                <div className={`flex items-center gap-1 font-black text-xl ${customer.ai_score >= 80 ? 'text-green-600' :
                                                    customer.ai_score >= 60 ? 'text-blue-600' :
                                                        customer.ai_score >= 40 ? 'text-orange-500' : 'text-gray-500'
                                                    }`}>
                                                    {customer.ai_score}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Middle: Info & Insights */}
                                        <div className="flex-1 min-w-0 grid gap-4">
                                            {/* Header Info */}
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10 border border-gray-100">
                                                        <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(customer.name)}&background=f3f4f6&color=374151`} />
                                                        <AvatarFallback className="bg-gray-100 text-gray-600 font-bold text-xs">
                                                            {customer.name.substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <h3 className="font-bold text-gray-900 leading-tight">{customer.name}</h3>
                                                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                                            <Phone className="w-3 h-3" />
                                                            {formatPhoneDisplay(customer.phone)}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Meta Badges */}
                                                <div className="flex flex-col items-end gap-1.5">
                                                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${customer.ai_status?.includes('URGENTE') ? 'bg-red-50 text-red-700 border-red-100' : 'bg-gray-50 text-gray-600 border-gray-100'
                                                        }`}>
                                                        {customer.ai_status || 'Neutro'}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                                        {conversation && (
                                                            <span className={`flex items-center gap-1 ${conversation.direction === 'inbound' ? 'text-orange-500 font-bold' : ''}`}>
                                                                <div className={`w-1.5 h-1.5 rounded-full ${conversation.direction === 'inbound' ? 'bg-orange-500' : 'bg-gray-300'}`}></div>
                                                                {conversation.direction === 'inbound' ? 'Esperando' : 'Respondido'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* AI Recommendation Box */}
                                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                <div className="flex gap-2">
                                                    <Brain className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                                                    <div className="text-sm text-gray-700">
                                                        <span className="font-semibold text-gray-900 block text-xs uppercase mb-0.5">Estratégia</span>
                                                        "{customer.ai_recommendation || 'Aguardando análise...'}"
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Action Area */}
                                        <div className="sm:w-72 flex-shrink-0 flex flex-col gap-3 border-t sm:border-t-0 sm:border-l border-gray-100 pt-4 sm:pt-0 sm:pl-5">
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Sugestão de Msg</span>
                                                    {!customer.ai_suggested_message && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setGeneratingId(customer.id)
                                                                analyzeAiMutation.mutate({ customerId: customer.id, phone: customer.phone })
                                                            }}
                                                            disabled={generatingId === customer.id || analyzeAiMutation.isPending}
                                                            className="h-5 text-[10px] px-2 text-indigo-600 hover:text-indigo-700"
                                                        >
                                                            Gerar
                                                        </Button>
                                                    )}
                                                </div>

                                                {customer.ai_suggested_message ? (
                                                    <div className="relative group/msg">
                                                        <div className="text-xs text-gray-600 bg-white border border-gray-200 rounded p-2 italic leading-relaxed min-h-[60px]">
                                                            "{customer.ai_suggested_message}"
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(customer.ai_suggested_message)
                                                                setCopiedId(customer.id)
                                                                setTimeout(() => setCopiedId(null), 2000)
                                                            }}
                                                            className="absolute top-1 right-1 h-5 w-5 p-0 opacity-0 group-hover/msg:opacity-100 transition-opacity bg-white border border-gray-200 shadow-sm"
                                                            title="Copiar"
                                                        >
                                                            <Copy className="w-3 h-3 text-gray-400" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="h-[60px] flex items-center justify-center text-xs text-gray-300 border border-dashed border-gray-200 rounded bg-gray-50/50">
                                                        Sem sugestão
                                                    </div>
                                                )}
                                            </div>

                                            {customer.ai_suggested_message && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => {
                                                        const targetPhone = conversation?.contact_phone || customer.phone;
                                                        navigate(`/crm?phone=${targetPhone}&message=${encodeURIComponent(customer.ai_suggested_message)}`);
                                                    }}
                                                    className="w-full h-8 text-xs font-semibold shadow-sm transition-all bg-emerald-600 hover:bg-emerald-700 text-white"
                                                >
                                                    <Send className="w-3 h-3 mr-1.5" />
                                                    Enviar Agora
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            )
                        })}
                    </div>
                )}

                {/* Footer */}
                <div className="mt-8 text-center pb-8">
                    <p className="text-xs text-gray-400">
                        Os dados são atualizados automaticamente com base nas interações do WhatsApp.
                    </p>
                </div>
            </div>
        </div>
    )
}
