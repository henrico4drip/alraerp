import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    let log: any[] = []
    const addLog = (msg: any, data: any = null) => {
        const d = new Date()
        const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
        console.log(`[${time}] ${msg}`, data || '')
        log.push({ msg, data })
    }

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
        )

        const { data: { user } } = await supabaseClient.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const body = await req.json().catch(() => ({}))
        const { action, payload } = body
        const sessionName = `erp_${user.id.split('-')[0]}`

        let WPP_URL = Deno.env.get('WPPCONNECT_URL')?.replace(/\/$/, '')
        // Default secret for official WPPConnect Docker image is 'THISISMYSECURETOKEN'
        const WPP_SECRET = Deno.env.get('WPPCONNECT_SECRET_KEY') || 'THISISMYSECURETOKEN'

        if (!WPP_URL) {
            return new Response(JSON.stringify({ error: true, message: "WPPConnect URL missing." }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
            })
        }

        // --- AUTH & HELPERS ---
        let token = null
        const secretsToTry = [Deno.env.get('WPPCONNECT_SECRET_KEY'), 'THISISMYSECURETOKEN'].filter(Boolean)
        // sessionName is already defined above at line 34

        // GENERATE TOKEN (Needed for all actions basically, or we lazy load)
        // Optimization: For sync_history we might not need token if using APIKEY? 
        // WPPConnect usually requires Bearer token generated via secret.

        // Let's generate token first thing for simplicity, or reuse if possible.
        // We need 'safeFetch' defined.

        for (const secret of secretsToTry) {
            // Only log if not synced yet to avoid spam? No, log is fine.
            try {
                const tokenRes = await fetch(`${WPP_URL}/api/${sessionName}/${secret}/generate-token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
                const tokenData = await tokenRes.json()
                if (tokenData.token) {
                    token = tokenData.token
                    break
                }
            } catch (e) { }
        }

        // If not token, we might fail unless we don't need it.
        // But headers uses token.

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }

        const safeFetch = async (path: string, init: RequestInit = {}) => {
            const res = await fetch(`${WPP_URL}${path}`, { ...init, headers: { ...headers, ...init.headers } })
            const text = await res.text()
            let json: any
            try { json = JSON.parse(text) } catch { json = null }
            return { status: res.status, json, text }
        }
        // LOG ALL WEBHOOKS FOR DEBUGGING
        if (body.event) console.log('Webhook Event:', body.event, JSON.stringify(body))

        // --- WEBHOOK HANDLER (INBOUND MESSAGES) ---
        // Supports: WPPConnect ('onMessage') and Evolution API v2 ('messages.upsert')
        if (body.event === 'onMessage' || body.event === 'messages.upsert') {
            const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
            const adminClient = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                secret
            )

            // Normalize Session ID
            // Evolution sends 'instance', WPPConnect sends 'session'
            const sessionRaw = body.session || body.instance || ''
            const user_id = sessionRaw.startsWith('erp_') ? sessionRaw.replace('erp_', '') : null

            if (!user_id) {
                console.log('Webhook ignored: Could not extract user_id from session/instance', sessionRaw)
                return new Response(JSON.stringify({ ignored: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
            }

            // Normalize Message Data
            let msgData = null

            // Strategy A: WPPConnect / Legacy
            if (body.event === 'onMessage' && body.data && !body.data.messages) {
                msgData = body.data
            }
            // Strategy B: Evolution API v2 (messages.upsert)
            else if (body.event === 'messages.upsert' && body.data?.messages?.[0]) {
                const raw = body.data.messages[0]
                const isFromMe = raw.key?.fromMe
                // Ignore if it's my own message coming back via webhook (optional, but usually we save outbound separately)
                // if (isFromMe) ...

                const jid = raw.key?.remoteJid || ''
                const phone = jid.split('@')[0].replace(/\D/g, '')

                // Extract text content (simplistic)
                const content = raw.message?.conversation ||
                    raw.message?.extendedTextMessage?.text ||
                    raw.message?.imageMessage?.caption ||
                    (raw.message?.imageMessage ? '[Imagem]' : '[Arquivo]')

                if (!content) {
                    // Protocol message or unsupported type
                    return new Response(JSON.stringify({ ignored: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
                }

                msgData = {
                    from: jid, // WPPConnect uses 'from'
                    body: content,
                    isGroup: jid.includes('@g.us'),
                    sender: {
                        pushname: raw.pushName
                    },
                    id: raw.key?.id,
                    fromMe: isFromMe,
                    timestamp: raw.messageTimestamp
                }
            }

            if (!msgData) {
                console.log('Webhook ignored: Unknown message format')
                return new Response(JSON.stringify({ ignored: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
            }

            // Skip Groups & Status
            if (msgData.isGroup || msgData.from === 'status@broadcast') {
                return new Response(JSON.stringify({ ignored: true, reason: 'group_or_status' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
            }

            // Insert into DB
            const contactPhone = String(msgData.from).split('@')[0].replace(/\D/g, '')
            const content = msgData.body || msgData.content
            const waId = msgData.id || ''

            // Check deduplication using waId if available
            if (waId) {
                const { data: existing } = await adminClient
                    .from('whatsapp_messages')
                    .select('id')
                    .eq('wa_message_id', waId)
                    .single()
                if (existing) {
                    console.log('Duplicate message skipped:', waId)
                    return new Response(JSON.stringify({ success: true, skipped: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
                }
            }

            const { error } = await adminClient.from('whatsapp_messages').insert({
                user_id: user_id,
                contact_phone: contactPhone,
                contact_name: msgData.sender?.pushname || msgData.notifyName || contactPhone,
                content: content,
                direction: msgData.fromMe ? 'outbound' : 'inbound',
                status: msgData.fromMe ? 'sent' : 'received',
                wa_message_id: waId,
                created_at: msgData.timestamp ? new Date(Number(msgData.timestamp) * 1000).toISOString() : new Date().toISOString()
            })

            if (error) {
                console.error('Error saving inbound message:', error)
                addLog('Error saving inbound message', error)
            } else {
                addLog(`Inbound message saved for ${user_id} from ${contactPhone}`)
            }

            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }

        // --- SYNC HISTORY HANDLER ---
        if (body.action === 'sync_history') {
            try {
                // Use safeFetch which handles auth and baseUrl

                // 1. Get Chats
                // WPPConnect Server: GET /api/{session}/all-chats or POST /api/{session}/list-chats
                let chatsRes = await safeFetch(`/api/${sessionName}/all-chats`)

                // If all-chats fails or returns empty, try list-chats
                if (!chatsRes.json || (Array.isArray(chatsRes.json) && chatsRes.json.length === 0) || chatsRes.json.status === 'error') {
                    chatsRes = await safeFetch(`/api/${sessionName}/list-chats`, { method: 'GET' }) // sometimes GET, sometimes POST
                }

                const chatsData = chatsRes.json
                const chats = Array.isArray(chatsData) ? chatsData : (chatsData?.response || [])

                if (!Array.isArray(chats)) {
                    throw new Error('Failed to list chats or invalid response format')
                }

                // 2. Filter & Limit
                const recentChats = chats
                    .filter((c: any) => !c.archive && !c.isGroup) // Skip archived & groups for now
                    .slice(0, 10)

                let importedCount = 0

                // 3. Loop and fetch messages
                // 3. Loop and fetch messages
                for (const chat of recentChats) {
                    // Slight delay to avoid overwhelming the server
                    await sleep(1000)

                    const phone = (chat.id?._serialized || chat.id).replace(/\D/g, '')

                    try {
                        // Get messages for this chat
                        // Attempts to get only recent messages if possible, but WPPConnect usually returns all or paged.
                        // We use the same endpoint but catch errors now.
                        const msgsRes = await safeFetch(`/api/${sessionName}/all-messages-in-chat/${phone}?isGroup=false&includeMe=true&includeNotifications=false`)

                        if (msgsRes.status !== 200 && msgsRes.status !== 201) {
                            addLog(`Failed to fetch msgs for ${phone}: Status ${msgsRes.status}`)
                            continue
                        }

                        const msgsData = msgsRes.json
                        const messages = Array.isArray(msgsData) ? msgsData : (msgsData?.response || [])

                        if (!Array.isArray(messages)) {
                            addLog(`Invalid messages format for ${phone}`)
                            continue
                        }

                        // Limit to last 20 matching database schema
                        const recentMessages = messages.slice(-20)

                        for (const msg of recentMessages) {
                            const content = msg.content || msg.body || msg.message || ''
                            if (!content || typeof content !== 'string') continue

                            const waId = msg.id
                            const fromMe = msg.fromMe
                            const direction = fromMe ? 'outbound' : 'inbound'
                            const ts = msg.timestamp ? new Date(msg.timestamp * 1000) : new Date()

                            // Deduplicate check
                            const { data: existing } = await supabaseClient
                                .from('whatsapp_messages')
                                .select('id')
                                .eq('wa_message_id', waId)
                                .single()

                            if (!existing) {
                                const { error: insertError } = await supabaseClient.from('whatsapp_messages').insert({
                                    user_id: user.id,
                                    contact_phone: phone,
                                    contact_name: chat.name || chat.contact?.name || chat.pushname,
                                    content: content,
                                    direction: direction,
                                    status: fromMe ? 'sent' : 'received',
                                    created_at: ts.toISOString(),
                                    wa_message_id: waId
                                })

                                if (insertError) {
                                    console.error('Error inserting message:', insertError)
                                    addLog('Error inserting message', insertError)
                                } else {
                                    importedCount++
                                }
                            }
                        }
                    } catch (chatErr: any) {
                        addLog(`Error syncing chat ${phone}: ${chatErr.message}`)
                        // Continue to next chat
                    }
                }

                return new Response(JSON.stringify({ success: true, count: importedCount, log }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
                })

            } catch (e: any) {
                return new Response(JSON.stringify({ error: true, message: e.message, log }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
                })
            }
        }

        if (action === 'get_status') {
            addLog('Checking status...')
            const statusRes = await safeFetch(`/api/${sessionName}/check-connection-session`)

            // WPPConnect retorna { connected: true/false } ou similar
            const isConnected = statusRes.json?.status === true || statusRes.json?.connected === true

            if (isConnected) {
                return new Response(JSON.stringify({
                    status: 'connected',
                    connectionStatus: 'CONNECTED',
                    log
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
            }

            // Se não estiver conectado, tenta pegar o status detalhado
            const detailRes = await safeFetch(`/api/${sessionName}/status-session`)
            const status = detailRes.json?.status || 'disconnected'

            return new Response(JSON.stringify({
                status: status === 'isLogged' ? 'connected' : 'disconnected',
                connectionStatus: (status || 'DISCONNECTED').toUpperCase(),
                instance: detailRes.json,
                log
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }

        if (action === 'connect' || action === 'send_pairing_code') {
            addLog(`Starting session: ${sessionName}`)

            // Inicia sessão
            const startRes = await safeFetch(`/api/${sessionName}/start-session`, {
                method: 'POST',
                body: JSON.stringify({ waitQrCode: true })
            })

            addLog('Start response received', startRes.json)

            // Polling para QR Code se não vier de imediato
            for (let i = 0; i < 20; i++) {
                await sleep(3000)
                const check = await safeFetch(`/api/${sessionName}/status-session`)
                const currentStatus = check.json?.status
                addLog(`Attempt ${i + 1} status: ${currentStatus}`)

                if (currentStatus === 'isLogged') {
                    return new Response(JSON.stringify({ status: 'connected', log }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
                    })
                }

                if (check.json?.qrcode) {
                    addLog('QR Code found!')
                    return new Response(JSON.stringify({
                        base64: check.json.qrcode,
                        status: 'CONNECTING',
                        log
                    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
                }

                // Algumas versões retornam o QR no start-session direto
                if (startRes.json?.qrcode) {
                    return new Response(JSON.stringify({
                        base64: startRes.json.qrcode,
                        status: 'CONNECTING',
                        log
                    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
                }
            }

            return new Response(JSON.stringify({ error: true, message: "Timeout waiting for QR Code", log }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
            })
        }

        if (action === 'send_message') {
            const { phone, message } = payload || {}
            if (!phone || !message) throw new Error('Phone and message are required')

            addLog(`Sending message to ${phone}`)
            const cleanPhone = String(phone).replace(/\D/g, '')
            const recipient = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@c.us`

            const sendRes = await safeFetch(`/api/${sessionName}/send-message`, {
                method: 'POST',
                body: JSON.stringify({
                    phone: recipient,
                    message: message,
                    isGroup: false
                })
            })

            addLog('Send message response', sendRes.json)

            // Save to Database for CRM
            try {
                if (sendRes.json?.status === 'success' || sendRes.status === 200) {
                    await supabaseClient.from('whatsapp_messages').insert({
                        user_id: user.id,
                        contact_phone: cleanPhone, // Storing just digits for easier joining
                        content: message,
                        direction: 'outbound',
                        status: 'sent'
                    })
                }
            } catch (dbErr) {
                addLog('Error saving to DB', dbErr)
            }

            return new Response(JSON.stringify({ success: true, data: sendRes.json, log }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
            })
        }

        if (action === 'set_webhook') {
            const { webhookUrl, enabled } = payload || {}
            addLog(`Setting webhook to: ${webhookUrl}`)

            // Try Evolution API v2 first (since user logs show evolution-api-v2)
            // Evolution requires 'apikey' header usually
            const apiKey = Deno.env.get('WPPCONNECT_SECRET_KEY') || 'THISISMYSECURETOKEN'
            const headers = {
                'Content-Type': 'application/json',
                'apikey': apiKey
            }

            // Attempt 1: Evolution v2 /webhook/set/:instance
            let res = await fetch(`${WPP_URL}/webhook/set/${sessionName}`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    webhook: {
                        url: webhookUrl,
                        enabled: enabled !== false
                    }
                })
            })
            let json = await res.json().catch(() => null)
            addLog(`Evolution /webhook/set status: ${res.status}`, json)

            if (res.status === 404 || res.status === 405) {
                // Attempt 2: Evolution v2 /instance/update/:instance
                res = await fetch(`${WPP_URL}/instance/update/${sessionName}`, {
                    method: 'PUT', // Evolution uses PUT for update usually, can check docs
                    headers, // Authorization header is also good to have
                    body: JSON.stringify({
                        webhook: {
                            url: webhookUrl,
                            enabled: enabled !== false,
                        }
                    })
                })
                json = await res.json().catch(() => null)
                addLog(`Evolution /instance/update status: ${res.status}`, json)
            }

            // Attempt 3: WPPConnect Standard - using start-session to update config
            if (res.status === 404) {
                addLog('Trying WPPConnect start-session with webhook...')
                res = await safeFetch(`/api/${sessionName}/start-session`, {
                    method: 'POST',
                    body: JSON.stringify({
                        webhook: webhookUrl,
                        waitQrCode: true
                    })
                })
                json = res.json
                addLog(`WPPConnect start-session status: ${res.status}`, json)

                // Attempt 4: Explicit /set-webhook (Standard for WPPConnect Server 2.x)
                if (res.status !== 200 && res.status !== 201) {
                    res = await safeFetch(`/api/${sessionName}/set-webhook`, {
                        method: 'POST',
                        body: JSON.stringify({
                            url: webhookUrl,
                            enabled: enabled !== false
                        })
                    })
                    addLog(`WPPConnect /set-webhook status: ${res.status}`, res.json)
                }

                // Attempt 5: Explicit /webhook (Fallback)
                if (res.status !== 200 && res.status !== 201) {
                    res = await safeFetch(`/api/${sessionName}/webhook`, {
                        method: 'POST',
                        body: JSON.stringify({
                            url: webhookUrl,
                            enabled: enabled !== false
                        })
                    })
                    addLog(`WPPConnect /webhook status: ${res.status}`, res.json)
                }
            }

            return new Response(JSON.stringify({ success: res.status === 200 || res.status === 201, response: json, log }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
            })
        }

        return new Response(JSON.stringify({ error: true, message: "Invalid action", log }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
        })

    } catch (error) {
        console.error('Proxy error:', error)
        return new Response(JSON.stringify({
            error: true,
            message: error instanceof Error ? error.message : 'Unknown error',
            log: [{ msg: 'Critical Error', data: error }]
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }
})
