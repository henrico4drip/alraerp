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
        const sessionName = `erp_${user.id.split('-')[0]}`

        let WPP_URL = Deno.env.get('WPPCONNECT_URL')?.replace(/\/$/, '')
        // Default secret for official WPPConnect Docker image is 'THISISMYSECURETOKEN'
        const WPP_SECRET = Deno.env.get('WPPCONNECT_SECRET_KEY') || 'THISISMYSECURETOKEN'

        if (!WPP_URL) {
            return new Response(JSON.stringify({ error: true, message: "WPPConnect URL missing." }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
            })
        }

        // 1. Gerar Token (Auth da WPPConnect)
        let token = null
        const secretsToTry = [Deno.env.get('WPPCONNECT_SECRET_KEY'), 'THISISMYSECURETOKEN'].filter(Boolean)

        for (const secret of secretsToTry) {
            addLog(`Attempting token generation with secret start: ${secret?.slice(0, 3)}...`)
            try {
                const tokenRes = await fetch(`${WPP_URL}/api/${sessionName}/${secret}/generate-token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
                const tokenData = await tokenRes.json()
                if (tokenData.token) {
                    token = tokenData.token
                    addLog('Token generated successfully!')
                    break
                } else {
                    addLog('Secret rejected by server', tokenData)
                }
            } catch (e) {
                addLog('Error during token attempt', e instanceof Error ? e.message : e)
            }
        }

        if (!token) {
            throw new Error('Could not authenticate with WPPConnect (All secrets failed)')
        }

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
            return new Response(JSON.stringify({ success: true, data: sendRes.json, log }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
            })
        }

        if (action === 'logout') {
            addLog('Logging out...')
            await safeFetch(`/api/${sessionName}/logout-session`, { method: 'POST' })
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
            log: [{ msg: 'Critical Error', data: error }]
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }
})
