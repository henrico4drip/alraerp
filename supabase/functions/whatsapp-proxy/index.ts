import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-version',
}

const EVO_CONFIG = {
    url: Deno.env.get('WPP_URL')?.replace(/\/$/, '') || 'http://84.247.143.180:8080',
    apiKey: Deno.env.get('WPPCONNECT_SECRET_KEY') || 'Henrico9516',
}

class EvolutionService {
    static async request(path: string, init: RequestInit = {}): Promise<{ status: number, json: any, text: string }> {
        const url = `${EVO_CONFIG.url}${path}`
        const headers: any = {
            'apikey': EVO_CONFIG.apiKey,
            ...init.headers
        }

        if ((init.method === 'POST' || init.method === 'PUT') && init.body && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json'
        }

        try {
            console.log(`[EVO] ${init.method || 'GET'} ${url}`)
            const res = await fetch(url, { ...init, headers })
            const text = await res.text()
            let json = null
            try { json = JSON.parse(text) } catch { }
            return { status: res.status, json, text }
        } catch (e: any) {
            console.error(`[EVO] Fatal Error: ${e.message}`)
            return { status: 0, json: null, text: e.message }
        }
    }
}

// --- HELPER: Process Messages and Save to DB ---
async function processMessages(adminClient: any, messages: any[], activeUserId: string) {
    if (!messages || !Array.isArray(messages)) return { count: 0 }

    let count = 0
    console.log(`[PROXY] Processing ${messages.length} messages for user ${activeUserId}`)

    for (const msg of messages) {
        const jid = msg.key?.remoteJid || ''
        if (!jid || jid.includes('@g.us') || jid.includes('@broadcast')) continue

        const phone = jid.split('@')[0]
        const isFromMe = msg.key?.fromMe === true

        // Content Extraction
        const m = msg.message
        if (!m) continue

        const content = m.conversation ||
            m.extendedTextMessage?.text ||
            (m.imageMessage ? (m.imageMessage.caption || '[Imagem]') : '') ||
            (m.videoMessage ? (m.videoMessage.caption || '[Vídeo]') : '') ||
            (m.audioMessage ? '[Áudio]' : '') ||
            (m.documentMessage ? '[Documento]' : '') ||
            (m.stickerMessage ? '[Sticker]' : '') ||
            '[Mídia]'

        if (!content || String(content).trim().length === 0) continue

        const waId = msg.key?.id
        const ts = msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000) : new Date()

        // Check Duplicates
        if (waId) {
            const { data: existing } = await adminClient.from('whatsapp_messages').select('id').eq('wa_message_id', waId).maybeSingle()
            if (existing) continue
        }

        // Insert
        const { error: insertError } = await adminClient.from('whatsapp_messages').insert({
            user_id: activeUserId,
            contact_phone: phone,
            contact_name: msg.pushName || phone,
            content: content,
            direction: isFromMe ? 'outbound' : 'inbound',
            status: isFromMe ? 'sent' : 'received',
            wa_message_id: waId,
            created_at: ts.toISOString()
        })

        if (!insertError) count++
    }

    return { count }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const bodyText = await req.text()
        let body: any = {}
        try { body = JSON.parse(bodyText) } catch { }

        const { action, payload } = body

        // Initialize Supabase Clients
        const authHeader = req.headers.get('Authorization') ?? ''
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        })
        const adminClient = createClient(supabaseUrl, supabaseServiceKey)

        // --- SPECIAL CASE: WEBHOOKS ---
        if (body.event === 'messages.upsert') {
            const instance = body.instance || ''
            if (instance.startsWith('erp_')) {
                // Heuristic: erp_PREFIX -> fetch user by checking settings or common pattern
                // For this ERP, we'll try to find a user where user.id starts with prefix
                const prefix = instance.replace('erp_', '')

                // We'll search for the first user_id in settings that matches this instance name
                const { data: settings } = await adminClient.from('settings')
                    .select('user_id')
                    .filter('whatsapp_instance_name', 'eq', instance)
                    .maybeSingle()

                // If not found in settings, we cannot safely attribute. 
                // But as a fallback for this specific setup, we'll try to find any existing user with that ID prefix
                let userId = settings?.user_id

                if (!userId) {
                    console.log(`[WEBHOOK] Instance ${instance} not found in settings.`)
                    return new Response(JSON.stringify({ success: true, message: 'Instance not mapped' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
                }

                const messages = body.data?.messages || []
                await processMessages(adminClient, messages, userId)

                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }
        }

        // --- STANDARD PROXY ACTIONS ---
        const { data: { user } } = await supabaseClient.auth.getUser()
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const instanceName = `erp_${user.id.split('-')[0]}`
        console.log(`[PROXY] Action: ${action} | Instance: ${instanceName}`)

        let responseData: any = null

        switch (action) {
            case 'get_status': {
                const res = await EvolutionService.request(`/instance/connectionState/${instanceName}`)
                responseData = res.json || { status: 'disconnected' }
                break
            }

            case 'fetch_contacts': {
                let res = await EvolutionService.request(`/chat/findContacts/${instanceName}`, {
                    method: 'POST',
                    body: JSON.stringify(payload || { where: {}, limit: 1000 })
                })
                if (res.status === 404 || !(res.json?.records || res.json?.length)) {
                    const fallbackRes = await EvolutionService.request(`/contact/findContacts/${instanceName}`, {
                        method: 'POST',
                        body: JSON.stringify(payload || { where: {}, limit: 1000 })
                    })
                    responseData = fallbackRes.json || []
                } else {
                    responseData = res.json || []
                }
                break
            }

            case 'fetch_inbox': {
                const res = await EvolutionService.request(`/chat/findChats/${instanceName}`, {
                    method: 'POST',
                    body: JSON.stringify(payload || { where: {}, limit: 100 })
                })
                responseData = res.json || []
                break
            }

            case 'send_message': {
                const res = await EvolutionService.request(`/message/sendText/${instanceName}`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                })
                responseData = res.json
                // Save outgoing message to cache
                if (res.status === 201 || res.status === 200) {
                    await adminClient.from('whatsapp_messages').insert({
                        user_id: user.id,
                        contact_phone: payload.number?.replace(/\D/g, ''),
                        content: payload.text,
                        direction: 'outbound',
                        status: 'sent',
                        wa_message_id: res.json?.key?.id || `out_${Date.now()}`
                    })
                }
                break
            }

            case 'sync_recent': {
                const limit = payload?.limit || 20
                const chatsRes = await EvolutionService.request(`/chat/findChats/${instanceName}`)
                const chats = chatsRes.json || []
                const recentChats = Array.isArray(chats) ? chats.slice(0, limit) : (chats.records?.slice(0, limit) || [])

                const updatedPhones = []
                for (const chat of recentChats) {
                    const jid = chat.id || chat.remoteJid
                    const msgsRes = await EvolutionService.request(`/chat/findMessages/${instanceName}`, {
                        method: 'POST',
                        body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit: 20 })
                    })
                    const msgs = Array.isArray(msgsRes.json) ? msgsRes.json : (msgsRes.json?.messages || [])
                    const { count } = await processMessages(adminClient, msgs, user.id)
                    if (count > 0) updatedPhones.push(jid.split('@')[0])
                }

                responseData = { success: true, updatedPhones }
                break
            }

            case 'set_webhook': {
                const { webhookUrl } = payload || {}
                const res = await EvolutionService.request(`/webhook/set/${instanceName}`, {
                    method: 'POST',
                    body: JSON.stringify({
                        webhook: {
                            url: webhookUrl,
                            enabled: true,
                            webhookByEvents: false,
                            events: ['MESSAGES_UPSERT']
                        }
                    })
                })
                responseData = res.json
                // Update settings with instance name for webhook attribution
                await adminClient.from('settings').update({ whatsapp_instance_name: instanceName }).eq('user_id', user.id)
                break
            }

            case 'connect': {
                const res = await EvolutionService.request(`/instance/connect/${instanceName}`)
                responseData = res.json
                break
            }

            case 'proxy_request': {
                const { path, method, body: proxyBody } = payload || {}
                const res = await EvolutionService.request(path, {
                    method: method || 'GET',
                    body: proxyBody ? JSON.stringify(proxyBody) : undefined
                })
                responseData = res.json || res.text
                break
            }

            default:
                responseData = { error: 'Invalid action' }
        }

        return new Response(JSON.stringify(responseData), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('Proxy error:', error)
        return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
})
