import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // Verify user is authenticated
        const {
            data: { user },
        } = await supabaseClient.auth.getUser()

        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            })
        }

        const { action, payload } = await req.json()

        // Get Focus NFe Master Token from secrets
        // NOTE: User must set FOCUS_NFE_PROD_TOKEN and FOCUS_NFE_HOM_TOKEN
        // We will use based on payload.environment ('producao' or 'homologacao')
        const env = payload.environment || 'homologacao'
        const token = env === 'producao'
            ? Deno.env.get('FOCUS_NFE_PROD_TOKEN')
            : Deno.env.get('FOCUS_NFE_HOM_TOKEN')

        if (!token) {
            throw new Error(`Servidor não configurado com Token Focus NFe (${env})`)
        }

        const baseUrl = env === 'producao'
            ? 'https://api.focusnfe.com.br'
            : 'https://homologacao.focusnfe.com.br'

        // ACTION: REGISTER COMPANY
        if (action === 'register_company') {
            const {
                cnpj,
                razao_social,
                nome_fantasia,
                logradouro,
                numero,
                bairro,
                municipio,
                uf,
                cep,
                inscricao_estadual,
                regime_tributario,
                certificado_b64,
                senha_certificado
            } = payload

            // Focus NFe requires basic auth with token as username
            const auth = btoa(`${token}:`)

            // We need to send a JSON with company data
            // For certificate, Focus accepts base64 in the JSON for 'arquivo_certificado_base64'
            // Reference: https://focusnfe.com.br/doc/#criacao-de-empresa

            const companyBody = {
                cnpj,
                nome: razao_social,
                nome_fantasia: nome_fantasia || razao_social,
                inscricao_estadual,
                logradouro,
                numero,
                bairro,
                municipio,
                uf,
                cep,
                regime_tributario,
                arquivo_certificado_base64: certificado_b64,
                senha_certificado,
                habilita_nfce: true,
                habilita_nfe: true
            }

            console.log('Sending registration to Focus:', baseUrl + '/v2/empresas')

            const res = await fetch(`${baseUrl}/v2/empresas`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(companyBody)
            })

            const data = await res.json()

            if (!res.ok) {
                console.error('Focus Error:', data)
                throw new Error(data.mensagem || JSON.stringify(data))
            }

            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // ACTION: ISSUE NFCE
        if (action === 'issue_nfce') {
            const { nfe_payload, reference } = payload

            const auth = btoa(`${token}:`)
            const url = `${baseUrl}/v2/nfce?ref=${reference}`

            console.log(`Issuing NFCe at ${url}`)

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(nfe_payload)
            })

            const data = await res.json()

            // Focus returns 200 or 202 even if processing
            // We return whatever we got
            return new Response(JSON.stringify({ status: res.status, data }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // ACTION: GET COMPANY
        if (action === 'get_company') {
            const { company_id } = payload
            const auth = btoa(`${token}:`)

            const res = await fetch(`${baseUrl}/v2/empresas/${company_id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${auth}`
                }
            })

            const data = await res.json()
            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: res.status,
            })
        }

        throw new Error('Ação desconhecida')

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
