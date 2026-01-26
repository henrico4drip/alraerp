import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// -- UTILS --
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EVO_CONFIG = {
    url: Deno.env.get('WPP_URL')?.replace(/\/$/, '') || 'http://84.247.143.180:8080',
    apiKey: Deno.env.get('WPPCONNECT_SECRET_KEY') || 'Henrico9516',
}

const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY')

// -- SERVICE CLASSES --

class EvolutionService {
    static async request(path: string, init: RequestInit = {}, retryWithFallback = true): Promise<{ status: number, json: any, text: string }> {
        const url = `${EVO_CONFIG.url}${path}`
        const configKey = EVO_CONFIG.apiKey

        // CRITICAL: Send ONLY 'apikey' (lowercase). Sending both 'apikey' and 'apiKey' 
        // causes some Evolution API versions (including v1.7.4) to return 401 Unauthorized.
        const headers: any = {
            'apikey': configKey,
            ...init.headers
        }

        if (['POST', 'PUT'].includes(init.method || '')) {
            headers['Content-Type'] = 'application/json'
        }

        try {
            console.log(`[EVO] Request: ${init.method || 'GET'} ${url} (Key prefix: ${configKey.substring(0, 3)}...)`)
            const res = await fetch(url, { ...init, headers })
            const text = await res.text()
            let json = null
            try { json = JSON.parse(text) } catch { }

            // AUTO-RECOVERY: If 401 and we have a hardcoded fallback that is different, try it once
            if (res.status === 401 && retryWithFallback && configKey !== 'Henrico9516') {
                console.warn(`[EVO] 401 Unauthorized with configured key. Retrying with default fallback 'Henrico9516'...`)
                const fallbackHeaders = { ...headers, 'apikey': 'Henrico9516', 'apiKey': 'Henrico9516' }
                const retryRes = await fetch(url, { ...init, headers: fallbackHeaders })
                const retryText = await retryRes.text()
                let retryJson = null
                try { retryJson = JSON.parse(retryText) } catch { }
                return { status: retryRes.status, json: retryJson, text: retryText }
            }

            return { status: res.status, json, text }
        } catch (e) {
            console.error(`[EVO] Fatal Error: ${e.message}`)
            return { status: 0, json: null, text: e.message }
        }
    }
}

class AIService {
    static async transcribeAudio(base64: string) {
        if (!OPENAI_KEY) return '[Áudio]'
        try {
            const audioBlob = await (await fetch(`data:audio/ogg;base64,${base64}`)).blob()
            const formData = new FormData()
            formData.append('file', audioBlob, 'audio.ogg');
            formData.append('model', 'whisper-1')

            const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${OPENAI_KEY}` },
                body: formData
            })
            const json = await res.json()
            return json.text ? `🎤 [Audio]: ${json.text}` : '[Áudio]'
        } catch { return '[Áudio]' }
    }

    static async analyzeImage(base64: string) {
        if (!OPENAI_KEY) return '[Imagem]'
        try {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [{
                        role: "user", content: [
                            { type: "text", text: "Descreva brevemente o que está nesta imagem enviada via WhatsApp." },
                            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } }
                        ]
                    }]
                })
            })
            const json = await res.json()
            return json.choices?.[0]?.message?.content ? `📸 [Imagem]: ${json.choices[0].message.content}` : '[Imagem]'
        } catch { return '[Imagem]' }
    }

    static async suggestResponse(messages: any[]) {
        if (!OPENAI_KEY) return null
        try {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: "Você é um assistente de vendas prestativo. Baseado nas últimas mensagens do cliente, sugira uma resposta curta, empática e profissional. Use emojis moderadamente." },
                        ...messages.map((m: any) => ({
                            role: m.direction === 'outbound' ? 'assistant' : 'user',
                            content: m.content
                        }))
                    ]
                })
            })
            const json = await res.json()
            return json.choices?.[0]?.message?.content
        } catch { return null }
    }
}

// -- MAIN HANDLER --

serve(async (req) => {
    // 1. Handle CORS Preflight
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const bodyText = await req.text()
        let body: any = {}
        try { body = JSON.parse(bodyText) } catch { }

        const { action, payload } = body
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // =========================================================================================
        // WEBHOOK HANDLER (No Authentication Required for Speed/Callback)
        // =========================================================================================
        // We check 'event' property to identify webhook calls vs internal actions
        // Supported Events: "messages.upsert", "contacts.upsert", "contacts.update"

        if (body.event === 'messages.upsert' || body.event === 'contacts.upsert' || body.event === 'contacts.update') {
            const data = body.data || body.data?.data || {}
            // Evolution API structure varies: sometimes body.data is the payload, sometimes body.data.data

            const instanceName = body.instance || ''
            // Instance convention: "erp_USERID" -> extract header id
            const prefix = instanceName.replace('erp_', '')

            // Find user owner of this instance
            const { data: users } = await supabaseAdmin.from('profiles').select('id').ilike('id', `${prefix}%`)
            const userId = users?.[0]?.id

            if (!userId) {
                console.warn(`[WEBHOOK] User not found for instance ${instanceName}`)
                return new Response('ok', { headers: corsHeaders })
            }

            // --- CONTACTS HANDLING ---
            if (body.event === 'contacts.upsert' || body.event === 'contacts.update') {
                const contacts = Array.isArray(data) ? data : [data]
                for (const c of contacts) {
                    if (!c.id) continue
                    const phone = c.id.split('@')[0]
                    const name = c.pushName || c.name || c.verifiedName || phone

                    // Upsert mechanism
                    const { data: existing } = await supabaseAdmin.from('customers')
                        .select('id')
                        .eq('phone', phone)
                        .maybeSingle()

                    if (!existing) {
                        await supabaseAdmin.from('customers').insert({
                            user_id: userId,
                            phone: phone,
                            name: name,
                            notes: 'Atualizado via Webhook',
                            created_date: new Date().toISOString()
                        })
                    } else {
                        // Optional: update name if significantly better?
                        // await supabaseAdmin.from('customers').update({ name }).eq('id', existing.id)
                    }
                }
                return new Response('ok', { headers: corsHeaders })
            }

            // --- MESSAGES HANDLING ---
            // Filter out status updates or weird events
            if (!data || data.key?.fromMe) return new Response('ok', { headers: corsHeaders })

            const jid = data.key.remoteJid
            // Ignore status updates (@status.broadcast) and groups (@g.us) if not needed
            if (jid === 'status@broadcast' || jid.includes('@g.us')) return new Response('ok', { headers: corsHeaders })

            const phone = jid.split('@')[0]
            const type = data.messageType
            let content = ''

            // Basic extraction based on type
            if (type === 'conversation') content = data.message.conversation
            else if (type === 'extendedTextMessage') content = data.message.extendedTextMessage.text
            else if (type === 'audioMessage') content = await AIService.transcribeAudio(data.message.base64)
            else if (type === 'imageMessage') content = await AIService.analyzeImage(data.message.base64)
            else if (data.message?.viewOnceMessageV2?.message?.imageMessage) {
                // ViewOnce images
                content = await AIService.analyzeImage(
                    data.message.viewOnceMessageV2.message.imageMessage.base64 || '' // Evolution often sends base64 if configured
                )
            }

            if (content) {
                await supabaseAdmin.from('whatsapp_messages').insert({
                    user_id: userId,
                    contact_phone: phone,
                    content,
                    direction: 'inbound',
                    wa_message_id: data.key.id,
                    status: 'received'
                })
            }
            return new Response('ok', { headers: corsHeaders })
        }


        // =========================================================================================
        // INTERNAL ACTIONS (Authenticated via Supabase Auth)
        // =========================================================================================

        const authHeader = req.headers.get('Authorization') ?? ''
        const supabaseUser = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )
        const { data: { user } } = await supabaseUser.auth.getUser()

        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const instanceName = `erp_${user.id.split('-')[0]}`

        switch (action) {

            // --- INSTANCE MANAGEMENT ---

            case 'get_status': {
                const res = await EvolutionService.request(`/instance/connectionState/${instanceName}`)
                const json = res.json || {}
                // Mapping inconsistent states to 'connected' or 'disconnected'
                const state = json.instance?.state || json.state
                const status = state === 'open' ? 'connected' : 'disconnected'
                return new Response(JSON.stringify({ status, instance: json.instance, ...json }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            case 'connect': {
                // Try to create first
                const createRes = await EvolutionService.request('/instance/create', {
                    method: 'POST',
                    body: JSON.stringify({ instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS" })
                })

                // If it exists (403 or error), try to fetch connect/QR
                if (createRes.status === 403 || createRes.json?.error) {
                    const connectRes = await EvolutionService.request(`/instance/connect/${instanceName}`)
                    return new Response(JSON.stringify(connectRes.json), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
                }
                return new Response(JSON.stringify(createRes.json), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            case 'logout': {
                const res = await EvolutionService.request(`/instance/logout/${instanceName}`, { method: 'DELETE' })
                return new Response(JSON.stringify(res.json), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            case 'delete_instance': {
                const res = await EvolutionService.request(`/instance/delete/${instanceName}`, { method: 'DELETE' })
                return new Response(JSON.stringify(res.json), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            // --- DATA SYNC ACTIONS ---

            case 'fetch_contacts': {
                // Try multiple endpoints for robustness
                // 1. /contact/findContacts (standard)
                let res = await EvolutionService.request(`/contact/findContacts/${instanceName}`)
                let contacts = []

                if (Array.isArray(res.json)) contacts = res.json
                else if (res.json && Array.isArray(res.json.contacts)) contacts = res.json.contacts
                else if (res.json && Array.isArray(res.json.data)) contacts = res.json.data

                // 2. Fallback: /contact/fetchContacts (older versions)
                if (contacts.length === 0) {
                    res = await EvolutionService.request(`/contact/fetchContacts/${instanceName}`)
                    if (Array.isArray(res.json)) contacts = res.json
                }

                console.log(`[CONTACTS] Fetched ${contacts.length} contacts from Evo`)

                let savedCount = 0
                for (const c of contacts) {
                    const phone = c.id.split('@')[0]
                    const name = c.pushName || c.name || c.verifiedName || phone
                    const picture = c.profilePictureUrl || null

                    // Upsert Logic
                    const { data: existing } = await supabaseAdmin.from('customers')
                        .select('id, user_id')
                        .eq('phone', phone)
                        .maybeSingle()

                    if (!existing) {
                        await supabaseAdmin.from('customers').insert({
                            user_id: user.id,
                            phone: phone,
                            name: name,
                            notes: 'Importado do WhatsApp (Sync)',
                            created_date: new Date().toISOString()
                        })
                        savedCount++
                    }
                }
                return new Response(JSON.stringify({ success: true, count: contacts.length, saved: savedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            case 'fetch_inbox': {
                // Fetch chats from Evolution
                const res = await EvolutionService.request(`/chat/findChats/${instanceName}`)
                let chats = []
                if (Array.isArray(res.json)) chats = res.json
                else if (res.json && Array.isArray(res.json.chats)) chats = res.json.chats
                else if (res.json && Array.isArray(res.json.data)) chats = res.json.data

                // Fallback for empty results
                if (chats.length === 0) {
                    const res2 = await EvolutionService.request(`/chat/findConversations/${instanceName}`)
                    if (Array.isArray(res2.json)) chats = res2.json
                    else if (res2.json && Array.isArray(res2.json.conversations)) chats = res2.json.conversations
                }

                // Process chats to ensure 'name' is populated
                const processed = chats.map((c: any) => ({
                    ...c,
                    name: c.pushName || c.name || c.id?.split('@')[0] || 'Desconhecido'
                }))

                return new Response(JSON.stringify({ chats: processed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            case 'sync_chat': {
                // Sync historical messages for a specific chat
                const { phone, jid: providedJid } = payload || {}
                const cleanPhone = (phone || '').replace(/\D/g, '')
                const jid = providedJid || (cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`)

                console.log(`[SYNC] Syncing messages for ${jid}`)

                // Attempt 1: Standard Payload
                let res = await EvolutionService.request(`/chat/fetchMessages/${instanceName}`, {
                    method: 'POST', body: JSON.stringify({ remoteJid: jid, limit: 50 })
                })

                // Attempt 2: "Where" Payload (Prisma style)
                let msgs = Array.isArray(res.json) ? res.json : (res.json?.messages || res.json?.data || [])
                if (msgs.length === 0) {
                    console.log('[SYNC] Retrying with Prisma-style payload...')
                    res = await EvolutionService.request(`/chat/fetchMessages/${instanceName}`, {
                        method: 'POST', body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit: 50 })
                    })
                    msgs = Array.isArray(res.json) ? res.json : (res.json?.messages || res.json?.data || [])
                }

                let savedCount = 0
                for (const m of msgs) {
                    // Extract content
                    let content = ''
                    const msgObj = m.message
                    if (!msgObj) continue;

                    if (msgObj.conversation) content = msgObj.conversation
                    else if (msgObj.extendedTextMessage?.text) content = msgObj.extendedTextMessage.text
                    else if (msgObj.imageMessage) content = msgObj.imageMessage.caption || '[Imagem]'
                    else if (msgObj.videoMessage) content = msgObj.videoMessage.caption || '[Vídeo]'
                    else if (msgObj.audioMessage) content = '[Áudio]'
                    else content = '[Mídia]'

                    // Check duplicate by ID
                    const { data: exists } = await supabaseAdmin
                        .from('whatsapp_messages')
                        .select('id')
                        .eq('wa_message_id', m.key.id)
                        .maybeSingle()

                    if (!exists && m.key?.id) {
                        await supabaseAdmin.from('whatsapp_messages').insert({
                            user_id: user.id,
                            contact_phone: cleanPhone,
                            content: content,
                            direction: m.key.fromMe ? 'outbound' : 'inbound',
                            wa_message_id: m.key.id,
                            status: m.key.fromMe ? 'sent' : 'received',
                            created_at: m.messageTimestamp ? new Date(m.messageTimestamp * 1000).toISOString() : new Date().toISOString()
                        })
                        savedCount++
                    }
                }
                return new Response(JSON.stringify({ success: true, saved: savedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            case 'send_message': {
                const { phone, message, jid: providedJid } = payload || {}
                const cleanPhone = (phone || '').replace(/\D/g, '')
                // Heuristic: If providedJid has @lid, keep it. Else assume phone number.
                let targetJid = providedJid || `${cleanPhone}@s.whatsapp.net`

                // -- ROBUST SEND LOGIC --
                console.log(`[SEND] Sending to ${targetJid}`)

                // 1. Try Standard Send
                let res = await EvolutionService.request(`/message/sendText/${instanceName}`, {
                    method: 'POST', body: JSON.stringify({ number: targetJid, text: message })
                })

                // 2. Fallback: If 400/404 and it's a LID, try phone number discovery (The "Pulo do Gato")
                if ((res.status === 400 || res.status === 404) && targetJid.includes('@lid')) {
                    console.log(`[SEND] LID failed (${res.status}). Trying to discover real phone JID...`)

                    // Strategy: Fetch profile/contact to see if we get the real JID
                    const contactRes = await EvolutionService.request(`/contact/find/${instanceName}`, {
                        method: 'POST', body: JSON.stringify({ number: targetJid })
                    })

                    // Check if successful and has alternative JID
                    const contact = contactRes.json
                    const alternativeJid = contact?.id || contact?.remoteJid || contact?.jid

                    if (alternativeJid && alternativeJid.includes('@s.whatsapp.net')) {
                        console.log(`[SEND] Found alternative JID: ${alternativeJid}. Retrying send...`)
                        targetJid = alternativeJid // Update target
                        res = await EvolutionService.request(`/message/sendText/${instanceName}`, {
                            method: 'POST', body: JSON.stringify({ number: targetJid, text: message })
                        })
                    } else {
                        // Strategy: Check message history for recent real JID? 
                        // (Too expensive for Edge Function timeout usually, skipping for now)
                    }
                }

                // 3. Fallback: Force send flag
                if (res.status === 400) {
                    console.log(`[SEND] Retrying with forceSend...`)
                    res = await EvolutionService.request(`/message/sendText/${instanceName}`, {
                        method: 'POST', body: JSON.stringify({ number: targetJid, text: message, forceSend: true })
                    })
                }

                if (res.status === 201 || res.status === 200) {
                    await supabaseAdmin.from('whatsapp_messages').insert({
                        user_id: user.id,
                        contact_phone: cleanPhone,
                        content: message,
                        direction: 'outbound',
                        status: 'sent'
                    })
                }

                return new Response(JSON.stringify(res.json), {
                    status: (res.status === 200 || res.status === 201) ? 200 : res.status,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            case 'set_webhook': {
                const { webhookUrl, enabled } = payload || {}
                const res = await EvolutionService.request(`/webhook/set/${instanceName}`, {
                    method: 'POST', body: JSON.stringify({
                        url: webhookUrl,
                        enabled: enabled ?? true,
                        events: ["MESSAGES_UPSERT", "CONTACTS_UPSERT", "CONTACTS_UPDATE"],
                        webhookByEvents: true
                    })
                })
                return new Response(JSON.stringify(res.json), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            case 'ai_suggest': {
                const { messages } = payload || {}
                const suggestion = await AIService.suggestResponse((messages || []).slice(-10))
                return new Response(JSON.stringify({ suggestion }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            default:
                return new Response(JSON.stringify({ error: `Invalid action: ${action}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
        }
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }
})
