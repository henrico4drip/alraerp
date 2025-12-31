import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        const geminiKey = Deno.env.get('GEMINI_API_KEY') || ''
        const supabaseClient = createClient(supabaseUrl, supabaseKey)

        const { customerId, phone } = await req.json()

        if (!customerId || !phone) {
            return new Response(JSON.stringify({ error: "Missing customerId or phone" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // 1. Fetch Data for Analysis
        // Get last 20 messages
        const { data: messages } = await supabaseClient
            .from('whatsapp_messages')
            .select('content, direction, created_at')
            .eq('contact_phone', phone)
            .order('created_at', { ascending: false })
            .limit(20)

        // Get last 5 sales
        const { data: sales } = await supabaseClient
            .from('sales')
            .select('total_amount, items, sale_date')
            .eq('customer_id', customerId)
            .order('sale_date', { ascending: false })
            .limit(5)

        // Get current customer info
        const { data: customer } = await supabaseClient
            .from('customers')
            .select('name')
            .eq('id', customerId)
            .single()

        // 2. Prepare Prompt for Gemini
        const conversationHistory = messages?.reverse().map(m => `${m.direction === 'inbound' ? 'CLIENTE' : 'ATENDENTE'}: ${m.content}`).join('\n')
        const salesHistory = sales?.map(s => `Venda em ${s.sale_date}: R$ ${s.total_amount}`).join('\n') || 'Nenhuma compra recente.'

        const prompt = `
      Você é um analista de vendas especializado em CRM. Analise a conversa de WhatsApp e o histórico de compras do cliente "${customer?.name || 'Cliente'}".
      
      HISTÓRICO DE COMPRAS:
      ${salesHistory}

      ÚLTIMAS MENSAGENS NO WHATSAPP:
      ${conversationHistory}

      Sua tarefa é gerar um relatório JSON estrito com os seguintes campos:
      - score: Um número de 0 a 100 indicando a propensão de compra imediata (lead score).
      - status: Uma string curta (ex: "Aguardando Resposta", "Interessado", "Dúvida Técnica", "Negociando", "Atendido").
      - recommendation: Uma recomendação clara e curta para o vendedor sobre o que fazer agora.
      - summary: Um resumo super rápido (1 frase) do humor e interesse do cliente.

      Responda apenas o JSON, sem markdown ou explicações.
    `

        // 3. Call Gemini API
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiKey}`
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2, topP: 1, topK: 1 }
            })
        })

        const geminiData = await response.json()
        const resultText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

        // Clean potential markdown from Gemini
        const cleanJson = resultText.replace(/```json|```/g, '').trim()
        let aiInsights = { score: 0, status: 'Erro na Análise', recommendation: 'Tentar novamente', summary: '' }

        try {
            aiInsights = JSON.parse(cleanJson)
        } catch (e) {
            console.error('Failed to parse Gemini JSON:', e, 'Raw:', resultText)
        }

        // 4. Update Database
        const { error: updateError } = await supabaseClient
            .from('customers')
            .update({
                ai_score: aiInsights.score,
                ai_status: aiInsights.status,
                ai_recommendation: aiInsights.recommendation,
                last_ai_analysis: new Date().toISOString()
            })
            .eq('id', customerId)

        if (updateError) throw updateError

        return new Response(JSON.stringify({ success: true, insights: aiInsights }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
