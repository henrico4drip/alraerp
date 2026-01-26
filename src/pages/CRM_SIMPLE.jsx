import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/api/supabaseClient'
import { base44 } from '@/api/base44Client'
import {
    Send, Search, Phone, User, ShoppingBag, DollarSign,
    Calendar, Brain, Sparkles, TrendingUp,
    CheckCircle2, Clock, Trophy, EyeOff,
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
    const queryClient = useQueryClient()
    const navigate = useNavigate()

    // --- State ---
    const [selectedPhone, setSelectedPhone] = useState(null)
    const [messageText, setMessageText] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [filterStatus, setFilterStatus] = useState('all')
    const [showDetails, setShowDetails] = useState(true)
    const [isRerankingAll, setIsRerankingAll] = useState(false)
    const [isRegistering, setIsRegistering] = useState(false)
    const [isLinking, setIsLinking] = useState(false)
    const [newCustomerName, setNewCustomerName] = useState('')
    const [linkSearch, setLinkSearch] = useState('')
    const [messagePage, setMessagePage] = useState(0)

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

    // --- SIMPLIFIED Messages Query ---
    const { data: messages = [], isLoading: isLoadingMsgs, refetch: refetchMsgs } = useQuery({
        queryKey: ['messages_simple', selectedPhone, messagePage],
        queryFn: async () => {
            if (!selectedPhone) return []

            const { data, error } = await supabase
                .from('whatsapp_messages')
                .select('*')
                .eq('contact_phone', selectedPhone)
                .order('created_at', { ascending: false })
                .range(messagePage * 50, (messagePage + 1) * 50 - 1)

            if (error) throw error
            return (data || []).reverse() // Reverse to show oldest first
        },
        enabled: !!selectedPhone
    })

    // Realtime subscription
    useEffect(() => {
        if (!selectedPhone) return

        const channel = supabase
            .channel('whatsapp_messages_realtime')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'whatsapp_messages',
                filter: `contact_phone=eq.${selectedPhone}`
            }, () => {
                refetchMsgs()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [selectedPhone, refetchMsgs])

    // Auto-scroll
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages])

    // Send Message
    const sendMutation = useMutation({
        mutationFn: async (text) => {
            const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: {
                    action: 'send_message',
                    payload: {
                        phone: selectedPhone,
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
            queryClient.invalidateQueries({ queryKey: ['whatsapp_conversations'] })
        }
    })

    const handleSendMessage = () => {
        if (!messageText.trim() || !selectedPhone) return
        sendMutation.mutate(messageText)
    }

