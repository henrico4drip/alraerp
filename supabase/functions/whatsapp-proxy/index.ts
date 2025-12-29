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
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const { data: { user } } = await supabaseClient.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const body = await req.json().catch(() => ({}))
        const { action, payload } = body
        const instanceName = `erp_${user.id.split('-')[0]}_v4`

        let EVO_API_URL = Deno.env.get('EVOLUTION_API_URL')?.replace(/\/$/, '')
        const EVO_API_KEY = Deno.env.get('EVOLUTION_API_KEY')

        if (!EVO_API_URL || !EVO_API_KEY) {
            return new Response(JSON.stringify({ error: true, message: "Server configuration missing." }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
            })
        }

        const headers = { 'Content-Type': 'application/json', 'apikey': EVO_API_KEY }

        const safeFetchJson = async (path: string, init: RequestInit = {}, retries = 1, timeoutMs = 12000) => {
            let lastErr: any = null
            for (let attempt = 0; attempt <= retries; attempt++) {
                const ctrl = new AbortController()
                const id = setTimeout(() => ctrl.abort(), timeoutMs)
                try {
                    const res = await fetch(`${EVO_API_URL}${path}`, { ...init, signal: ctrl.signal, headers: { ...headers, ...init.headers } })
                    clearTimeout(id)
                    const text = await res.text()
                    let json: any
                    try { json = JSON.parse(text) } catch { json = null }
                    return { status: res.status, json, text }
                } catch (e) {
                    lastErr = e
                    addLog(`Fetch error (attempt ${attempt}): ${e instanceof Error ? e.message : String(e)}`)
                    await sleep(1000)
                } finally {
                    clearTimeout(id)
                }
            }
            throw lastErr || new Error('Network error')
        }

        // Helper para buscar instância
        const getInstance = async () => {
            const res = await safeFetchJson(`/instance/fetchInstances`, {}, 2, 8000)
            const instances = Array.isArray(res.json) ? res.json : []
            return instances.find((i: any) => i.name === instanceName || i.instanceName === instanceName)
        }

        if (action === 'get_status') {
            const inst = await getInstance()

            if (!inst) {
                return new Response(JSON.stringify({
                    status: 'disconnected',
                    connectionStatus: 'DISCONNECTED',
                    log
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
            }

            const connStatus = (inst.connectionStatus || inst.state || inst.status || '').toUpperCase()

            if (connStatus === 'OPEN' || connStatus === 'CONNECTED') {
                return new Response(JSON.stringify({
                    status: 'connected',
                    instance: inst,
                    connectionStatus: 'CONNECTED',
                    log
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
            }

            return new Response(JSON.stringify({
                instance: inst,
                status: connStatus || 'CLOSE',
                connectionStatus: connStatus || 'CLOSE',
                log
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }

        if (action === 'connect') {
            addLog(`Creating/Connecting ${instanceName}`)

            // Deleta instância antiga se existir
            await safeFetchJson(`/instance/delete/${instanceName}`, { method: 'DELETE' }, 0, 5000).catch(() => { })
            await sleep(2000)

            // Cria nova instância
            addLog('Creating new instance...')
            const createRes = await safeFetchJson(`/instance/create`, {
                method: 'POST',
                body: JSON.stringify({
                    instanceName,
                    qrcode: true,
                    integration: 'WHATSAPP-BAILEYS'
                })
            }, 1, 15000)

            if (!createRes.json?.instance) {
                return new Response(JSON.stringify({
                    error: true,
                    message: "Failed to create instance",
                    log
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
            }

            addLog('Instance created successfully')
            await sleep(2000)

            // Na Evolution API v2, precisamos chamar /instance/connect para iniciar a conexão
            addLog('Calling /instance/connect to start connection...')
            const connectInitRes = await safeFetchJson(`/instance/connect/${instanceName}`, {}, 1, 10000)

            // Log da resposta completa para debug
            addLog(`Connect response: ${JSON.stringify(connectInitRes?.json).slice(0, 200)}`)

            // Verifica se já veio o QR code na resposta do connect
            if (connectInitRes?.json) {
                const qrBase64 = connectInitRes.json?.base64 || connectInitRes.json?.qrcode?.base64 ||
                    (typeof connectInitRes.json?.qrcode === 'string' ? connectInitRes.json.qrcode : null)

                if (qrBase64) {
                    addLog('QR Code received immediately from /instance/connect!')
                    return new Response(JSON.stringify({
                        base64: qrBase64,
                        status: 'CONNECTING',
                        log
                    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
                }
            }


            addLog('Starting polling for QR code...')

            // Polling para pegar o QR code
            // Na Evolution API v2, o QR pode vir via:
            // 1. Endpoint /instance/connect/{instanceName}
            // 2. Objeto da instância em fetchInstances
            // 3. WebSocket/Webhook (não disponível aqui)

            for (let i = 0; i < 30; i++) {
                await sleep(2000)

                const inst = await getInstance()
                if (!inst) {
                    addLog(`Instance not found on attempt ${i + 1}`)
                    continue
                }

                const status = (inst.connectionStatus || '').toUpperCase()
                addLog(`Attempt ${i + 1}/30 - Status: ${status}`)

                // Log detalhado da instância para debug (apenas nas primeiras 3 tentativas)
                if (i < 3) {
                    addLog(`Instance keys: ${Object.keys(inst).join(', ')}`)
                }

                if (status === 'OPEN' || status === 'CONNECTED') {
                    addLog('Instance connected!')
                    return new Response(JSON.stringify({
                        status: 'connected',
                        instance: inst,
                        log
                    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
                }

                // Método 1: Verificar se há base64 na instância
                if (inst.qrcode || inst.qr || inst.base64) {
                    const qrData = inst.qrcode || inst.qr || inst.base64
                    const base64 = typeof qrData === 'string' ? qrData : (qrData?.base64 || qrData?.code)

                    if (base64) {
                        addLog('QR Code found in instance object!')
                        return new Response(JSON.stringify({
                            base64,
                            status: status || 'CONNECTING',
                            log
                        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
                    }
                }

                // Método 2: Tentar endpoint /instance/connect
                try {
                    const connectRes = await safeFetchJson(`/instance/connect/${instanceName}`, {}, 0, 5000)
                    if (connectRes?.json) {
                        const connData = connectRes.json
                        const qrBase64 = connData?.base64 || connData?.qrcode?.base64 ||
                            (typeof connData?.qrcode === 'string' ? connData.qrcode : null)

                        if (qrBase64) {
                            addLog('QR Code found via /instance/connect!')
                            return new Response(JSON.stringify({
                                base64: qrBase64,
                                status: 'CONNECTING',
                                log
                            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
                        }
                    }
                } catch (e) {
                    addLog(`Connect endpoint error: ${e instanceof Error ? e.message : String(e)}`)
                }
            }

            return new Response(JSON.stringify({
                error: true,
                message: "QR code generation timeout. Evolution API v2 requires WebSocket connection for real-time QR codes. Please use pairing code instead.",
                log
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }

        if (action === 'send_pairing_code') {
            let { number } = payload || {}
            number = String(number || '').replace(/\D/g, '')
            if (!number.startsWith('55') && (number.length === 10 || number.length === 11)) {
                number = '55' + number
            }

            addLog(`Requesting pairing code for ${number}`)

            // Deleta e recria instância
            await safeFetchJson(`/instance/delete/${instanceName}`, { method: 'DELETE' }, 0, 5000).catch(() => { })
            await sleep(2000)

            const createRes = await safeFetchJson(`/instance/create`, {
                method: 'POST',
                body: JSON.stringify({
                    instanceName,
                    qrcode: false,
                    number,
                    integration: 'WHATSAPP-BAILEYS'
                })
            }, 1, 15000)

            addLog(`Create response: ${JSON.stringify(createRes?.json).slice(0, 300)}`)
            await sleep(2000)

            // Tenta buscar código via /instance/connect
            addLog('Trying /instance/connect for pairing code...')
            const connectRes = await safeFetchJson(`/instance/connect/${instanceName}`, {}, 1, 10000)
            addLog(`Connect response: ${JSON.stringify(connectRes?.json).slice(0, 300)}`)

            if (connectRes?.json?.code || connectRes?.json?.pairingCode) {
                const code = connectRes.json.code || connectRes.json.pairingCode
                addLog(`Pairing code found in connect response: ${code}`)
                return new Response(JSON.stringify({ code, log }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
                })
            }

            // Polling para código de pareamento
            for (let i = 0; i < 15; i++) {
                await sleep(3000)
                const inst = await getInstance()

                if (!inst) {
                    addLog(`Instance not found (attempt ${i + 1})`)
                    continue
                }

                // Log detalhado nas primeiras 3 tentativas
                if (i < 3) {
                    addLog(`Instance keys: ${Object.keys(inst).join(', ')}`)
                    if (inst.pairingCode !== undefined) addLog(`pairingCode value: ${inst.pairingCode}`)
                    if (inst.code !== undefined) addLog(`code value: ${inst.code}`)
                }

                if (inst?.pairingCode || inst?.code) {
                    const code = inst.pairingCode || inst.code
                    addLog(`Pairing code found: ${code}`)
                    return new Response(JSON.stringify({ code, log }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
                    })
                }

                addLog(`Waiting for pairing code (attempt ${i + 1})...`)
            }

            return new Response(JSON.stringify({
                error: true,
                message: "Pairing code generation timeout",
                log
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }

        if (action === 'logout') {
            await safeFetchJson(`/instance/delete/${instanceName}`, { method: 'DELETE' }, 1, 15000).catch(() => { })
            return new Response(JSON.stringify({ success: true, log }), {
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
            log
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }
})
