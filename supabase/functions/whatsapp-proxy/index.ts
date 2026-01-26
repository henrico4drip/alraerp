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

        if (init.body && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json'
        }

        try {
            console.log(`[EVO] ${init.method || 'GET'} ${url}`)
            const res = await fetch(url, { ...init, headers })
            const text = await res.text()
            let json = null
            try { json = JSON.parse(text) } catch { }
            return { status: res.status, json, text }
        } catch (e) {
            console.error(`[EVO] Fatal Error: ${e.message}`)
            return { status: 0, json: null, text: e.message }
        }
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const bodyText = await req.text()
        let body: any = {}
        try { body = JSON.parse(bodyText) } catch { }

        const { action, payload } = body

        // AUTHENTICATION
        const authHeader = req.headers.get('Authorization') ?? ''
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )
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
                // Try BOTH endpoints: newer and older Evolution API versions
                let res = await EvolutionService.request(`/chat/findContacts/${instanceName}`, {
                    method: 'POST',
                    body: JSON.stringify(payload || { where: {}, limit: 1000 })
                })

                // If 404 or empty records, try the other one
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

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
})
