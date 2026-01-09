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

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || ''
    const supabaseClient = createClient(supabaseUrl, supabaseKey)

    if (!geminiKey) {
        console.error("AI Analyzer: GEMINI_API_KEY is not set!")
        return new Response(JSON.stringify({ error: "Configuração pendente: GEMINI_API_KEY não encontrada." }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    async function fetchGemini(prompt, config = { temperature: 0.7 }) {
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`

        let attempts = 0
        const maxAttempts = 2

        while (attempts < maxAttempts) {
            attempts++
            const response = await fetch(geminiApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: config
                })
            })

            if (response.status === 429 && attempts < maxAttempts) {
                console.warn(`AI Analyzer: Gemini 429 detected. Attempt ${attempts} failed. Waiting 5s...`)
                await new Promise(r => setTimeout(r, 5000))
                continue
            }

            if (!response.ok) {
                const errorText = await response.text()
                console.error(`AI Analyzer: Gemini API Error (Attempt ${attempts}):`, errorText)
                return { error: `Gemini API returned ${response.status}`, details: errorText }
            }

            return await response.json()
        }
        return { error: "Gemini API failed after multiple retries due to 429." }
    }

    try {
        const body = await req.json().catch(() => ({}))
        console.log("AI Analyzer: Received body:", JSON.stringify(body))
        const { customerId, phone, action, shopInfo, products, insights, financialContext } = body

        if (action === 'marketing_plan') {
            console.log("AI Analyzer: Generating Advanced Marketing Plan with Financial Scoring...")

            // 1. Algoritmo de Pressão de Caixa (Confidencial)
            const revenue = Number(financialContext?.monthlyRevenue || 1);
            const debt = Number(financialContext?.upcomingDebt || 0);
            const cashNeedRatio = debt / (revenue || 1);

            let cashNeedLevel = 'BAIXO';
            let strategyFocus = 'Branding e Fidelização';

            if (cashNeedRatio > 0.8) {
                cashNeedLevel = 'ALTO';
                strategyFocus = 'LIQUIDEZ IMEDIATA e Venda Direta';
            } else if (cashNeedRatio > 0.4) {
                cashNeedLevel = 'MÉDIO';
                strategyFocus = 'Equilíbrio entre Valor e Volume';
            }

            // 2. Score de Oportunidade (Algoritmo de Priorização)
            // Fórmula: (Preço normalizado * 30) + (Sazonalidade * 40) + (Bônus de Caixa * 30)
            const maxPrice = Math.max(...(products || []).map((p: any) => Number(p.price || 0)), 1);
            const seasonalKeywords = (insights?.seasonalReference?.focus || []).map((k: string) => k.toLowerCase());

            const scoredProducts = (products || []).map((p: any) => {
                const priceScore = (Number(p.price || 0) / maxPrice) * 30; // Peso 30 no Ticket

                const pName = p.name.toLowerCase();
                const isSeasonal = seasonalKeywords.some((k: string) => pName.includes(k));
                const seasonalScore = isSeasonal ? 40 : 0; // Peso 40 na Sazonalidade

                // Se Caixa = ALTO, priorizar Best Sellers (Giro Rápido)
                const isBestSeller = (insights?.bestSellers || []).some((b: any) => b.name === p.name);
                let cashNeedBonus = 0;
                if (cashNeedLevel === 'ALTO') {
                    cashNeedBonus = isBestSeller ? 30 : 5;
                } else {
                    // Se Caixa = BAIXO, priorizar Margem/Ticket (mesmo que gire menos)
                    cashNeedBonus = 15;
                }

                const totalScore = priceScore + seasonalScore + cashNeedBonus;

                return { ...p, score: totalScore, isSeasonal };
            }).sort((a: any, b: any) => b.score - a.score).slice(0, 6);

            const prompt = `
            Você é um Diretor Criativo e Estrategista de Vendas de Elite.
            Sua missão é criar um PLANEJAMENTO AGRESSIVO e HIPER-DETALHADO para o Instagram @${shopInfo?.instagramHandle || 'da loja'}.

            === MONITORAMENTO FINANCEIRO (CONFIDENCIAL) ===
            [DADOS INTERNOS - NÃO REVELAR VALORES]
            Nível de Pressão de Caixa: ${cashNeedLevel}
            Foco Estratégico Obrigatório: ${strategyFocus}
            
            === TOP OPORTUNIDADES (SCORE IA) ===
            Estes são os produtos "Campeões" definidos pelo algoritmo (Ticket + Sazonalidade + Giro):
            ${scoredProducts.map((p: any) => `- ${p.name} (Score: ${Math.round(p.score)}/100) ${p.isSeasonal ? '★ Sazonal' : ''}`).join('\n')}

            === INTELIGÊNCIA SAZONAL (REFERÊNCIA OBRIGATÓRIA) ===
            Mês: ${insights?.seasonalMonth}
            Temporada: ${insights?.seasonalReference?.season}
            Foco Sazonal: ${insights?.seasonalReference?.focus?.join(', ')}
            DIRETRIZ MESTRA: ${insights?.seasonalReference?.advice}

            === CATÁLOGO DISPONÍVEL (ESTOQUE REAL) ===
            Use APENAS estes produtos para criar os posts e stories. Se não estiver aqui, NÃO EXISTE.
            ${(products || []).slice(0, 50).map((p: any) => `- ${p.name} (R$ ${p.price})`).join('\n')}

            === CONTEXTO DA LOJA ===
            Instagram: @${shopInfo?.instagramHandle}
            Tom de Voz: ${shopInfo?.brandVoice}
            Público: ${shopInfo?.targetAudience}

            === INSIGHTS DO ESTOQUE (PROVAS E OPORTUNIDADES) ===
            - BEST SELLERS (Prova Social/FOMO): ${insights?.bestSellers?.map(p => p.name).join(', ') || 'Vários itens'}
            - SLOW MOVERS (Liquidar/Promoção): ${insights?.slowMovers?.map(p => p.name).join(', ') || 'Itens selecionados'}
            - BAIXO ESTOQUE (Urgência): ${insights?.lowStock?.map(p => p.name).join(', ') || 'Poucas unidades'}
            - FORA DE ESTOQUE (Desejo/Lista de Espera): ${insights?.outOfStock?.map(p => p.name).join(', ') || 'Reposições em breve'}

            Instruções do Planejamento (VOLUME MÁXIMO):
            1. REGRA DE OURO: Você SÓ pode criar conteúdo sobre os produtos do "CATÁLOGO DISPONÍVEL" ou "TOP OPORTUNIDADES". Proibido inventar itens.
            2. OBRIGATÓRIO: O array "weeks" DEVE conter exatamente 4 SEMANAS (Semana 1, 2, 3 e 4). Não pare na primeira.
            3. STORIES (VOLUME EXTREMO): No mínimo 35 Sequências de Stories por semana (5+ POR DIA).
            4. FEED (CONSISTÊNCIA): No mínimo 7 posts por semana (1 por dia).

            IMPORTANTE: Retorne APENAS um objeto JSON puro seguindo exatamente esta estrutura (GERE AS 4 SEMANAS):
            {
              "monthly_strategy": {
                "title": "Título da Estratégia Mensal",
                "description": "Texto detalhado do plano de ação para o mês",
                "seasonal_focus": "Foco sazonal (ex: Verão, Volta às Aulas)"
              },
              "weeks": [
                {
                  "week_number": 1,
                  "title": "Título Semana 1",
                  "main_action": "Estratégia Principal S1",
                  "feed_posts": [
                    { "day": "Segunda-feira", "type": "Reels/Carrossel", "photo_style": "Visual", "caption": "Legenda" }
                  ],
                  "stories_sequences": [
                    { "name": "Segunda-feira (Tópico)", "steps": ["St1: ...", "St2: ..."] }
                  ],
                  "prospecting": ["Ação Direta"],
                  "triggers": ["Gatilho usado"]
                },
                {
                  "week_number": 2,
                  "title": "Título Semana 2 (Continuação Obrigatória)",
                  "main_action": "Estratégia Principal S2",
                  "feed_posts": [],
                  "stories_sequences": [],
                  "prospecting": [],
                  "triggers": []
                },
                { "week_number": 3, "title": "Título Semana 3...", "main_action": "...", "feed_posts": [], "stories_sequences": [], "prospecting": [], "triggers": [] },
                { "week_number": 4, "title": "Título Semana 4...", "main_action": "...", "feed_posts": [], "stories_sequences": [], "prospecting": [], "triggers": [] }
              ]
            }
            `

            const geminiData = await fetchGemini(prompt, { temperature: 0.8 })

            if (!geminiData || geminiData.error) {
                console.error("Gemini API returned an error:", geminiData?.error || "Unknown error")
                return new Response(JSON.stringify({ error: `Erro na API do Gemini: ${geminiData?.error || "Serviço indisponível"}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            if (!geminiData.candidates || geminiData.candidates.length === 0) {
                const reason = geminiData.promptFeedback?.blockReason || 'Causa desconhecida (possível filtro de segurança)'
                return new Response(JSON.stringify({ error: `A IA não conseguiu gerar o texto. Motivo: ${reason}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            const resultText = geminiData.candidates[0].content.parts[0].text

            // Extrator robusto de JSON: busca tudo entre a primeira { e a última }
            let cleanJson = resultText;
            const firstBrace = resultText.indexOf('{');
            const lastBrace = resultText.lastIndexOf('}');

            if (firstBrace !== -1 && lastBrace !== -1) {
                cleanJson = resultText.substring(firstBrace, lastBrace + 1);
            }

            return new Response(JSON.stringify({ success: true, plan: cleanJson }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        console.log(`AI Analyzer: Analyzing customer ${customerId} with phone ${phone}`)

        if (!customerId || !phone) {
            return new Response(JSON.stringify({ error: "Ação inválida ou dados do cliente ausentes (customerId/phone)." }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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

        const geminiData = await fetchGemini(prompt, { temperature: 0.1, topP: 1, topK: 1 })

        if (!geminiData || geminiData.error) {
            console.error("AI Analyzer: Gemini API Error", geminiData?.error || "Unknown error")
            return new Response(JSON.stringify({ error: `Erro na API do Gemini: ${geminiData?.error || "Serviço indisponível"}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

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
