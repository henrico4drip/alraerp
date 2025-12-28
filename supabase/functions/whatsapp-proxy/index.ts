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

        addLog(`Proxy started`, { action, instanceName, url: EVO_API_URL });

        if (!EVO_API_URL || !EVO_API_KEY) {
            return new Response(JSON.stringify({ error: true, message: "URL ou Chave da Evolution não configurada no Supabase." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }

        const headers = { 'Content-Type': 'application/json', 'apikey': EVO_API_KEY, 'x-api-key': EVO_API_KEY }
        const withApiKey = (path: string) => `${EVO_API_URL}${path}${path.includes('?') ? '&' : '?'}apikey=${encodeURIComponent(EVO_API_KEY!)}`
        const safeFetchJson = async (path: string, init: RequestInit = {}, retries = 1, timeoutMs = 6000) => {
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
                    addLog(`safeFetch error: ${e instanceof Error ? e.message : String(e)}`)
                    await sleep(500)
                } finally {
                    clearTimeout(id)
                }
            }
            throw lastErr || new Error('Network error')
        }

        if (action === 'get_status') {
            const res = await safeFetchJson(`/instance/fetchInstances`, { headers }, 3, 10000)
            if (res.status === 403) {
                const msg = res.json?.response?.message || []
                const flat = Array.isArray(msg) ? msg.join(' | ') : String(msg || '')
                if (flat.toLowerCase().includes('missing global api key')) {
                    return new Response(JSON.stringify({ error: true, message: 'Evolution API Key ausente. Configure EVOLUTION_API_URL e EVOLUTION_API_KEY.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
                }
            }
            const data = res.json
            const found = Array.isArray(data) ? data.find((i: any) => i.instanceName === instanceName || i.name === instanceName) : null

            if (found) {
                const connStatus = (found.connectionStatus || found.state || found.status || '').toUpperCase()
                // Se está tentando conectar mas o QR não veio no fetch inicial, tenta o endpoint de connect
                if (connStatus === 'CONNECTING' && !found.qrcode) {
                    const connRes = await safeFetchJson(`/instance/connect/${instanceName}`, { headers }, 2, 10000)
                    const connData = connRes.json
                    // Se já vier status conectado pelo endpoint, devolve isso
                    const cs = (connData?.connectionStatus || connData?.status || connData?.instance?.connectionStatus || '').toUpperCase()
                    if (cs === 'OPEN' || cs === 'CONNECTED') {
                        return new Response(JSON.stringify({ status: 'connected', instance: connData.instance || found }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
                    }
                    return new Response(JSON.stringify(connData || found), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
                }
                // Inclui QR se presente no objeto encontrado
                if (found.qrcode?.base64 || found.qrcode?.code) {
                    return new Response(JSON.stringify({ instance: found, qrcode: found.qrcode, status: connStatus || found.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
                }
            }

            return new Response(JSON.stringify(found || { status: 'disconnected' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }

        if (action === 'connect') {
            // 1. Check if exists
            addLog(`Checking if instance exists`);
            const listRes = await safeFetchJson(`/instance/fetchInstances`, { headers }, 3, 10000)
            if (listRes.status === 403) {
                const msg = listRes.json?.response?.message || []
                const flat = Array.isArray(msg) ? msg.join(' | ') : String(msg || '')
                if (flat.toLowerCase().includes('missing global api key')) {
                    return new Response(JSON.stringify({ error: true, message: 'Evolution API Key ausente. Configure EVOLUTION_API_URL e EVOLUTION_API_KEY.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
                }
            }
            const instances = listRes.json
            const foundInitial = Array.isArray(instances) ? instances.find((i: any) => i.instanceName === instanceName || i.name === instanceName) : null

            if (!foundInitial) {
                addLog(`Instance ${instanceName} not found. Creating it...`);
                const createRes = await safeFetchJson(`/instance/create`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        instanceName: instanceName,
                        token: "TOKEN_" + instanceName,
                        integration: "WHATSAPP-BAILEYS",
                        qrcode: true
                    })
                }, 2, 12000)
                const createData = createRes.json;
                addLog(`Create response status: ${createRes.status}`, createData);

                // Se a instância já existe (403), não é erro - apenas continue
                if (createRes.status !== 201 && createRes.status !== 200 && createRes.status !== 403) {
                    return new Response(JSON.stringify({
                        error: true,
                        message: `Erro ao criar instância no servidor: ${createData.message || 'Erro desconhecido'}`,
                        details: createData,
                        log
                    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
                }

                if (createRes.status === 403) {
                    addLog(`Instance already exists, will connect to it`);
                } else {
                    await sleep(5000); // Espera o baileys apenas se criou agora
                }
            } else {
                addLog(`Instance exists. Forcing connect.`);
                const connRes = await safeFetchJson(`/instance/connect/${instanceName}`, { headers }, 3, 10000);
                const connData = connRes.json;
                addLog(`Connect result`, connData);
            }

            // Polling
            let lastPoll = null;
            // Aumentando o wait inicial para dar tempo do QR ser gerado pela Evolution
            addLog(`Waiting 8s for QR generation...`);
            const startWait = Date.now();
            await new Promise(resolve => setTimeout(resolve, 8000));
            addLog(`Waited ${Date.now() - startWait}ms`);

            // Até ~2 minutos
            for (let i = 0; i < 40; i++) {
                addLog(`Polling QR attempt ${i + 1}`);

                // Tenta pegar status geral
                const pollRes = await safeFetchJson(`/instance/fetchInstances`, { headers }, 3, 8000)
                const pollInstances = pollRes.json
                const found = Array.isArray(pollInstances) ? pollInstances.find((ins: any) => ins.instanceName === instanceName || ins.name === instanceName) : null

                if (found) {
                    addLog(`Poll status: ${found.connectionStatus || found.status}`, { found });

                    lastPoll = found;
                    const status = (found.connectionStatus || found.state || found.status || '').toUpperCase()
                    if (status === 'OPEN' || status === 'CONNECTED') {
                        return new Response(JSON.stringify({ status: 'connected', instance: found, log }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
                    }
                    // Se veio QR no objeto listado, devolve-o
                    if (found.qrcode?.base64 || found.qrcode?.code) {
                        return new Response(JSON.stringify({
                            base64: found.qrcode?.base64,
                            code: found.qrcode?.code,
                            instance: found,
                            log
                        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
                    }
                } else {
                    addLog(`Poll: Instance not found in list`);
                }

                // Tenta forçar pegar o QR via endpoint de connect
                try {
                    const qrRes = await safeFetchJson(`/instance/connect/${instanceName}`, { headers }, 2, 8000);
                    const qrData = qrRes.json;

                    addLog(`Connect endpoint response`, qrData);

                    // Se veio QR neste endpoint (base64 ou code) - v1.7.4 usa qrcode.base64
                    if (qrData?.base64 || qrData?.qrcode?.base64 || qrData?.code || qrData?.pairingCode) {
                        return new Response(JSON.stringify({
                            base64: qrData.base64 || qrData.qrcode?.base64,
                            code: qrData.code || qrData.pairingCode,
                            instance: found || qrData.instance,
                            log
                        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
                    }
                    // Se a resposta indicar conectado, finalize
                    const cs = (qrData?.connectionStatus || qrData?.status || qrData?.instance?.connectionStatus || '').toUpperCase()
                    if (cs === 'OPEN' || cs === 'CONNECTED') {
                        return new Response(JSON.stringify({ status: 'connected', instance: qrData.instance || found, log }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
                    }
                } catch (err: any) {
                    addLog(`Error checking connect endpoint: ${err.message}`)
                }

                await sleep(3000);
            }

            return new Response(JSON.stringify({ error: false, message: "QR Code ainda não gerado. Tente novamente.", debug: lastPoll, log }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }

        if (action === 'logout') {
            addLog(`Deleting instance`);
            const delRes = await fetch(withApiKey(`/instance/delete/${instanceName}`), { method: 'DELETE', headers });
            const delData = await delRes.json();
            return new Response(JSON.stringify({ success: true, log, delData }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }

        if (action === 'debug_list') {
            const res = await fetch(withApiKey(`/instance/fetchInstances`), { headers })
            const text = await res.text()
            let json: any
            try { json = JSON.parse(text) } catch { json = { raw: text } }
            return new Response(JSON.stringify(json), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: res.status })
        }

        return new Response(JSON.stringify({ error: true, message: "Ação inválida" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: true, message: error.message, log }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }
})
