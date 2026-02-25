import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// -- UTILS --
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EVO_CONFIG = {
    url: Deno.env.get('WPP_URL')?.replace(/\/$/, '') || 'http://84.247.143.180:8080',
    apiKey: Deno.env.get('WPPCONNECT_SECRET_KEY') || 'mypassy',
    instanceName: Deno.env.get('EVOLUTION_INSTANCE') || 'alraerp',
}

const CHATWOOT_CONFIG = {
    enabled: true,
    accountId: Deno.env.get('CHATWOOT_ACCOUNT_ID') || '1',
    token: Deno.env.get('CHATWOOT_TOKEN') || 'pgh3rRR6ZLirSnzdnuQZbhNV',
    url: Deno.env.get('CHATWOOT_URL') || 'http://84.247.143.180', // External for ERP proxy
    internalUrl: Deno.env.get('CHATWOOT_INTERNAL_URL') || 'http://rails:3000', // Internal for Evolution
    importContacts: true,
    importMessages: true,
    daysLimitImportMessages: 365,
    reopenConversation: true,
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
            const requestId = Math.random().toString(36).substring(7)
            console.log(`[EVO] [${requestId}] ${init.method || 'GET'} ${url}`)

            // Set a timeout to prevent Edge Function 504 Gateway Timeout (60s limit)
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 20000) // 20s timeout per call

            try {
                const res = await fetch(url, { ...init, headers, signal: controller.signal })
                const text = await res.text()
                let json = null
                try { json = JSON.parse(text) } catch { }

                console.log(`[EVO] [${requestId}] Response: ${res.status}`)
                return { status: res.status, json, text }
            } finally {
                clearTimeout(timeoutId)
            }
        } catch (e: any) {
            console.error(`[EVO] Fatal Error: ${e.message}`)
            return { status: 504, json: null, text: e.message }
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

// Webhook secret for bypassing auth (configured in Evolution API webhook headers)
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') || 'alraerp-webhook-secret-2026'

serve(async (req) => {
    // 1. Handle CORS Preflight
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const bodyText = await req.text()
        let body: any = {}
        try { body = JSON.parse(bodyText) } catch { }

        const { action, payload } = body
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

        // Log para debug
        console.log(`[DEBUG] SUPABASE_URL: ${supabaseUrl ? 'definido' : 'nao definido'}`)
        console.log(`[DEBUG] SERVICE_ROLE_KEY: ${supabaseServiceKey ? 'definido (length: ' + supabaseServiceKey.length + ')' : 'nao definido'}`)

        // Admin client with service role key (bypasses RLS)
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            },
            global: {
                headers: {
                    'Authorization': `Bearer ${supabaseServiceKey}`
                }
            }
        })

        // =========================================================================================
        // WEBHOOK HANDLER (No Authentication Required for Speed/Callback)
        // =========================================================================================
        // We check 'event' property to identify webhook calls vs internal actions
        // Supported Events: "messages.upsert", "contacts.upsert", "contacts.update"
        // NOTE: This MUST be checked BEFORE any auth logic to allow unauthenticated webhook calls

        // Support both Evolution API v1 (lowercase) and v2 (uppercase) event formats
        const eventName = (body.event || '').toLowerCase()
        if (eventName === 'messages.upsert' || eventName === 'messages.update' || eventName === 'messages.set' || eventName === 'contacts.upsert' || eventName === 'contacts.update' || eventName === 'connection.update' || eventName === 'send.message' || eventName === 'messages_upsert' || eventName === 'messages_update' || eventName === 'messages_set' || eventName === 'contacts_upsert' || eventName === 'contacts_update' || eventName === 'connection_update' || eventName === 'send_message') {
            console.log(`[WEBHOOK] Received ${body.event} for instance ${body.instance}`)

            const data = body.data || body.data?.data || {}
            // Evolution API structure varies: sometimes body.data is the payload, sometimes body.data.data

            const instanceName = body.instance || 'alraerp'

            // For alraerp instance, use a fixed user ID or look up by instance name
            let userId = null

            if (instanceName === 'alraerp') {
                // Find the admin user or first user
                const { data: adminUsers } = await supabaseAdmin.from('profiles')
                    .select('id')
                    .order('created_at', { ascending: true })
                    .limit(1)
                userId = adminUsers?.[0]?.id

                // Fallback: try 'users' table if profiles is empty
                if (!userId) {
                    const { data: usersData } = await supabaseAdmin.from('users')
                        .select('id')
                        .order('created_date', { ascending: true })
                        .limit(1)
                    userId = usersData?.[0]?.id
                }

                // Final fallback: create/use a default system user ID
                if (!userId) {
                    console.log('[WEBHOOK] No user found, creating system user...')
                    const systemId = '00000000-0000-0000-0000-000000000000'

                    // Try to create the system user in users table (minimal - just id)
                    const { error: createUserError } = await supabaseAdmin.from('users').upsert({
                        id: systemId
                    }, { onConflict: 'id' })

                    console.log('[WEBHOOK] Create user result:', createUserError ? `Error: ${createUserError.message}` : 'Success')

                    userId = systemId
                    console.log('[WEBHOOK] Using system user ID:', userId)
                }
            } else {
                // Instance convention: "erp_USERID" -> extract header id
                const prefix = instanceName.replace('erp_', '')
                const { data: users } = await supabaseAdmin.from('profiles').select('id').ilike('id', `${prefix}%`)
                userId = users?.[0]?.id
            }

            if (!userId) {
                console.warn(`[WEBHOOK] User not found for instance ${instanceName}`)
                return new Response('ok', { headers: corsHeaders })
            }

            // --- CONTACTS HANDLING ---
            if (eventName === 'contacts.upsert' || eventName === 'contacts.update' || eventName === 'contacts_upsert' || eventName === 'contacts_update') {
                const contacts = Array.isArray(data) ? data : [data]
                for (const c of contacts) {
                    if (!c.id) continue
                    let phone = c.id.split('@')[0]
                    const newName = c.pushName || c.name || c.verifiedName || phone
                    const isNewNameGeneric = !newName || newName === phone || /^\d+$/.test(newName) || newName === 'Você' || newName === 'You'

                    // Normalização para busca de duplicados
                    const variants = [phone]
                    if (phone.startsWith('55') && phone.length === 13 && phone[4] === '9') {
                        variants.push(phone.substring(0, 4) + phone.substring(5))
                    } else if (phone.startsWith('55') && phone.length === 12) {
                        variants.push(phone.substring(0, 4) + '9' + phone.substring(4))
                    }

                    const { data: existing } = await supabaseAdmin.from('customers')
                        .select('id, name')
                        .in('phone', variants)
                        .maybeSingle()

                    if (!existing) {
                        await supabaseAdmin.from('customers').insert({
                            user_id: userId,
                            phone: phone,
                            name: newName,
                            notes: 'Criado via Webhook',
                            created_date: new Date().toISOString()
                        })
                    } else if (!isNewNameGeneric) {
                        const isCurrentNameGeneric = !existing.name || existing.name === phone || /^\d+$/.test(existing.name)
                        if (isCurrentNameGeneric) {
                            await supabaseAdmin.from('customers').update({ name: newName }).eq('id', existing.id)
                        }
                    }
                }
                return new Response('ok', { headers: corsHeaders })
            }

            // --- MESSAGES HANDLING ---
            // Save BOTH inbound and outbound messages for full history
            console.log(`[WEBHOOK] Messages handler - data entries: ${Array.isArray(data) ? data.length : (data.messages ? 'object with messages' : 'single message')}`)

            // Support messages.set (array of messages in data.messages) or direct array
            const entries = Array.isArray(data) ? data : (data.messages && Array.isArray(data.messages) ? data.messages : [data])

            let processedCount = 0
            let savedCount = 0

            for (const entry of entries) {
                if (!entry || !entry.key) continue
                processedCount++

                const jid = entry.key.remoteJid

                // Ignore status updates (@status.broadcast) and groups (@g.us)
                if (!jid || jid === 'status@broadcast' || jid.includes('@g.us')) {
                    continue
                }

                let phone = jid.split('@')[0]
                const type = entry.messageType || (entry.message ? Object.keys(entry.message)[0] : '')
                let content = ''

                // Resolve LID to real phone if possible
                let resolvedPhone = phone
                const isDisguisedLID = phone.startsWith('2406') || phone.length >= 14 || jid.includes('@lid')

                if (isDisguisedLID && !entry.key.fromMe) {
                    const deepJid = entry.message?.senderPn || entry.senderPn || entry.message?.participant || entry.participant || entry.key?.participant || entry.message?.user || entry.user
                    if (deepJid && typeof deepJid === 'string' && deepJid.includes('@s.whatsapp.net')) {
                        const cleanDeep = deepJid.split('@')[0].replace(/\D/g, '')
                        if (cleanDeep && cleanDeep !== phone) {
                            resolvedPhone = cleanDeep
                            console.log(`[WEBHOOK] Resolved masked LID ${phone} to real phone ${resolvedPhone}`)

                            // SAVE LAPPING PERMANENTLY
                            try {
                                await supabaseAdmin.from('wa_lid_mappings').upsert({
                                    lid: phone, // often the LID is passed as 'phone' in our logic
                                    phone: resolvedPhone,
                                    user_id: userId
                                }, { onConflict: 'lid' })
                            } catch (e) {
                                console.error(`[WEBHOOK] Error saving LID mapping:`, e.message)
                            }
                        }
                    }
                }
                phone = resolvedPhone

                // Basic extraction based on type
                if (entry.message?.conversation) content = entry.message.conversation
                else if (entry.message?.extendedTextMessage?.text) content = entry.message.extendedTextMessage.text
                else if (entry.message?.audioMessage) content = await AIService.transcribeAudio(entry.message.audioMessage.base64 || '')
                else if (entry.message?.imageMessage) content = await AIService.analyzeImage(entry.message.imageMessage.base64 || '')
                else if (entry.message?.viewOnceMessageV2?.message?.imageMessage) {
                    content = await AIService.analyzeImage(entry.message.viewOnceMessageV2.message.imageMessage.base64 || '')
                } else if (entry.message?.videoMessage) {
                    content = entry.message.videoMessage.caption || '[Vídeo]'
                } else if (entry.message?.documentMessage) {
                    content = entry.message.documentMessage.fileName || '[Documento]'
                } else if (entry.message?.stickerMessage) {
                    content = '[Sticker]'
                }

                if (content) {
                    const waId = entry.key.id

                    // ✅ TRAVA ANTI-DUPLICIDADE
                    const { data: existing } = await supabaseAdmin.from('whatsapp_messages')
                        .select('id, user_id, contact_phone')
                        .eq('wa_message_id', waId)
                        .maybeSingle()

                    if (existing) {
                        console.log(`[WEBHOOK] Mensagem duplicada ignorada: ${waId}`)
                        if (!existing.user_id && userId) {
                            await supabaseAdmin.from('whatsapp_messages').update({ user_id: userId }).eq('id', existing.id)
                        }
                        continue
                    }

                    const isFromMe = entry.key.fromMe || false
                    let contactName = entry.pushName || entry.verifiedName || phone
                    const isNewNameGeneric = !contactName || contactName === phone || /^\d+$/.test(contactName) || contactName === 'Você' || contactName === 'You'

                    // RESOLUÇÃO DE NOME E ATUALIZAÇÃO DO CLIENTE (Banco de Dados)
                    const variants = [phone]
                    if (phone.startsWith('55') && phone.length === 13 && phone[4] === '9') {
                        variants.push(phone.substring(0, 4) + phone.substring(5))
                    } else if (phone.startsWith('55') && phone.length === 12) {
                        variants.push(phone.substring(0, 4) + '9' + phone.substring(4))
                    }

                    const { data: customer } = await supabaseAdmin.from('customers')
                        .select('id, name')
                        .in('phone', variants)
                        .maybeSingle()

                    if (!customer && !isFromMe) {
                        // Criar cliente se não existir (apenas se for inbound)
                        await supabaseAdmin.from('customers').insert({
                            user_id: userId,
                            phone: phone,
                            name: contactName,
                            notes: 'Criado via Webhook (Mensagem)',
                            created_date: new Date().toISOString()
                        })
                    } else if (customer) {
                        // Se cliente já existe, verificar se o nome atual é genérico
                        const isCurrentNameGeneric = !customer.name || customer.name === phone || /^\d+$/.test(customer.name)

                        // Atualizar nome no banco se o novo nome for melhor
                        if (isCurrentNameGeneric && !isNewNameGeneric) {
                            await supabaseAdmin.from('customers').update({ name: contactName }).eq('id', customer.id)
                        } else if (!isCurrentNameGeneric) {
                            // Se o nome no banco é melhor (já editado), usamos ele na mensagem
                            contactName = customer.name
                        }
                    } else if (isFromMe && !customer) {
                        // Se for outbound e não temos o cliente, tentamos pelo menos não salvar 'Você'
                        contactName = phone
                    }

                    const insertPayload = {
                        user_id: userId,
                        contact_phone: phone,
                        contact_name: contactName,
                        content,
                        direction: isFromMe ? 'outbound' : 'inbound',
                        wa_message_id: waId,
                        status: isFromMe ? 'sent' : 'received',
                        created_at: entry.messageTimestamp ? new Date(Number(entry.messageTimestamp) * 1000).toISOString() : new Date().toISOString()
                    }

                    const { error: insertError } = await supabaseAdmin.from('whatsapp_messages').insert(insertPayload)
                    if (!insertError) {
                        savedCount++
                        console.log(`[WEBHOOK] Mensagem salva: ${waId} (Contato: ${contactName})`)
                    }

                    // --- PERFECT CHATWOOT SYNC ---
                    try {
                        /*
                        // 1. Force Contact Name Update in Chatwoot
                        const fetchOpts = { headers: { 'api_access_token': CHATWOOT_CONFIG.token, 'Content-Type': 'application/json' } }
                        const cwSearchUrl = `${CHATWOOT_CONFIG.url}/api/v1/accounts/${CHATWOOT_CONFIG.accountId}/contacts/search?q=${phone}`
                        const searchRes = await fetch(cwSearchUrl, fetchOpts)
                        const searchData = await searchRes.json()
                        const cwContact = searchData?.payload?.[0]

                        // Default to Inbox 2 (WhatsApp API usually auto-generates 2 for instances)
                        // If you have multiple inboxes, they can be searched, but typically Native Evo is Inbox 2 or 1.
                        let chatwootConvId = null;

                        if (cwContact) {
                            // Only update name if we have a better one
                            const isGenericChatwootName = !cwContact.name || cwContact.name.includes(phone) || /^\d+$/.test(cwContact.name)
                            if (cwContact.name !== contactName && (!customer || customer.name === contactName || isGenericChatwootName)) {
                                await fetch(`${CHATWOOT_CONFIG.url}/api/v1/accounts/${CHATWOOT_CONFIG.accountId}/contacts/${cwContact.id}`, {
                                    method: 'PUT',
                                    headers: fetchOpts.headers,
                                    body: JSON.stringify({ name: contactName })
                                })
                                console.log(`[CHATWOOT] Atualizou nome para: ${contactName}`)
                            }
                        */

                        // 2. Outbound Injection: DISABLED to prevent duplicates.
                        // Evolution API v2 has stable native Chatwoot sync for both inbound and outbound.
                        /*
                        if (isFromMe && content) {
                            const convoRes = await fetch(`${CHATWOOT_CONFIG.url}/api/v1/accounts/${CHATWOOT_CONFIG.accountId}/contacts/${cwContact.id}/conversations`, fetchOpts)
                            const convoData = await convoRes.json()
                            const activeConvo = convoData?.payload?.find((c: any) => c.status === 'open') || convoData?.payload?.[0]

                            if (activeConvo) {
                                chatwootConvId = activeConvo.id
                                // Verify message dup (wait, we can't easily, but we can try to assume it's missing)
                                // Inject Message
                                await fetch(`${CHATWOOT_CONFIG.url}/api/v1/accounts/${CHATWOOT_CONFIG.accountId}/conversations/${chatwootConvId}/messages`, {
                                    method: 'POST',
                                    headers: fetchOpts.headers,
                                    body: JSON.stringify({
                                        content: content,
                                        message_type: 1, // Outgoing
                                        private: false
                                    })
                                })
                                console.log(`[CHATWOOT] Outbound message injected forcibly for ${phone}`)
                            }
                        }
                        */
                    } catch (cwErr: any) {
                        console.error(`[CHATWOOT] Sync Error:`, cwErr.message)
                    }
                    // --- END PERFECT CHATWOOT SYNC ---

                }
            }

            console.log(`[WEBHOOK] Finished processing. Entries: ${entries.length}, Processed: ${processedCount}, Saved: ${savedCount}`)
            return new Response('ok', { headers: corsHeaders })
        }


        // =========================================================================================
        // INTERNAL ACTIONS (Authenticated via Supabase Auth OR Webhook Secret)
        // =========================================================================================

        // =========================================================================================
        // AUTHENTICATION
        // =========================================================================================
        // For webhooks: check URL search param ?secret=xxx
        // For internal actions: use Authorization header

        const url = new URL(req.url)
        const urlSecret = url.searchParams.get('secret') ?? ''
        const authHeader = req.headers.get('Authorization') ?? ''
        const webhookSecretHeader = req.headers.get('x-webhook-secret') ?? ''

        let user = null

        // Check webhook secret (URL param, Authorization header, or x-webhook-secret header from Evolution API)
        const isValidWebhookSecret = urlSecret === WEBHOOK_SECRET || webhookSecretHeader === WEBHOOK_SECRET

        if (isValidWebhookSecret) {
            console.log('[AUTH] Authenticated via webhook secret')
            // For webhook secret auth, use the admin/first user
            const { data: adminUsers } = await supabaseAdmin.from('profiles')
                .select('id, email')
                .order('created_at', { ascending: true })
                .limit(1)
            user = adminUsers?.[0] || { id: 'webhook-user', email: 'webhook@system.local' }
        } else if (authHeader) {
            // Try Supabase Auth
            const supabaseUser = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_ANON_KEY') ?? '',
                { global: { headers: { Authorization: authHeader } } }
            )
            const { data: { user: authUser } } = await supabaseUser.auth.getUser()
            user = authUser
        }

        if (!user) {
            console.log('[AUTH] Failed - no valid authentication')
            return new Response(JSON.stringify({ error: 'Unauthorized', hint: 'Use ?secret=xxx for webhooks or Authorization header for API calls' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const instanceName = EVO_CONFIG.instanceName

        switch (action) {

            // --- DATABASE ACTIONS ---
            case 'get_messages': {
                const { data: messages, error } = await supabaseAdmin.from('whatsapp_messages')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(20)

                if (error) {
                    return new Response(JSON.stringify({ error }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
                }

                return new Response(JSON.stringify({ messages }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            case 'get_mappings': {
                const { data: mappings, error } = await supabaseAdmin.from('wa_lid_mappings')
                    .select('lid, phone')

                if (error) {
                    return new Response(JSON.stringify({ error }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
                }

                return new Response(JSON.stringify({ mappings }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            case 'fix_fk': {
                // Remove foreign key constraint from whatsapp_messages
                const { error: fkError } = await supabaseAdmin.rpc('exec_sql', {
                    sql: 'ALTER TABLE whatsapp_messages DROP CONSTRAINT IF EXISTS whatsapp_messages_user_id_fkey;'
                })

                if (fkError) {
                    // Try direct SQL via REST
                    return new Response(JSON.stringify({
                        error: fkError,
                        hint: 'Execute this SQL manually: ALTER TABLE whatsapp_messages DROP CONSTRAINT IF EXISTS whatsapp_messages_user_id_fkey;'
                    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
                }

                return new Response(JSON.stringify({ success: true, message: 'FK removed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            case 'setup_lid_table': {
                const sql = `
                    CREATE TABLE IF NOT EXISTS wa_lid_mappings (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        lid TEXT UNIQUE NOT NULL,
                        phone TEXT NOT NULL,
                        user_id UUID,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS idx_wa_lid_mappings_lid ON wa_lid_mappings(lid);
                    CREATE INDEX IF NOT EXISTS idx_wa_lid_mappings_phone ON wa_lid_mappings(phone);
                `;
                const { error } = await supabaseAdmin.rpc('exec_sql', { sql });
                if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            // --- SYSTEM SETUP ---
            case 'init_system': {
                // Create system user with upsert (create or ignore)
                const systemId = '00000000-0000-0000-0000-000000000000'

                // First, check what columns exist in users table
                const { data: sampleUser, error: sampleError } = await supabaseAdmin.from('users').select('*').limit(1)
                console.log('[INIT_SYSTEM] Sample user check:', { sampleUser, sampleError })

                // Try to create system user with upsert
                const { data: newUser, error: createError } = await supabaseAdmin.from('users').upsert({
                    id: systemId,
                    name: 'Sistema WhatsApp',
                    email: 'sistema@alraerp.local',
                    created_date: new Date().toISOString()
                }, { onConflict: 'id', ignoreDuplicates: true }).select()

                if (createError) {
                    // Return detailed error
                    return new Response(JSON.stringify({
                        error: createError,
                        sampleUser,
                        sampleError,
                        message: 'Failed to create system user'
                    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
                }

                // Verify it was created
                const { data: verify } = await supabaseAdmin.from('users').select('*').eq('id', systemId)

                return new Response(JSON.stringify({
                    success: true,
                    user: newUser,
                    verify,
                    message: 'System user created/updated'
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

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
                console.log(`[ACTION] Connect called for instance: ${instanceName}`)

                // 1. Try to create or ensure it exists
                const createRes = await EvolutionService.request('/instance/create', {
                    method: 'POST',
                    body: JSON.stringify({ instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS" })
                })

                // 2. CONFIGURE SETTINGS (Force Sync Full History)
                console.log(`[ACTION] Configuring Instance Settings...`)
                await EvolutionService.request(`/settings/set/${instanceName}`, {
                    method: 'POST',
                    body: JSON.stringify({
                        rejectCall: false,
                        groupsIgnore: true,
                        alwaysOnline: false,
                        readMessages: false,
                        readStatus: false,
                        syncFullHistory: true // CRITICAL for user request
                    })
                })

                // 3. CONFIGURE CHATWOOT
                console.log(`[ACTION] Configuring Chatwoot Integration...`)
                await EvolutionService.request(`/chatwoot/set/${instanceName}`, {
                    method: 'POST',
                    body: JSON.stringify({
                        enabled: true,
                        accountId: CHATWOOT_CONFIG.accountId,
                        token: CHATWOOT_CONFIG.token,
                        url: CHATWOOT_CONFIG.internalUrl, // Use internal URL for Evolution->Chatwoot communication
                        nameInbox: "WhatsApp",
                        importContacts: true,
                        importMessages: true,
                        daysLimitImportMessages: 365, // Full year as requested
                        reopenConversation: true,
                        mergeBrazilContacts: true,
                        autoCreate: true,
                        signMsg: false,
                        conversationPending: false
                    })
                })

                // 4. CONFIGURE WEBHOOK
                console.log(`[ACTION] Configuring Webhook for ${instanceName}...`)
                const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-proxy?secret=${WEBHOOK_SECRET}`
                await EvolutionService.request(`/webhook/set/${instanceName}`, {
                    method: 'POST',
                    body: JSON.stringify({
                        url: webhookUrl,
                        enabled: true,
                        events: [
                            "MESSAGES_UPSERT",
                            "MESSAGES_UPDATE",
                            "MESSAGES_SET", // For history sync
                            "SEND_MESSAGE", // For outbound messages
                            "CONTACTS_UPSERT",
                            "CONTACTS_UPDATE",
                            "CONNECTION_UPDATE"
                        ],
                        webhookByEvents: false
                    })
                })

                // 5. Get QR Code or Connection State
                const connectRes = await EvolutionService.request(`/instance/connect/${instanceName}`)
                return new Response(JSON.stringify(connectRes.json), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
                console.log(`[ACTION] fetch_contacts called for ${instanceName}`)

                // Use the same robust strategy as the frontend: POST /chat/findContacts
                const res = await EvolutionService.request(`/chat/findContacts/${instanceName}`, {
                    method: 'POST',
                    body: JSON.stringify({ where: {}, limit: 2000 })
                })

                let contacts = []
                const rawData = res.json
                if (Array.isArray(rawData)) contacts = rawData
                else if (rawData?.records && Array.isArray(rawData.records)) contacts = rawData.records
                else if (rawData?.data && Array.isArray(rawData.data)) contacts = rawData.data
                else if (rawData && typeof rawData === 'object') contacts = Object.values(rawData)

                console.log(`[CONTACTS] Fetched ${contacts.length} items from Evo`)

                let savedCount = 0
                let updatedCount = 0

                for (const c of contacts) {
                    const jid = c.id || c.remoteJid || c.jid || ''
                    if (!jid) continue

                    const phone = jid.split('@')[0]
                    const newName = c.pushName || c.name || c.verifiedName || phone
                    const isNewNameGeneric = !newName || newName === phone || /^\d+$/.test(newName)

                    // Upsert Logic
                    const { data: existing } = await supabaseAdmin.from('customers')
                        .select('id, name')
                        .eq('phone', phone)
                        .maybeSingle()

                    if (!existing) {
                        const { error } = await supabaseAdmin.from('customers').insert({
                            user_id: user.id,
                            phone: phone,
                            name: newName,
                            notes: 'Importado via Sync',
                            created_date: new Date().toISOString()
                        })
                        if (!error) savedCount++
                    } else if (!isNewNameGeneric) {
                        const isCurrentNameGeneric = !existing.name || existing.name === phone || /^\d+$/.test(existing.name)
                        if (isCurrentNameGeneric) {
                            const { error } = await supabaseAdmin.from('customers').update({ name: newName }).eq('id', existing.id)
                            if (!error) updatedCount++
                        }
                    }
                }
                return new Response(JSON.stringify({ success: true, count: contacts.length, saved: savedCount, updated: updatedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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

                console.log(`[SYNC] Syncing messages for ${jid} (phone: ${cleanPhone})`)

                // Normalização: variantes com/sem 9o dígito
                const phoneVariants = [cleanPhone]
                if (cleanPhone.startsWith('55') && cleanPhone.length === 13 && cleanPhone[4] === '9') {
                    phoneVariants.push(cleanPhone.substring(0, 4) + cleanPhone.substring(5))
                } else if (cleanPhone.startsWith('55') && cleanPhone.length === 12) {
                    phoneVariants.push(cleanPhone.substring(0, 4) + '9' + cleanPhone.substring(4))
                }

                // Try multiple endpoints to find messages
                let msgs: any[] = []

                // Attempt 1: findMessages with Prisma-style payload (Evolution v2.3+)
                let res = await EvolutionService.request(`/chat/findMessages/${instanceName}`, {
                    method: 'POST', body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit: 200, offset: 0 })
                })
                let rawData = res.json
                if (Array.isArray(rawData)) msgs = rawData
                else if (rawData?.messages?.records) msgs = rawData.messages.records
                else if (rawData?.messages && Array.isArray(rawData.messages)) msgs = rawData.messages
                else if (rawData?.data && Array.isArray(rawData.data)) msgs = rawData.data

                // Attempt 2: fetchMessages endpoint (older versions)
                if (msgs.length === 0) {
                    console.log('[SYNC] findMessages returned 0, trying fetchMessages...')
                    res = await EvolutionService.request(`/chat/fetchMessages/${instanceName}`, {
                        method: 'POST', body: JSON.stringify({ remoteJid: jid, limit: 200 })
                    })
                    rawData = res.json
                    msgs = Array.isArray(rawData) ? rawData : (rawData?.messages || rawData?.data || [])
                }

                // Attempt 3: Also try with phone variants
                if (msgs.length === 0 && phoneVariants.length > 1) {
                    for (const variant of phoneVariants) {
                        const altJid = `${variant}@s.whatsapp.net`
                        if (altJid === jid) continue
                        console.log(`[SYNC] Trying variant JID: ${altJid}`)
                        res = await EvolutionService.request(`/chat/findMessages/${instanceName}`, {
                            method: 'POST', body: JSON.stringify({ where: { key: { remoteJid: altJid } }, limit: 200, offset: 0 })
                        })
                        rawData = res.json
                        if (Array.isArray(rawData)) msgs = rawData
                        else if (rawData?.messages?.records) msgs = rawData.messages.records
                        else if (rawData?.messages && Array.isArray(rawData.messages)) msgs = rawData.messages
                        else if (rawData?.data && Array.isArray(rawData.data)) msgs = rawData.data
                        if (msgs.length > 0) break
                    }
                }

                console.log(`[SYNC] Found ${msgs.length} messages from Evolution API`)

                // Resolve contact name from customers table
                let contactName = cleanPhone
                const { data: customer } = await supabaseAdmin.from('customers')
                    .select('name')
                    .in('phone', phoneVariants)
                    .maybeSingle()
                if (customer?.name && customer.name !== cleanPhone) {
                    contactName = customer.name
                }

                let savedCount = 0
                for (const m of msgs) {
                    if (!m.key?.id) continue

                    // Extract content
                    let content = ''
                    const msgObj = m.message
                    if (!msgObj) continue

                    if (msgObj.conversation) content = msgObj.conversation
                    else if (msgObj.extendedTextMessage?.text) content = msgObj.extendedTextMessage.text
                    else if (msgObj.imageMessage) content = msgObj.imageMessage.caption || '[Imagem]'
                    else if (msgObj.videoMessage) content = msgObj.videoMessage.caption || '[Vídeo]'
                    else if (msgObj.audioMessage) content = '[Áudio]'
                    else if (msgObj.documentMessage) content = msgObj.documentMessage.fileName || '[Documento]'
                    else if (msgObj.stickerMessage) content = '[Sticker]'
                    else content = '[Mídia]'

                    if (!content) continue

                    // Get name from message if available
                    const pushName = m.pushName || m.verifiedName
                    const msgContactName = (!m.key.fromMe && pushName && pushName !== cleanPhone && !/^\d+$/.test(pushName))
                        ? pushName : contactName

                    // Check duplicate by ID
                    const { data: exists } = await supabaseAdmin
                        .from('whatsapp_messages')
                        .select('id')
                        .eq('wa_message_id', m.key.id)
                        .maybeSingle()

                    if (!exists) {
                        const { error: insertErr } = await supabaseAdmin.from('whatsapp_messages').insert({
                            user_id: user.id,
                            contact_phone: cleanPhone,
                            contact_name: msgContactName,
                            content: content,
                            direction: m.key.fromMe ? 'outbound' : 'inbound',
                            wa_message_id: m.key.id,
                            status: m.key.fromMe ? 'sent' : 'received',
                            created_at: m.messageTimestamp ? new Date(Number(m.messageTimestamp) * 1000).toISOString() : new Date().toISOString()
                        })
                        if (!insertErr) savedCount++
                    }
                }

                console.log(`[SYNC] Done. Saved ${savedCount} new messages for ${cleanPhone}`)
                return new Response(JSON.stringify({ success: true, saved: savedCount, total: msgs.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            case 'send_message': {
                const { phone, message, jid: providedJid } = payload || {}
                const cleanPhone = (phone || '').replace(/\D/g, '')
                const msgText = (message || '').trim()

                // Heuristic: If providedJid has @lid, keep it. Else assume phone number.
                let targetJid = providedJid || `${cleanPhone}@s.whatsapp.net`

                // -- ROBUST SEND LOGIC --
                console.log(`[ACTION] send_message called. Target: ${targetJid}, Text Length: ${msgText.length}`)

                // 1. Try Primary Send
                let res = await EvolutionService.request(`/message/sendText/${instanceName}`, {
                    method: 'POST', body: JSON.stringify({ number: targetJid, text: msgText })
                })

                // 2. Fallback: If 400/404 and it's a LID, try phone number discovery
                if ((res.status === 400 || res.status === 404) && targetJid.includes('@lid')) {
                    console.log(`[SEND_RETRY] LID send failed (${res.status}). Attempting JID discovery...`)
                    const contactRes = await EvolutionService.request(`/contact/find/${instanceName}`, {
                        method: 'POST', body: JSON.stringify({ number: targetJid })
                    })

                    const contact = contactRes.json
                    const alternativeJid = contact?.id || contact?.remoteJid || contact?.jid

                    if (alternativeJid && alternativeJid.includes('@s.whatsapp.net') && alternativeJid !== targetJid) {
                        console.log(`[SEND_RETRY] Found real phone JID: ${alternativeJid}. Retrying once...`)
                        targetJid = alternativeJid
                        res = await EvolutionService.request(`/message/sendText/${instanceName}`, {
                            method: 'POST', body: JSON.stringify({ number: targetJid, text: msgText })
                        })
                    } else {
                        console.log(`[SEND_RETRY] No better JID found. Giving up on retry.`)
                    }
                }

                if (res.status === 201 || res.status === 200) {
                    const sentMsgInfo = res.json?.key || res.json?.item?.key || res.json?.data?.key || {}
                    const waId = sentMsgInfo.id || payload.wa_message_id

                    await supabaseAdmin.from('whatsapp_messages').insert({
                        user_id: user.id,
                        contact_phone: cleanPhone,
                        content: message,
                        direction: 'outbound',
                        wa_message_id: waId,
                        status: 'sent',
                        created_at: new Date().toISOString()
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

            case 'sync_history': {
                // Sync ALL recent chats and their messages into Supabase
                console.log(`[SYNC_HISTORY] Starting full history sync for instance ${instanceName}`)

                // 1. Fetch all chats
                const chatsRes = await EvolutionService.request(`/chat/findChats/${instanceName}`, {
                    method: 'POST', body: JSON.stringify({ where: {}, limit: 500 })
                })
                let allChats = Array.isArray(chatsRes.json) ? chatsRes.json : (chatsRes.json?.records || chatsRes.json?.data || [])

                // Filter only personal chats
                allChats = allChats.filter((c: any) => {
                    const id = c.id || c.remoteJid || ''
                    return id.includes('@s.whatsapp.net') || id.includes('@lid')
                })

                console.log(`[SYNC_HISTORY] Found ${allChats.length} personal chats to sync`)

                let totalSaved = 0
                let chatsProcessed = 0

                // 2. For each chat, fetch messages and save
                for (const chat of allChats.slice(0, 100)) { // Limit to 100 chats to avoid timeout
                    const chatJid = chat.id || chat.remoteJid
                    if (!chatJid) continue

                    const chatPhone = chatJid.split('@')[0]

                    try {
                        // Try Prisma-style first (Evolution v2.3+)
                        let msgRes = await EvolutionService.request(`/chat/findMessages/${instanceName}`, {
                            method: 'POST', body: JSON.stringify({ where: { key: { remoteJid: chatJid } }, limit: 50, offset: 0 })
                        })
                        let msgs = Array.isArray(msgRes.json) ? msgRes.json : (msgRes.json?.messages?.records || msgRes.json?.messages || msgRes.json?.data || [])
                        if (Array.isArray(msgs) === false) msgs = []

                        for (const m of msgs) {
                            if (!m.key?.id || !m.message) continue

                            let content = ''
                            const msgObj = m.message
                            if (msgObj.conversation) content = msgObj.conversation
                            else if (msgObj.extendedTextMessage?.text) content = msgObj.extendedTextMessage.text
                            else if (msgObj.imageMessage) content = msgObj.imageMessage.caption || '[Imagem]'
                            else if (msgObj.videoMessage) content = msgObj.videoMessage.caption || '[Vídeo]'
                            else if (msgObj.audioMessage) content = '[Áudio]'
                            else if (msgObj.documentMessage) content = msgObj.documentMessage.fileName || '[Documento]'
                            else if (msgObj.stickerMessage) content = '[Sticker]'
                            else content = '[Mídia]'

                            // Check duplicate
                            const { data: exists } = await supabaseAdmin
                                .from('whatsapp_messages')
                                .select('id')
                                .eq('wa_message_id', m.key.id)
                                .maybeSingle()

                            if (!exists) {
                                await supabaseAdmin.from('whatsapp_messages').insert({
                                    user_id: user.id,
                                    contact_phone: chatPhone,
                                    content,
                                    direction: m.key.fromMe ? 'outbound' : 'inbound',
                                    wa_message_id: m.key.id,
                                    status: m.key.fromMe ? 'sent' : 'received',
                                    created_at: m.messageTimestamp ? new Date(Number(m.messageTimestamp) * 1000).toISOString() : new Date().toISOString()
                                })
                                totalSaved++
                            }
                        }
                        chatsProcessed++
                    } catch (chatErr) {
                        console.warn(`[SYNC_HISTORY] Error syncing chat ${chatJid}:`, chatErr.message)
                    }
                }

                console.log(`[SYNC_HISTORY] Done! Processed ${chatsProcessed} chats, saved ${totalSaved} new messages`)
                return new Response(JSON.stringify({ success: true, chats: chatsProcessed, count: totalSaved }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            case 'chatwoot_proxy': {
                const { method = 'GET', payload: chatwootPayload } = body

                // The ERP passed the config in payload (API URL, TOKEN, path)
                const { apiUrl, token, path } = chatwootPayload

                if (!apiUrl || !token || !path) {
                    return new Response(JSON.stringify({ error: 'Missing Chatwoot proxy config' }), { status: 400, headers: corsHeaders })
                }

                const url = `${apiUrl}${path}`
                const headers: any = {
                    'api_access_token': token,
                    'Content-Type': 'application/json'
                }

                try {
                    const reqOpts: any = { method, headers }
                    if (method !== 'GET' && method !== 'HEAD' && chatwootPayload.body) {
                        reqOpts.body = JSON.stringify(chatwootPayload.body)
                    }

                    const cwRes = await fetch(url, reqOpts)
                    const cwJson = await cwRes.json()

                    return new Response(JSON.stringify(cwJson), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: cwRes.status })
                } catch (e: any) {
                    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
                }
            }

            case 'chatwoot_upload': {
                const { apiUrl, token, path, fileBase64, fileName, fileType, content = '' } = body.payload

                if (!apiUrl || !token || !path || !fileBase64) {
                    return new Response(JSON.stringify({ error: 'Missing upload params' }), { status: 400, headers: corsHeaders })
                }

                // Decode Base64 to Blob
                const byteCharacters = atob(fileBase64)
                const byteNumbers = new Array(byteCharacters.length)
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i)
                }
                const byteArray = new Uint8Array(byteNumbers)
                const blob = new Blob([byteArray], { type: fileType || 'application/octet-stream' })

                const formData = new FormData()
                formData.append('attachments[]', blob, fileName || 'upload.bin')
                if (content) formData.append('content', content)

                try {
                    const url = `${apiUrl}${path}`
                    const cwRes = await fetch(url, {
                        method: 'POST',
                        headers: { 'api_access_token': token },
                        body: formData
                    })
                    const cwJson = await cwRes.json()
                    return new Response(JSON.stringify(cwJson), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: cwRes.status })
                } catch (e: any) {
                    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
                }
            }

            case 'chatwoot_import_history': {
                console.log(`[ACTION] chatwoot_import_history called for ${instanceName}`)
                const res = await EvolutionService.request(`/chatwoot/importMessages/${instanceName}`, {
                    method: 'POST',
                    body: JSON.stringify({
                        accountId: CHATWOOT_CONFIG.accountId,
                        token: CHATWOOT_CONFIG.token,
                        url: CHATWOOT_CONFIG.url
                    })
                })
                return new Response(JSON.stringify(res.json), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            case 'chatwoot_all_messages': {
                const conversationId = payload.conversationId
                const maxPages = payload.pages || 5
                let allMessages: any[] = []

                for (let p = 1; p <= maxPages; p++) {
                    try {
                        const res = await fetch(`${CHATWOOT_CONFIG.url}/api/v1/accounts/${CHATWOOT_CONFIG.accountId}/conversations/${conversationId}/messages?page=${p}`, {
                            headers: { 'api_access_token': CHATWOOT_CONFIG.token, 'Content-Type': 'application/json' }
                        })
                        const data = await res.json()
                        const msgs = data?.payload || []
                        if (msgs.length === 0) break
                        allMessages = [...allMessages, ...msgs]
                    } catch { break }
                }

                return new Response(JSON.stringify(allMessages), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            default:
                return new Response(JSON.stringify({ error: `Invalid action: ${action}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
        }
    } catch (error) {
        console.error(`[FATAL] Global Error:`, error)
        const errMsg = error?.message || String(error || 'Unknown Error')
        return new Response(JSON.stringify({ error: errMsg }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        })
    }
})
