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
  ChevronLeft,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Copy,
  RefreshCw,
  Edit2,
  Save,
  X
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function Marketing() {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);

  // Month Navigation State
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Editing State
  const [editingItem, setEditingItem] = useState(null); // {week, type, index}

  // 1. Fetch Data
  const { data: settingsArr = [], isLoading: isLoadingSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Settings.list(),
    initialData: [],
  })
  const settings = settingsArr?.[0] || {};

  // 1b. Load Marketing Plan for Selected Month
  const { data: currentPlan, isLoading: isLoadingPlan, refetch: refetchPlan } = useQuery({
    queryKey: ['marketing_plan', selectedMonth, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_plans')
        .select('*')
        .eq('month', selectedMonth)
        .eq('year', selectedYear)
        .maybeSingle(); // Use maybeSingle instead of single to avoid 406

      if (error) {
        console.error('Error loading plan:', error);
        return null;
      }
      return data;
    },
    initialData: null
  });

  const marketingPlan = currentPlan?.plan_data;

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

  // 3b. Inventory Intelligence for AI
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const productSalesMap = {};
  sales.forEach(sale => {
    const saleDate = new Date(sale.sale_date || sale.created_at);
    if (saleDate >= thirtyDaysAgo) {
      const items = typeof sale.items === 'string' ? JSON.parse(sale.items || '[]') : (sale.items || []);
      if (Array.isArray(items)) {
        items.forEach(item => {
          const key = item.product_id || item.name;
          if (!productSalesMap[key]) productSalesMap[key] = { name: item.name, quantity: 0 };
          productSalesMap[key].quantity += Number(item.quantity || 1);
        });
      }
    }
  });

  const bestSellers = Object.values(productSalesMap)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const lowStock = products
    .filter(p => Number(p.stock || 0) > 0 && Number(p.stock || 0) <= 5)
    .slice(0, 10);

  const outOfStock = products
    .filter(p => Number(p.stock || 0) <= 0)
    .slice(0, 10);

  const slowMovers = products
    .filter(p => {
      const hasStock = Number(p.stock || 0) > 10;
      const salesLast30 = productSalesMap[p.id] || productSalesMap[p.name];
      return hasStock && (!salesLast30 || salesLast30.quantity === 0);
    })
    .slice(0, 10);

  const seasonalAdviceMap = [
    { month: 0, season: 'Verão', focus: ['Regatas', 'Shorts', 'Biquínis', 'Moda Praia'], advice: 'Liquidação de Verão e preparação para Volta às Aulas. Foque em queimar estoque de itens leves.' },
    { month: 1, season: 'Transição Outono', focus: ['Moletons Leves', 'Calças Jeans', 'Tênis'], advice: 'Carnaval acabou. Hora de começar a introduzir peças de meia-estação e Outono.' },
    { month: 2, season: 'Outono', focus: ['Casacos', 'Botas', 'Cardigans', 'Calças'], advice: 'O clima esfriou. Garanta estoque de agasalhos e botas para o pico do Outono.' },
    { month: 3, season: 'Outono/Inverno', focus: ['Jaquetas', 'Lã', 'Tricô', 'Cachecóis'], advice: 'Preparação para o Dia das Mães. Itens de presente e moda inverno pesada em alta.' },
    { month: 4, season: 'Pico Inverno', focus: ['Sobretudos', 'Acessórios Térmicos', 'Presentes'], advice: 'Mês das Mães. Maior faturamento do semestre. Mantenha os best-sellers sempre repostos.' },
    { month: 5, season: 'Inverno/Namorados', focus: ['Kits de Presente', 'Lingerie', 'Moda Noite'], advice: 'Foco total em Dia dos Namorados e Festas Juninas/Julinas.' },
    { month: 6, season: 'Liquidação Inverno', focus: ['Liquidação total'], advice: 'Hora de limpar o estoque de inverno para abrir espaço para a Primavera.' },
    { month: 7, season: 'Transição Primavera', focus: ['Vestidos Leves', 'Camisas', 'Bermudas'], advice: 'Dia dos Pais chegando. Comece a introduzir a coleção de Primavera.' },
    { month: 8, season: 'Primavera', focus: ['Estampados', 'Cores Vivas', 'Sapatilhas'], advice: 'Primavera em pleno vapor. Foque em cores vibrantes e tecidos leves.' },
    { month: 9, season: 'Primavera/Verão', focus: ['Brinquedos', 'Moda Infantil', 'Shorts'], advice: 'Preparação para Dia das Crianças. O calor está voltando, antecipe o Verão.' },
    { month: 10, season: 'Pré-Natal/Black Friday', focus: ['Eletrônicos', 'Best-sellers', 'Presentes'], advice: 'Black Friday! Prepare estoque dos seus 10 produtos mais vendidos para o volume alto.' },
    { month: 11, season: 'Verão/Natal', focus: ['Presentes Amigo Oculto', 'Trajes de Festa', 'Branco'], advice: 'Pico do Natal e Ano Novo. Vestidos de festa e roupas brancas são essenciais agora.' }
  ];

  const currentMonth = new Date().getMonth();
  const currentSeasonalAdvice = seasonalAdviceMap[currentMonth];

  // 3c. Financial Intelligence (Expenses)
  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data } = await supabase.from('expenses').select('amount, due_date, status');
      return data || [];
    },
    initialData: []
  });

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const upcomingDebt = expenses
    .filter(e => e.status === 'open' && new Date(e.due_date) <= thirtyDaysFromNow)
    .reduce((acc, e) => acc + Number(e.amount || 0), 0);

  // 4. Marketing Plan Generation (Long-Term)
  const generatePlanAction = async () => {
    setIsGenerating(true);
    try {
      // 4a. Fetch Previous Month for Context
      const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;

      const { data: previousPlan } = await supabase
        .from('marketing_plans')
        .select('*')
        .eq('month', prevMonth)
        .eq('year', prevYear)
        .single()
        .then(res => ({ data: res.data, error: res.error?.code === 'PGRST116' ? null : res.error }));

      // 4b. Calculate Revenue Goal (10% growth if previous exists)
      const previousRevenue = previousPlan?.actual_revenue || monthlyTotal;
      const revenueGoal = previousRevenue * 1.10; // 10% growth target

      const { data, error } = await supabase.functions.invoke('whatsapp-ai-analyzer', {
        body: {
          action: 'marketing_plan',
          targetMonth: selectedMonth,
          targetYear: selectedYear,
          shopInfo: {
            instagramHandle: settings.instagram_handle,
            brandVoice: settings.brand_voice,
            targetAudience: settings.target_audience,
            mainProducts: settings.main_products
          },
          insights: {
            bestSellers,
            lowStock,
            outOfStock,
            slowMovers,
            seasonalMonth: new Date(selectedYear, selectedMonth - 1).toLocaleString('pt-BR', { month: 'long' }),
            seasonalReference: seasonalAdviceMap[selectedMonth - 1]
          },
          financialContext: {
            upcomingDebt,
            monthlyRevenue: monthlyTotal,
            revenueGoal,
            previousRevenue
          },
          previousPlan: previousPlan ? {
            plan: previousPlan.plan_data,
            revenue: previousPlan.actual_revenue,
            completionRate: previousPlan.completion_rate
          } : null,
          products: products
            .filter(p => Number(p.stock || 0) > 0)
            .map(p => ({
              name: p.name,
              price: p.price,
              stock: p.stock
            }))
        }
      });

      if (error) {
        let errorMessage = 'Falha na comunicação com a IA.';
        if (error.context) {
          try {
            const body = await error.context.json();
            errorMessage = body.error || errorMessage;
          } catch (e) {
            errorMessage = error.message || errorMessage;
          }
        } else {
          errorMessage = error.message || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const newPlan = data.plan;

      // 4c. Parse and Save to Database
      let planJson;
      try {
        const jsonStr = typeof newPlan === 'string' ? newPlan.trim() : '';
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1) {
          planJson = JSON.parse(jsonStr.substring(firstBrace, lastBrace + 1));
        }
      } catch (e) {
        console.error("JSON Parse Error:", e);
        throw new Error("Failed to parse AI response");
      }

      const genId = () => Math.random().toString(36).slice(2);

      // Upsert plan
      const { error: saveError } = await supabase
        .from('marketing_plans')
        .upsert({
          id: currentPlan?.id || genId(),
          user_id: (await supabase.auth.getSession()).data.session?.user?.id,
          month: selectedMonth,
          year: selectedYear,
          plan_data: planJson,
          revenue_goal: revenueGoal,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,month,year'
        });

      if (saveError) throw saveError;

      // Refresh plan view
      await refetchPlan();

    } catch (err) {
      console.error('Marketing IA Error:', err);
      alert(`Erro na IA: ${err.message}`);

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

        {/* Header with Month Navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">MARKETING DASHBOARD</h1>
            <p className="text-gray-500 font-medium">Planejamento Estratégico de Longo Prazo</p>

            {/* Month Picker */}
            <div className="flex items-center gap-3 mt-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (selectedMonth === 1) {
                    setSelectedMonth(12);
                    setSelectedYear(prev => prev - 1);
                  } else {
                    setSelectedMonth(prev => prev - 1);
                  }
                }}
                className="h-8 w-8 rounded-full hover:bg-gray-100"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <div className="px-4 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                <span className="font-bold text-emerald-900 capitalize">
                  {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (selectedMonth === 12) {
                    setSelectedMonth(1);
                    setSelectedYear(prev => prev + 1);
                  } else {
                    setSelectedMonth(prev => prev + 1);
                  }
                }}
                className="h-8 w-8 rounded-full hover:bg-gray-100"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
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
            <div className="flex items-center gap-4">
              {marketingPlan && !isGenerating && (
                <Button
                  onClick={generatePlanAction}
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-blue-100 text-blue-600 hover:bg-blue-50 font-bold h-9"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                  Novo Plano
                </Button>
              )}
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
              <div className="lg:col-span-2 space-y-12">
                {(() => {
                  // marketingPlan is already an object from DB (plan_data JSONB)
                  const planData = marketingPlan;

                  if (!planData || !planData.weeks) {
                    return (
                      <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
                        <CardHeader className="bg-[#3490c7] p-8 text-white">
                          <CardTitle className="text-2xl font-black uppercase tracking-tight">Estratégia Geral</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8">
                          <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">{marketingPlan}</div>
                        </CardContent>
                      </Card>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 gap-12">
                      {/* ESTRATÉGIA MENSAL */}
                      {planData.monthly_strategy && (
                        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden animate-in slide-in-from-top-5 duration-700">
                          <div className="p-8 bg-[#3490c7] text-white flex items-center justify-between">
                            <div className="space-y-1">
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Plano de Ação Mensal</span>
                              <h3 className="text-3xl font-black uppercase leading-tight tracking-tighter">{planData.monthly_strategy.title}</h3>
                            </div>
                            <Calendar className="w-12 h-12 opacity-20" />
                          </div>
                          <CardContent className="p-8 space-y-6">
                            <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100 flex items-start gap-4">
                              <Sparkles className="w-6 h-6 text-[#3490c7] shrink-0 mt-1" />
                              <p className="text-gray-700 font-medium leading-relaxed">{planData.monthly_strategy.description}</p>
                            </div>
                            {planData.monthly_strategy.seasonal_focus && (
                              <div className="flex items-center gap-2">
                                <Badge className="bg-amber-100 text-amber-700 border-amber-200 font-black uppercase text-[10px] py-1 px-3 rounded-full">
                                  🔥 FOCO: {planData.monthly_strategy.seasonal_focus}
                                </Badge>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {planData.weeks.map((week, idx) => (
                        <div key={idx} className="space-y-6 animate-in slide-in-from-bottom-5 duration-700" style={{ animationDelay: `${idx * 150}ms` }}>
                          <div className="flex items-center gap-4 px-2">
                            <div className="w-14 h-14 shrink-0 rounded-2xl bg-[#3490c7] text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-blue-100">
                              {week.week_number || (idx + 1)}
                            </div>
                            <div>
                              <h4 className="text-2xl font-black text-gray-900 tracking-tighter uppercase">{week.title}</h4>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <p className="text-[#3490c7] font-bold text-xs uppercase tracking-widest">{week.main_action}</p>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6">
                            <Card className="rounded-[2rem] border-none shadow-md bg-white overflow-hidden">
                              <div className="p-5 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
                                <Instagram className="w-5 h-5 text-indigo-600" />
                                <span className="font-black text-[10px] text-indigo-700 uppercase">Posts no Feed</span>
                              </div>
                              <CardContent className="p-6 space-y-5">
                                {week.feed_posts?.map((post, pIdx) => (
                                  <div key={pIdx} className="space-y-2 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                                    <div className="flex items-center justify-between">
                                      <Badge variant="outline" className="text-[8px] font-black uppercase text-indigo-500 border-indigo-100">
                                        {post.type}
                                      </Badge>
                                      {post.day && (
                                        <span className="text-[9px] font-black text-indigo-300 uppercase">{post.day}</span>
                                      )}
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-400">📸 {post.photo_style}</p>
                                    <p className="text-[11px] text-gray-700 leading-relaxed bg-gray-50 p-2.5 rounded-xl">"{post.caption}"</p>
                                  </div>
                                ))}
                              </CardContent>
                            </Card>

                            <Card className="rounded-[2rem] border-none shadow-md bg-white overflow-hidden">
                              <div className="p-5 bg-pink-50 border-b border-pink-100 flex items-center gap-2">
                                <Zap className="w-5 h-5 text-pink-600" />
                                <span className="font-black text-[10px] text-pink-700 uppercase">Stories</span>
                              </div>
                              <CardContent className="p-6 space-y-5">
                                {week.stories_sequences?.map((seq, sIdx) => (
                                  <div key={sIdx} className="space-y-2">
                                    <h5 className="text-[10px] font-black text-gray-800 flex items-center gap-1 uppercase tracking-tighter">
                                      <div className="w-1.5 h-1.5 rounded-full bg-pink-500" /> {seq.name}
                                    </h5>
                                    <div className="space-y-1.5 pl-2.5 border-l border-pink-100">
                                      {seq.steps?.map((step, stepIdx) => (
                                        <p key={stepIdx} className="text-[10px] text-gray-600 leading-tight">{step}</p>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </CardContent>
                            </Card>
                          </div>

                          <Card className="rounded-[2rem] border-none shadow-md bg-white overflow-hidden">
                            <div className="p-5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Target className="w-5 h-5 text-emerald-600" />
                                <span className="font-black text-[10px] text-emerald-700 uppercase">Estratégia de Prospecção</span>
                              </div>
                              <div className="flex gap-1">
                                {week.triggers?.map((trig, tIdx) => (
                                  <Badge key={tIdx} className="bg-amber-50 text-amber-700 border-amber-100 text-[8px] font-black uppercase">
                                    {trig}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <CardContent className="p-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                  {week.prospecting?.map((act, aIdx) => (
                                    <div key={aIdx} className="flex gap-2 items-start bg-gray-50/50 p-2 rounded-xl">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                      <p className="text-[11px] text-gray-700 font-medium">{act}</p>
                                    </div>
                                  ))}
                                </div>
                                <div className="bg-gradient-to-br from-[#1A1C1E] to-gray-800 p-5 rounded-3xl text-white relative overflow-hidden">
                                  <h5 className="font-black text-[10px] mb-2 uppercase tracking-tighter text-blue-400">Dica do Estrategista</h5>
                                  <p className="text-[11px] text-gray-300 italic leading-relaxed">
                                    "O segredo da {week.title} é o gatilho de {week.triggers?.[0] || 'Desejo'}. Responda rápido!"
                                  </p>
                                  <Sparkles className="absolute -bottom-2 -right-2 w-12 h-12 text-white opacity-10" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      ))}

                      <div className="py-8 flex justify-center">
                        <Button onClick={generatePlanAction} variant="outline" className="rounded-2xl border-blue-100 text-blue-600 hover:bg-blue-50 font-bold px-12 h-12">
                          <Sparkles className="w-4 h-4 mr-2" /> Recriar Planejamento
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* SIDEBAR RESTORED */}
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

                <Card className="rounded-3xl border-none shadow-lg bg-white p-6 border-l-4 border-l-green-600 relative overflow-hidden group">
                  <div className="relative z-10">
                    <h4 className="font-black text-gray-900 flex items-center gap-2 mb-2 uppercase tracking-tighter">
                      <DollarSign className="w-5 h-5 text-green-600" /> Venda Agora
                    </h4>
                    <p className="text-[11px] text-gray-500 mb-4 font-medium leading-relaxed">Contate clientes com saldo de cashback e gere caixa imediato.</p>
                    <Button
                      className="w-full bg-green-600 text-white hover:bg-green-700 rounded-2xl font-black py-4 transition-all active:scale-95 shadow-lg shadow-green-100"
                      onClick={() => {
                        const container = document.getElementById('opportunities-section');
                        if (container) container.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      VER OPORTUNIDADES
                    </Button>
                  </div>
                  <DollarSign className="absolute -bottom-4 -right-4 w-24 h-24 text-green-50 opacity-50 rotate-12 group-hover:scale-110 transition-transform duration-500 pointer-events-none" />
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
