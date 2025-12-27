import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const { data: { user } } = await supabaseClient.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const { action, payload } = await req.json()
        let EVO_API_URL = Deno.env.get('EVOLUTION_API_URL')?.replace(/\/$/, '')
        const EVO_API_KEY = Deno.env.get('EVOLUTION_API_KEY')

        if (!EVO_API_URL || !EVO_API_KEY) throw new Error('Servidor não configurado')

        const instanceName = `erp_${user.id.split('-')[0]}`
        const headers = { 'Content-Type': 'application/json', 'apikey': EVO_API_KEY }

        // --- ACTIONS ---

        if (action === 'debug_list') {
            const res = await fetch(`${EVO_API_URL}/instance/fetchInstances`, { headers })
            const data = await res.json()
            return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }

        if (action === 'connect') {
            console.log(`[PROXY] Aggressive capture for ${instanceName}`)

            // 1. Tentar forçar a ativação da conexão
            await fetch(`${EVO_API_URL}/instance/connect/${instanceName}`, { headers }).catch(() => { })

            // 2. Tentar capturar o QR diretamente do objeto da instância (Muitas vezes o Baileys já deixa ele pronto aqui)
            let retries = 0
            let lastData: any = null

            while (retries < 6) {
                console.log(`[PROXY] Scan attempt ${retries + 1}/6...`)
                const listRes = await fetch(`${EVO_API_URL}/instance/fetchInstances`, { headers })
                const instances = await listRes.json()

                const found = Array.isArray(instances) ? instances.find((i: any) => i.name === instanceName) : null

                if (found) {
                    // SE O QR CODE ESTIVER NO OBJETO DA INSTÂNCIA
                    const qr = found.qrcode?.base64 || found.instance?.qrcode?.base64 || found.base64
                    const code = found.qrcode?.code || found.code

                    if (qr || code) {
                        console.log("[PROXY] QR Found in Instance Object!")
                        return new Response(JSON.stringify({
                            base64: qr,
                            code: code,
                            instance: found
                        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
                    }
                    lastData = found // Salva o status atual para debug se falhar
                }

                // Se não achou no objeto, tenta a rota de conexão tradicional mas com delay
                await new Promise(r => setTimeout(r, 4000))
                const cRes = await fetch(`${EVO_API_URL}/instance/connect/${instanceName}`, { headers })
                const cData = await cRes.json()

                if (cData.base64 || cData.code || cData.qrcode?.base64) {
                    return new Response(JSON.stringify(cData), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
                }

                retries++
            }

            // Fallback: Se não achou nada, devolve o que o servidor disse por último
            return new Response(JSON.stringify({
                error: false,
                message: "Aguardando geração do QR pelo servidor. Tente novamente em instantes.",
                debug: lastData
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }

        if (action === 'logout') {
            await fetch(`${EVO_API_URL}/instance/delete/${instanceName}`, { method: 'DELETE', headers }).catch(() => { })
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }

        if (action === 'send_message') {
            const { phone, message } = payload
            let formattedPhone = phone.replace(/\D/g, '')
            if (formattedPhone.length < 12) formattedPhone = '55' + formattedPhone

            const res = await fetch(`${EVO_API_URL}/message/sendText/${instanceName}`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ number: formattedPhone, text: message })
            })
            const data = await res.json()
            return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }

        throw new Error('Action not supported')

    } catch (error: any) {
        return new Response(JSON.stringify({ error: true, message: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    }
})
