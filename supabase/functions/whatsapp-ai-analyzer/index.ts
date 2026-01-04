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

    console.log("AI Analyzer: Starting analysis...")

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        const geminiKey = Deno.env.get('GEMINI_API_KEY') || ''
        const supabaseClient = createClient(supabaseUrl, supabaseKey)

        if (!geminiKey) {
            console.error("AI Analyzer: GEMINI_API_KEY is not set!")
            return new Response(JSON.stringify({ error: "Configuração pendente: GEMINI_API_KEY não encontrada." }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const { customerId, phone } = await req.json()
        console.log(`AI Analyzer: Analyzing customer ${customerId} with phone ${phone}`)

        if (!customerId || !phone) {
            return new Response(JSON.stringify({ error: "Missing customerId or phone" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Fetch context (more messages for better ranking)
        const [{ data: messages }, { data: sales }, { data: customer }] = await Promise.all([
            supabaseClient.from('whatsapp_messages').select('content, direction, created_at').eq('contact_phone', phone).order('created_at', { ascending: false }).limit(50),
            supabaseClient.from('sales').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(5),
            supabaseClient.from('customers').select('*').eq('id', customerId).single()
        ])

        const history = (messages || []).slice().reverse().map(m => {
            const cleanContent = (m.content || '').replace(/\n/g, ' ').trim()
            return `[${new Date(m.created_at).toLocaleString('pt-BR')}] ${m.direction === 'inbound' ? 'CLIENTE' : 'ATENDENTE'}: ${cleanContent}`
        }).join('\n')
        const purchases = (sales || []).map(s => `Venda em ${s.sale_date}: R$ ${s.total_amount}`).join('\n') || 'Nenhuma compra recente.'

        // --- CALCULATED METRICS (Force Logic) ---
        const sortedMsgs = (messages || []).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        const lastMsg = sortedMsgs[sortedMsgs.length - 1]
        const lastSender = lastMsg?.direction === 'inbound' ? 'CLIENTE' : 'ATENDENTE'
        const lastMsgTime = lastMsg ? new Date(lastMsg.created_at) : new Date()
        const diffMs = new Date().getTime() - lastMsgTime.getTime()
        const minutesSinceLast = Math.floor(diffMs / 60000)
        
        let consecutiveClientMessages = 0
        for (let i = sortedMsgs.length - 1; i >= 0; i--) {
            if (sortedMsgs[i].direction === 'inbound') consecutiveClientMessages++
            else break
        }

        const prompt = `
        Analise a conversa de WhatsApp abaixo entre um atendente e um cliente de uma loja de roupas e cosméticos.
        Data Atual: ${new Date().toLocaleString('pt-BR')}
        
        === DADOS DO SISTEMA (PRIORIDADE MÁXIMA) ===
        Quem falou por último: ${lastSender}
        Minutos desde a última msg: ${minutesSinceLast}
        Mensagens seguidas do cliente sem resposta: ${consecutiveClientMessages}
        ============================================

        Objetivo: Classificar o cliente (Ranking 0-100) e sugerir a próxima mensagem para vender.
        
        Histórico de Conversa (com datas):
        ${history}
        
        Histórico de Compras:
        ${purchases}
        
        Instruções de Ranking (Score 0-100):
        
        REGRA SUPREMA (Use os DADOS DO SISTEMA acima):
        
        1. Se "Quem falou por último" for "CLIENTE":
           - O SCORE DEVE SER NO MÍNIMO 90. PROIBIDO DAR MENOS DE 90.
           - Se "Mensagens seguidas" >= 2: SCORE 100 (Prioridade Máxima).
           - Se "Minutos desde a última msg" < 60 (1 hora): SCORE 99.
           - Se "Minutos desde a última msg" > 60: SCORE 95.
           
        2. Se "Quem falou por último" for "ATENDENTE":
           - O cliente já foi respondido. Score baixo/médio (20-60).
        
        3. Se o conteúdo for "preço", "comprar", "gostaria", "ver": Aumente para 100 se não respondido.

        NÃO ANALISE O SENTIMENTO SE A REGRA TÉCNICA (QUEM FALOU POR ÚLTIMO) JÁ DEFINIR O SCORE.
        SE O CLIENTE ESTÁ ESPERANDO (Last Sender = CLIENTE), É URGENTE. PONTO FINAL.
        
        Retorne APENAS um JSON:
        {
            "score": (número 0-100),
            "status": "Resumo curto do status (ex: Urgente - Esperando resposta sobre camiseta)",
            "recommendation": "Ação recomendada (ex: Responder preço agora)",
            "suggested_message": "Texto da mensagem sugerida"
        }
        `

        // 3. Call Gemini 2.0 Flash
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1, topP: 1, topK: 1 }
            })
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error("AI Analyzer: Gemini API Error", errorText)
            throw new Error(`Gemini API returned ${response.status}`)
        }

        const geminiData = await response.json()
        const resultText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
        console.log("AI Analyzer: Raw Gemini Output:", resultText)

        // Robust JSON extraction
        let cleanJson = resultText.trim()
        const jsonMatch = resultText.match(/\{[\s\S]*\}/)
        if (jsonMatch) cleanJson = jsonMatch[0]

        let aiInsights = { score: 0, status: 'Não analisado', recommendation: 'Tente novamente', summary: '', suggested_message: '' }
        try {
            aiInsights = JSON.parse(cleanJson)
        } catch (e) {
            console.error('AI Analyzer: Failed to parse JSON', e)
        }

        // --- HARD OVERRIDE LOGIC ---
        // Ensure consistency regardless of LLM "opinion"
        if (lastSender === 'CLIENTE') {
            let forcedScore = 90
            let urgencyReason = ''

            if (consecutiveClientMessages >= 2) {
                forcedScore = 100
                urgencyReason = ' (Cliente insistente - Várias mensagens)'
            } else if (minutesSinceLast < 60) {
                forcedScore = 99
                urgencyReason = ' (Mensagem recente - < 1h)'
            } else {
                forcedScore = 95
                urgencyReason = ' (Aguardando resposta)'
            }

            // Only override if LLM gave a lower score
            if ((aiInsights.score || 0) < forcedScore) {
                console.log(`AI Analyzer: Overriding score from ${aiInsights.score} to ${forcedScore}`)
                aiInsights.score = forcedScore
                aiInsights.status = `URGENTE${urgencyReason}`
            }
        }

        // 4. Update Database
        const { error: updateError } = await supabaseClient
            .from('customers')
            .update({
                ai_score: aiInsights.score || 0,
                ai_status: aiInsights.status || 'Neutro',
                ai_recommendation: aiInsights.recommendation || 'Gere uma análise.',
                ai_suggested_message: aiInsights.suggested_message || 'Olá! Como posso ajudar?',
                last_ai_analysis: new Date().toISOString()
            })
            .eq('id', customerId)

        if (updateError) {
            console.error("AI Analyzer: DB Update Error", updateError)
            throw updateError
        }

        console.log("AI Analyzer: Successfully updated customer profile")
        return new Response(JSON.stringify({ success: true, insights: aiInsights }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error("AI Analyzer: Unexpected Error", error)
        return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack,
            context: "Edge Function Catch"
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})

