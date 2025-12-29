import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    let log: any[] = [];
    const addLog = (msg: any, data: any = null) => {
        const d = new Date();
        const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
        const entry = `[${time}] ${msg}`;
        console.log(entry, data || '');
        log.push({ msg, data });
    }

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
        const instanceName = `erp_${user.id.split('-')[0]}`

        let EVO_API_URL = Deno.env.get('EVOLUTION_API_URL')?.replace(/\/$/, '')
        const EVO_API_KEY = Deno.env.get('EVOLUTION_API_KEY')

        if (!EVO_API_URL || !EVO_API_KEY) {
            return new Response(JSON.stringify({ error: true, message: "Server configuration missing." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }

        const headers = { 'Content-Type': 'application/json', 'apikey': EVO_API_KEY }
        const withApiKey = (path: string) => `${EVO_API_URL}${path}${path.includes('?') ? '&' : '?'}apikey=${encodeURIComponent(EVO_API_KEY!)}`

        const safeFetchJson = async (path: string, init: RequestInit = {}, retries = 1, timeoutMs = 12000) => {
            let lastErr: any = null
            for (let attempt = 0; attempt <= retries; attempt++) {
                const ctrl = new AbortController()
                const id = setTimeout(() => ctrl.abort(), timeoutMs)
                try {
                    const res = await fetch(withApiKey(path), { ...init, signal: ctrl.signal })
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

        if (action === 'get_status') {
            const res = await safeFetchJson(`/instance/fetchInstances`, { headers }, 2, 8000)
            const data = res.json
            const found = Array.isArray(data) ? data.find((i: any) =>
                (i.instance?.instanceName === instanceName) ||
                (i.instanceName === instanceName) ||
                (i.name === instanceName)
            ) : null

            if (found) {
                const inst = found.instance || found
                const connStatus = (inst.connectionStatus || inst.state || inst.status || '').toUpperCase()

                if (connStatus === 'OPEN' || connStatus === 'CONNECTED') {
                    return new Response(JSON.stringify({ status: 'connected', instance: inst, connectionStatus: 'CONNECTED' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
                }

                // Em 1.7.4 o connect gera o QR se não estiver aberto
                const connRes = await safeFetchJson(`/instance/connect/${instanceName}`, { headers }, 1, 8000).catch(() => null)
                const connData = connRes?.json
                const qrB64 = typeof connData?.qrcode === 'string' ? connData.qrcode : (connData?.qrcode?.base64 || connData?.base64)

                return new Response(JSON.stringify({
                    instance: inst,
                    qrcode: qrB64 ? { base64: qrB64 } : undefined,
                    pairingCode: connData?.pairingCode || connData?.code,
                    status: (connData?.status || connStatus).toUpperCase(),
                    connectionStatus: (connData?.status || connStatus).toUpperCase(),
                    log
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
            }
            return new Response(JSON.stringify({ status: 'disconnected', connectionStatus: 'DISCONNECTED', log }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }

        if (action === 'connect') {
            addLog(`Creating/Connecting ${instanceName}`);
            const listRes = await safeFetchJson(`/instance/fetchInstances`, { headers }, 2, 8000)
            const found = Array.isArray(listRes.json) ? listRes.json.find((i: any) => (i.instance?.instanceName === instanceName) || (i.instanceName === instanceName)) : null

            if (!found) {
                addLog(`Instance not found. Creating...`);
                await safeFetchJson(`/instance/create`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        instanceName,
                        qrcode: true,
                        integration: 'WHATSAPP-BAILEYS',
                        settings: {
                            syncFullHistory: false,
                            syncHistory: false,
                            syncMessages: false,
                            readMessages: false,
                            readStatus: false
                        }
                    })
                }, 1, 10000)
                await sleep(4000)
            }

            for (let i = 0; i < 15; i++) {
                const connRes = await safeFetchJson(`/instance/connect/${instanceName}`, { headers }, 1, 10000)
                const data = connRes.json
                const status = (data?.status || data?.instance?.status || data?.connectionStatus || '').toUpperCase()

                if (status === 'OPEN' || status === 'CONNECTED') {
                    return new Response(JSON.stringify({ status: 'connected', instance: data.instance || data, log }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
                }

                const b64 = typeof data?.qrcode === 'string' ? data.qrcode : (data?.qrcode?.base64 || data?.base64)
                if (b64) {
                    return new Response(JSON.stringify({ base64: b64, log }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
                }
                await sleep(4000);
            }
            return new Response(JSON.stringify({ error: true, message: "Timeout waiting for QR.", log }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }

        if (action === 'logout') {
            await safeFetchJson(`/instance/delete/${instanceName}`, { method: 'DELETE', headers }, 1, 8000).catch(() => { })
            return new Response(JSON.stringify({ success: true, log }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }

        return new Response(JSON.stringify({ error: true, message: "Invalid action" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })

    } catch (err: any) {
        return new Response(JSON.stringify({ error: true, message: err.message, log }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }
})
