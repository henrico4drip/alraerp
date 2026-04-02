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

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || ''
    const supabaseClient = createClient(supabaseUrl, supabaseKey)

    async function fetchGemini(prompt, apiKey, config = { temperature: 0.7 }) {
        const effectiveKey = apiKey || geminiKey
        if (!effectiveKey) return { error: "GEMINI_API_KEY não configurada." }

        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${effectiveKey}`
        
        const response = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: config
            })
        })

        if (!response.ok) {
            const errorText = await response.text()
            return { error: `Gemini API returned ${response.status}`, details: errorText }
        }
        return await response.json()
    }

    async function fetchOpenAI(prompt, apiKey, config = { temperature: 0.7 }) {
        if (!apiKey) return { error: "OpenAI API Key não fornecida." }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
                temperature: config.temperature
            })
        })

        if (!response.ok) {
            const errorText = await response.text()
            return { error: `OpenAI API returned ${response.status}`, details: errorText }
        }

        const data = await response.json()
        return {
            candidates: [{
                content: {
                    parts: [{ text: data.choices[0].message.content }]
                }
            }]
        }
    }

    try {
        const body = await req.json().catch(() => ({}))
        const { 
            customerId, phone, action, shopInfo, products, insights, 
            financialContext, previousPlan, targetMonth, targetYear,
            customApiKey, customProvider, userMessage 
        } = body

        const fetchAI = (prompt, options) => {
            if (customProvider === 'openai') return fetchOpenAI(prompt, customApiKey, options)
            return fetchGemini(prompt, customApiKey, options)
        }

        if (action === 'chat') {
            const prompt = `
            Você é o Assistente de Marketing da Alra ERP+. Você tem acesso aos seguintes dados da empresa:
            - Nome: ${shopInfo?.erpName}
            - Instagram: ${shopInfo?.instagramHandle}
            - Voz: ${shopInfo?.brandVoice}
            - Público: ${shopInfo?.targetAudience}
            - Produtos Principais: ${shopInfo?.mainProducts}
            
            Contexto de Vendas Recentes:
            - Receita Mês: R$ ${financialContext?.monthlyRevenue}
            - Clientes Novos: ${insights?.newCustomers}
            
            Pergunta do Usuário: ${userMessage}
            
            Responda de forma estratégica, consultiva e motivadora, focando em como aumentar as vendas usando as ferramentas do ERP (Cashback, WhatsApp, Marketing Sazonal).
            `
            const data = await fetchAI(prompt, { temperature: 0.7 })
            if (data.error) throw new Error(data.error)
            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, não consegui processar sua mensagem."
            return new Response(JSON.stringify({ success: true, reply }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        if (action === 'marketing_plan') {
            const revenue = Number(financialContext?.monthlyRevenue || 1);
            const debt = Number(financialContext?.upcomingDebt || 0);
            const revenueGoal = Number(financialContext?.revenueGoal || revenue * 1.1);
            const previousRevenue = Number(financialContext?.previousRevenue || revenue);
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

            const maxPrice = Math.max(...(products || []).map((p: any) => Number(p.price || 0)), 1);
            const seasonalKeywords = (insights?.seasonalReference?.focus || []).map((k: string) => k.toLowerCase());

            const scoredProducts = (products || []).map((p: any) => {
                const priceScore = (Number(p.price || 0) / maxPrice) * 30;
                const pName = p.name.toLowerCase();
                const isSeasonal = seasonalKeywords.some((k: string) => pName.includes(k));
                const seasonalScore = isSeasonal ? 40 : 0;
                const isBestSeller = (insights?.bestSellers || []).some((b: any) => b.name === p.name);
                let cashNeedBonus = 0;
                if (cashNeedLevel === 'ALTO') cashNeedBonus = isBestSeller ? 30 : 5;
                else cashNeedBonus = 15;
                const totalScore = priceScore + seasonalScore + cashNeedBonus;
                return { ...p, score: totalScore, isSeasonal };
            }).sort((a: any, b: any) => b.score - a.score).slice(0, 6);

            const prompt = `
            Crie um PLANEJAMENTO ESTRATÉGICO DE CRESCIMENTO para ${insights?.seasonalMonth}/${targetYear}.
            Meta de Faturamento: R$ ${revenueGoal.toFixed(2)}
            Faturamento Anterior: R$ ${previousRevenue.toFixed(2)}
            
            CONTEXTO:
            Pressão de Caixa: ${cashNeedLevel}
            Foco: ${strategyFocus}
            Produtos Recomendados (Score): ${scoredProducts.map((p: any) => p.name).join(', ')}
            
            Sazonalidade: ${insights?.seasonalReference?.advice}
            Branding: ${shopInfo?.brandVoice}, Público: ${shopInfo?.targetAudience}
            
            Retorne APENAS um JSON:
            {
              "monthly_strategy": { "title": "...", "description": "...", "seasonal_focus": "..." },
              "weeks": [
                {
                  "week_number": 1,
                  "title": "...",
                  "main_action": "...",
                  "feed_posts": [{ "day": "...", "type": "...", "photo_style": "...", "caption": "..." }],
                  "stories_sequences": [{ "name": "...", "steps": ["...", "..."] }],
                  "prospecting": ["..."],
                  "triggers": ["..."]
                },
                ... (GERE PARA AS 4 SEMANAS)
              ]
            }
            `
            const geminiData = await fetchAI(prompt, { temperature: 0.8 })
            if (geminiData.error) throw new Error(geminiData.error)
            const resultText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
            let cleanJson = resultText;
            const firstBrace = resultText.indexOf('{');
            const lastBrace = resultText.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) cleanJson = resultText.substring(firstBrace, lastBrace + 1);

            return new Response(JSON.stringify({ success: true, plan: cleanJson }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        if (action === 'analyze_customer') {
            const [{ data: messages }, { data: sales }, { data: customer }] = await Promise.all([
                supabaseClient.from('whatsapp_messages').select('content, direction, created_at').eq('contact_phone', phone).order('created_at', { ascending: false }).limit(30),
                supabaseClient.from('sales').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(5),
                supabaseClient.from('customers').select('*').eq('id', customerId).single()
            ])

            const history = (messages || []).slice().reverse().map(m => `${m.direction === 'inbound' ? 'CLIENTE' : 'ATENDENTE'}: ${m.content}`).join('\n')
            
            const prompt = `Analise a conversa e dê um score de propensão de compra (0-100), status, recomendação e mensagem sugerida.
            Conversa:
            ${history}
            Retorne apenas JSON: { "score": 80, "status": "...", "recommendation": "...", "suggested_message": "..." }`

            const data = await fetchAI(prompt, { temperature: 0.1 })
            if (data.error) throw new Error(data.error)
            const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
            const jsonMatch = resultText.match(/\{[\s\S]*\}/)
            const aiInsights = JSON.parse(jsonMatch ? jsonMatch[0] : '{}')

            await supabaseClient.from('customers').update({
                ai_score: aiInsights.score || 0,
                ai_status: aiInsights.status || 'Neutro',
                ai_recommendation: aiInsights.recommendation || 'Analise gerada.',
                ai_suggested_message: aiInsights.suggested_message || 'Olá!',
                last_ai_analysis: new Date().toISOString()
            }).eq('id', customerId)

            return new Response(JSON.stringify({ success: true, insights: aiInsights }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        return new Response(JSON.stringify({ error: "Ação não suportada" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
})
