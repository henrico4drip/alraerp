import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Version: 2.0.1 - Fixed sync_recent parsing
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

        // Content Extraction (v2 robust)
        const m = msg.message || {}
        const content = m.conversation ||
            m.extendedTextMessage?.text ||
            m.imageMessage?.caption ||
            m.videoMessage?.caption ||
            (m.audioMessage ? '🎵 Áudio' : '') ||
            (m.documentMessage ? '📄 Documento' : '') ||
            (m.stickerMessage ? '🎨 Sticker' : '') ||
            (m.imageMessage ? '📷 Foto' : '') ||
            (m.videoMessage ? '🎥 Vídeo' : '') ||
            '[Mensagem]'

        const waId = msg.key?.id

        // CRITICAL: Skip messages without valid ID to prevent duplicates
        if (!waId || waId === 'null' || waId === '' || waId === null) {
            console.log(`[PROXY] Skipping message without valid wa_message_id`)
            continue
        }

        const ts = msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000) : new Date()

        // UPSERT strategy: check if exists, if not insert. 
        // This ensures we don't duplicate but also don't miss status updates.
        const { data: existing } = await adminClient.from('whatsapp_messages').select('id, is_read').eq('wa_message_id', waId).maybeSingle()

        if (!existing) {
            // New message - insert it
            const isReadValue = isFromMe ? true : false
            console.log(`[PROXY] Inserting new message: ${waId.substring(0, 20)}... | direction: ${isFromMe ? 'outbound' : 'inbound'} | is_read: ${isReadValue}`)

            const { error: insertError } = await adminClient.from('whatsapp_messages').insert({
                user_id: activeUserId,
                contact_phone: phone,
                contact_name: msg.pushName || phone,
                content: content,
                direction: isFromMe ? 'outbound' : 'inbound',
                status: isFromMe ? 'sent' : 'received',
                wa_message_id: waId,
                is_read: isReadValue,
                created_at: ts.toISOString()
            })
            if (!insertError) {
                count++
            } else {
                console.error(`[PROXY] Insert error for ${waId}:`, insertError)
            }
        } else if (existing.is_read === null || existing.is_read === undefined) {
            // Existing message without is_read status - update it
            const shouldBeRead = isFromMe ? true : false
            console.log(`[PROXY] Updating existing message ${waId.substring(0, 20)}... | direction: ${isFromMe ? 'outbound' : 'inbound'} | setting is_read: ${shouldBeRead}`)

            await adminClient.from('whatsapp_messages')
                .update({ is_read: shouldBeRead })
                .eq('id', existing.id)
            if (!isFromMe) count++ // Count as "new" unread if it's inbound
        } else {
            // Message already exists with is_read set - skip
            // console.log(`[PROXY] Skipping ${waId.substring(0, 20)}... (already processed, is_read: ${existing.is_read})`)
        }
    }

    if (count > 0) console.log(`[PROXY] Done. Integrated ${count} new messages.`);
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
                // Heuristic: erp_PREFIX -> fetch user by matching user_id prefix
                // For this ERP, the instance name "erp_PREFIX" contains the start of the user_id
                const prefix = instance.replace('erp_', '')

                // Search for user with this ID prefix in settings
                const { data: foundSettings } = await adminClient.from('settings')
                    .select('user_id')
                    .ilike('user_id', `${prefix}%`)
                    .maybeSingle()

                let userId = foundSettings?.user_id

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
                    body: JSON.stringify(payload || { where: {}, limit: 50 })
                })
                const chatsWrapper = res.json || []
                const chats = Array.isArray(chatsWrapper) ? chatsWrapper : (chatsWrapper.records || chatsWrapper.data || [])
                responseData = chats

                // Lazy Sync: Process messages for the first 5 chats immediately
                if (chats.length > 0) {
                    (async () => {
                        for (const chat of chats.slice(0, 5)) {
                            const jid = chat.id || chat.remoteJid
                            if (!jid) continue;
                            const msgsRes = await EvolutionService.request(`/chat/findMessages/${instanceName}`, {
                                method: 'POST',
                                body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit: 10 })
                            })
                            const mData = msgsRes.json
                            const msgs = Array.isArray(mData) ? mData : (mData?.messages?.records || mData?.records || mData?.data || [])
                            await processMessages(adminClient, msgs, user.id)
                        }
                    })().catch(e => console.error('[LAZY-SYNC] Error:', e));
                }
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
                const limit = payload?.limit || 50  // Increased from 10 to 50 conversations
                console.log(`[SYNC-RECENT] Starting sync for up to ${limit} conversations...`)

                const chatsRes = await EvolutionService.request(`/chat/findChats/${instanceName}`, {
                    method: 'POST',
                    body: JSON.stringify({ where: {}, limit })
                })
                const cData = chatsRes.json
                console.log(`[SYNC-RECENT] Raw API response type:`, typeof cData, '| isArray:', Array.isArray(cData), '| has records:', !!cData?.records, '| has data:', !!cData?.data)

                const recentChats = Array.isArray(cData) ? cData.slice(0, limit) : (cData?.records?.slice(0, limit) || cData?.data?.slice(0, limit) || [])
                console.log(`[SYNC-RECENT] Found ${recentChats.length} conversations to check`)

                let totalAdded = 0
                let processedChats = 0

                // Debug: Log first chat structure
                if (recentChats.length > 0) {
                    console.log(`[SYNC-RECENT] First chat sample:`, JSON.stringify(recentChats[0]).substring(0, 300))
                }

                for (const chat of recentChats) {
                    // Evolution API v2 returns id=null, but JID is in lastMessage.key.remoteJid
                    const jid = chat.id || chat.remoteJid || chat.jid || chat.lastMessage?.key?.remoteJid
                    if (!jid) {
                        console.log(`[SYNC-RECENT] Skipping chat - no JID found. Keys:`, Object.keys(chat || {}).slice(0, 10).join(', '))
                        continue
                    }

                    console.log(`[SYNC-RECENT] Processing chat: ${jid.split('@')[0]}`)

                    // Fetch last 50 messages (increased from 15) to catch recent activity
                    const msgsRes = await EvolutionService.request(`/chat/findMessages/${instanceName}`, {
                        method: 'POST',
                        body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit: 50 })
                    })
                    const mData = msgsRes.json
                    const msgs = Array.isArray(mData) ? mData : (mData?.messages?.records || mData?.records || mData?.data || [])

                    const { count } = await processMessages(adminClient, msgs, user.id)
                    if (count > 0) {
                        console.log(`[SYNC-RECENT] Chat ${jid.split('@')[0]}: Added ${count} new messages`)
                    }
                    totalAdded += count
                    processedChats++
                }

                responseData = { success: true, count: totalAdded, chatsProcessed: processedChats }
                console.log(`[SYNC-RECENT] ✅ Finished. Processed ${processedChats} chats, integrated ${totalAdded} new messages.`)
                break
            }

            case 'set_webhook': {
                const { webhookUrl } = payload || {}
                // Evolution v2 usage: POST /webhook/instance/{instanceName}
                // We'll try both to be safe
                const webhookPayload = {
                    url: webhookUrl,
                    enabled: true,
                    events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CHATS_UPDATE']
                }

                let res = await EvolutionService.request(`/webhook/instance/${instanceName}`, {
                    method: 'POST',
                    body: JSON.stringify(webhookPayload)
                })

                if (res.status === 404) {
                    res = await EvolutionService.request(`/webhook/set/${instanceName}`, {
                        method: 'POST',
                        body: JSON.stringify({ webhook: { ...webhookPayload, webhookByEvents: false } })
                    })
                }

                responseData = res.json
                await adminClient.from('settings').update({ whatsapp_instance_name: instanceName }).eq('user_id', user.id)
                console.log(`[WEBHOOK] Setup attempted for ${instanceName}. Status: ${res.status}`);
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
