import React, { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { supabase } from '@/api/supabaseClient'
import { useNavigate } from 'react-router-dom'
import {
  Zap,
  DollarSign,
  TrendingUp,
  MessageCircle,
  Star,
  Calendar,
  Sparkles,
  Instagram,
  Megaphone,
  Target,
  Brain,
  ChevronRight,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Copy
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function Marketing() {
  const navigate = useNavigate();
  const [marketingPlan, setMarketingPlan] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // 1. Fetch Data
  const { data: settingsArr = [], isLoading: isLoadingSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Settings.list(),
    initialData: [],
  })
  const settings = settingsArr?.[0] || {};

  const { data: sales = [], isLoading: isLoadingSales } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list('-created_date'),
    initialData: [],
  })

  const { data: customers = [], isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    initialData: [],
  })

  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
    initialData: [],
  })

  const isLoading = isLoadingSettings || isLoadingSales || isLoadingCustomers || isLoadingProducts;

  // 2. Metrics Calculations
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthSales = (sales || []).filter(s => s?.sale_date && new Date(s.sale_date) >= startOfMonth)
  const monthlyTotal = monthSales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0)

  const monthCustomerCounts = monthSales.reduce((m, s) => {
    const key = (s.customer_name || 'AVULSO')
    m[key] = (m[key] || 0) + 1
    return m
  }, {})
  const monthUniqueCustomers = Object.keys(monthCustomerCounts).length
  const monthRepeatCustomers = Object.values(monthCustomerCounts).filter(c => c > 1).length
  const retentionPercent = monthUniqueCustomers > 0 ? Math.round((monthRepeatCustomers / monthUniqueCustomers) * 100) : 0

  // 3. AI Opportunities Algorithm
  const opportunities = (customers || [])
    .filter(c => Number(c.cashback_balance || 0) > 0)
    .map(c => {
      const lastSale = sales.find(s => s.customer_id === c.id);
      const lastDate = lastSale ? new Date(lastSale.sale_date) : new Date(0);
      const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

      let score = Number(c.cashback_balance || 0) * 0.5;
      if (diffDays >= 15 && diffDays <= 60) score += 40;
      else if (diffDays > 60) score += 20;
      else score += 10;

      return { ...c, score, recency: diffDays };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // 4. Marketing Plan Generation
  const generatePlanAction = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-ai-analyzer', {
        body: {
          action: 'marketing_plan',
          shopInfo: {
            instagramHandle: settings.instagram_handle,
            brandVoice: settings.brand_voice,
            targetAudience: settings.target_audience,
            mainProducts: settings.main_products
          },
          products: products.map(p => ({
            name: p.name,
            price: p.price,
            stock: p.stock
          }))
        }
      });

      if (error) throw error;
      setMarketingPlan(data.plan);
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar planejamento. Verifique sua conexão e configurações de IA.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleWhatsAppAction = (customer) => {
    const firstName = customer.name.split(' ')[0];
    const balance = Number(customer.cashback_balance || 0).toFixed(2);
    const msg = `Olá ${firstName}! Tudo bem? Conferi aqui que você tem R$ ${balance} em cashback disponível na nossa loja. 🎁 Que tal aproveitar para nos visitar esta semana?`;
    const phone = String(customer.phone).replace(/\D/g, '');

    if (phone) {
      navigate(`/crm?phone=${phone}&message=${encodeURIComponent(msg)}`);
    } else {
      alert('Cliente sem telefone cadastrado.');
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="p-4 md:p-8 w-full bg-[#f8fafc] min-h-screen">
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">MARKETING DASHBOARD</h1>
            <p className="text-gray-500 font-medium">Potencialize suas vendas com Inteligência Artificial</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="rounded-2xl border-gray-200 bg-white shadow-sm"
              onClick={() => navigate('/settings')}
            >
              Configurar Branding
            </Button>
          </div>
        </div>

        {/* Top Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden group">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-blue-50 rounded-2xl group-hover:bg-blue-600 transition-colors">
                  <Zap className="w-5 h-5 text-blue-600 group-hover:text-white" />
                </div>
              </div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Cashback Ativo</p>
              <h3 className="text-3xl font-black text-gray-900 mt-1">{settings?.cashback_percentage ?? 0}%</h3>
              <p className="text-[10px] text-gray-400 mt-1">Estimulando a recorrência</p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden group">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-green-50 rounded-2xl group-hover:bg-green-600 transition-colors">
                  <DollarSign className="w-5 h-5 text-green-600 group-hover:text-white" />
                </div>
              </div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Receita (Mês)</p>
              <h3 className="text-3xl font-black text-gray-900 mt-1">{monthlyTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}</h3>
              <p className="text-[10px] text-gray-400 mt-1">{monthSales.length} vendas realizadas</p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden group">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-50 rounded-2xl group-hover:bg-indigo-600 transition-colors">
                  <TrendingUp className="w-5 h-5 text-indigo-600 group-hover:text-white" />
                </div>
              </div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Taxa de Retenção</p>
              <h3 className="text-3xl font-black text-gray-900 mt-1">{retentionPercent}%</h3>
              <p className="text-[10px] text-gray-400 mt-1">Clientes que voltaram</p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden group">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-amber-50 rounded-2xl group-hover:bg-amber-600 transition-colors">
                  <Target className="w-5 h-5 text-amber-600 group-hover:text-white" />
                </div>
              </div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Novos Clientes</p>
              <h3 className="text-3xl font-black text-gray-900 mt-1">{monthUniqueCustomers}</h3>
              <p className="text-[10px] text-gray-400 mt-1">No período atual</p>
            </CardContent>
          </Card>
        </div>

        {/* AI Planning Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#3490c7] fill-[#3490c7]/20" />
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">PLANEJAMENTO SAZONAL IA</h2>
            </div>
            {!marketingPlan && (
              <Button
                onClick={generatePlanAction}
                className="bg-[#3490c7] hover:bg-[#2c8ac2] text-white rounded-2xl px-6 font-bold shadow-lg shadow-blue-100 transition-all hover:scale-105"
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando Estratégia...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" />
                    Gerar Planejamento Completo
                  </>
                )}
              </Button>
            )}
          </div>

          {!marketingPlan && !isGenerating && (
            <Card className="rounded-[2.5rem] border-dashed border-2 border-gray-200 bg-white/50 p-12 text-center overflow-hidden relative">
              <div className="relative z-10 max-w-lg mx-auto space-y-4">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Calendar className="w-10 h-10 text-[#3490c7]" />
                </div>
                <h3 className="text-2xl font-black text-gray-900">Seu plano estratégico está pronto para ser criado</h3>
                <p className="text-gray-500 leading-relaxed font-medium">
                  Nossa IA analisará seu estoque atual, tom de voz da marca e comportamento de compra dos clientes para criar um calendário completo de posts, stories e ações de venda.
                </p>
                <div className="pt-4 flex flex-wrap justify-center gap-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-500" /> Posts para Feed</span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-500" /> Roteiro de Stories</span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-500" /> Gatilhos de Venda</span>
                </div>
              </div>
            </Card>
          )}

          {isGenerating && (
            <Card className="rounded-[2.5rem] border-none bg-white p-12 text-center shadow-xl">
              <div className="space-y-6">
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 border-4 border-blue-50 border-t-blue-500 rounded-full animate-spin" />
                  <div className="absolute inset-4 bg-blue-50 rounded-full flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-[#3490c7] animate-pulse" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-gray-900 animate-pulse">Consultando o Especialista...</h3>
                  <p className="text-gray-500 font-medium">Analisando seu estoque e definindo os melhores gatilhos para este mês.</p>
                </div>
              </div>
            </Card>
          )}

          {marketingPlan && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              <Card className="lg:col-span-2 rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden animate-in slide-in-from-bottom-5 duration-700">
                <CardHeader className="bg-[#3490c7] p-8 text-white relative">
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl font-black uppercase tracking-tight">AGENDA ESTRATÉGICA DO MÊS</CardTitle>
                      <p className="text-blue-100 font-medium text-sm opacity-90">Personalizado para sualoja e seu estoque atual</p>
                    </div>
                    <Button variant="ghost" className="text-white hover:bg-white/10 rounded-xl" onClick={() => {
                      navigator.clipboard.writeText(marketingPlan);
                      alert('Planejamento copiado!');
                    }}>
                      <Copy className="w-4 h-4 mr-2" /> Copiar
                    </Button>
                  </div>
                  <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                </CardHeader>
                <CardContent className="p-8">
                  <div className="prose prose-slate max-w-none prose-p:leading-relaxed prose-headings:font-black prose-headings:tracking-tight prose-strong:text-blue-600 prose-ul:list-none prose-ul:pl-0">
                    <div className="whitespace-pre-wrap text-gray-700 text-sm md:text-base selection:bg-blue-100 selection:text-blue-900">
                      {marketingPlan}
                    </div>
                  </div>
                  <div className="mt-8 pt-8 border-t border-gray-100 flex justify-center">
                    <Button onClick={generatePlanAction} variant="outline" className="rounded-2xl border-blue-100 text-blue-600 hover:bg-blue-50 font-bold">
                      <Sparkles className="w-4 h-4 mr-2" /> Recriar Planejamento
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="rounded-3xl border-none shadow-lg bg-white p-6 border-l-4 border-l-[#3490c7]">
                  <h4 className="font-black text-gray-900 flex items-center gap-2 mb-4 uppercase tracking-tighter">
                    <Megaphone className="w-5 h-5 text-[#3490c7]" /> Contexto Atual
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                      <Brain className="w-5 h-5 text-purple-500" />
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Tom de Voz</p>
                        <p className="text-xs font-bold text-gray-700">{settings.brand_voice || 'Não definido'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                      <Target className="w-5 h-5 text-red-500" />
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Foco do Público</p>
                        <p className="text-xs font-bold text-gray-700 truncate">{settings.target_audience || 'Não definido'}</p>
                      </div>
                    </div>
                    <Button variant="ghost" className="w-full text-[10px] font-bold text-blue-600 h-6 hover:bg-blue-50 rounded-lg justify-start" onClick={() => navigate('/settings')}>
                      ALTERAR CONFIGURAÇÕES <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </Card>

                <Card className="rounded-3xl border-none shadow-lg bg-gradient-to-br from-green-600 to-green-700 p-6 text-white relative overflow-hidden group">
                  <div className="relative z-10">
                    <h4 className="font-black text-lg mb-2 leading-none">Venda Agora</h4>
                    <p className="text-xs text-green-100 opacity-90 mb-4 font-medium">Contate clientes com saldo de cashback e gere caixa imediato.</p>
                    <Button className="w-full bg-white text-green-700 hover:bg-green-50 rounded-2xl font-black py-6 transition-all active:scale-95 shadow-lg" onClick={() => {
                      const container = document.getElementById('opportunities-section');
                      if (container) container.scrollIntoView({ behavior: 'smooth' });
                    }}>
                      VER OPORTUNIDADES
                    </Button>
                  </div>
                  <DollarSign className="absolute -bottom-4 -right-4 w-24 h-24 text-white opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-500" />
                </Card>
              </div>
            </div>
          )}
        </section>

        {/* Sales Opportunities */}
        <section id="opportunities-section" className="space-y-6 pt-4">
          <div className="flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Oportunidades de Ouro 🔥</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8">
              <p className="text-sm text-gray-500 mb-8 font-medium italic leading-relaxed">"Clientes quentes: possuem saldo de cashback, conhecem sua marca e não compram há mais de 15 dias. O custo de re-aquisição é quase zero."</p>

              <div className="space-y-5">
                {opportunities.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">Nenhuma oportunidade crítica no momento</p>
                  </div>
                ) : opportunities.map((customer) => (
                  <div key={customer.id} className="flex items-center justify-between p-4 rounded-3xl bg-gray-50/50 hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-[#3490c7] text-white flex items-center justify-center font-black text-sm shadow-md shadow-blue-100 group-hover:scale-110 transition-transform">
                        {customer.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-black text-gray-900 truncate">{customer.name}</div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-50 text-emerald-600 text-[9px] font-black border-none px-1.5 py-0 h-4">
                            R$ {Number(customer.cashback_balance).toFixed(2)}
                          </Badge>
                          <span className="text-[10px] text-gray-400 font-bold uppercase">Há {customer.recency} dias</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleWhatsAppAction(customer)}
                      className="w-12 h-12 rounded-2xl bg-green-500 text-white flex items-center justify-center hover:bg-green-600 shadow-lg shadow-green-100 transition-all hover:scale-110 active:scale-95"
                    >
                      <MessageCircle className="w-6 h-6" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            <div className="bg-[#1A1C1E] rounded-[2.5rem] p-8 text-white relative overflow-hidden flex flex-col justify-between shadow-2xl min-h-[350px]">
              <div className="relative z-10 space-y-6">
                <div className="space-y-2">
                  <span className="bg-[#3490c7] text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter">Insight de Conversão</span>
                  <h3 className="text-4xl font-black mb-4 leading-none tracking-tighter">CONVERTER É O<br />MELHOR JOGO.</h3>
                </div>
                <p className="text-gray-400 text-sm font-medium leading-relaxed max-w-xs">
                  Você tem <strong className="text-white font-black underline decoration-[#3490c7] decoration-4">{opportunities.length} clientes vip</strong> aguardando um motivo para retornar.
                </p>

                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-[#3490c7]" />
                    <span className="text-xs font-black uppercase tracking-widest text-[#3490c7]">Estratégia Recomendada</span>
                  </div>
                  <p className="text-[11px] text-gray-300 italic">"Envie uma mensagem personalizada mencionando o saldo exato e apresentando uma reposição (item do seu estoque)."</p>
                </div>
              </div>

              <div className="relative z-10 pt-4 flex items-center justify-between border-t border-white/10">
                <div className="flex -space-x-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500 border-2 border-[#1A1C1E]" />
                  <div className="w-10 h-10 rounded-full bg-indigo-500 border-2 border-[#1A1C1E]" />
                  <div className="w-10 h-10 rounded-full bg-purple-500 border-2 border-[#1A1C1E]" />
                  <div className="w-10 h-10 rounded-full bg-gray-700 border-2 border-[#1A1C1E] flex items-center justify-center text-[10px] font-bold">+{monthUniqueCustomers}</div>
                </div>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Growth Analytics</span>
              </div>

              <Instagram className="absolute -bottom-10 -right-10 w-48 h-48 text-white opacity-[0.03] -rotate-12" />
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
