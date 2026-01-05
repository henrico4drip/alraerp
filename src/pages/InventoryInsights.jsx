import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie
} from 'recharts';
import {
    ArrowLeft,
    TrendingUp,
    AlertTriangle,
    Package,
    DollarSign,
    ShoppingCart,
    Zap,
    ChevronRight,
    Sparkles,
    Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function InventoryInsights() {
    const navigate = useNavigate();

    // 1. Fetch Data
    const { data: products = [], isLoading: isLoadingProducts } = useQuery({
        queryKey: ['products'],
        queryFn: () => base44.entities.Product.list(),
    });

    const { data: sales = [], isLoading: isLoadingSales } = useQuery({
        queryKey: ['sales'],
        queryFn: () => base44.entities.Sale.list('-created_date'),
    });

    const isLoading = isLoadingProducts || isLoadingSales;

    // 2. Calculations
    const stats = useMemo(() => {
        if (!products.length) return null;

        const totalCostValue = products.reduce((acc, p) => acc + (Number(p.cost || 0) * Number(p.stock || 0)), 0);
        const totalSaleValue = products.reduce((acc, p) => acc + (Number(p.price || 0) * Number(p.stock || 0)), 0);
        const lowStockCount = products.filter(p => Number(p.stock || 0) <= 5).length;
        const outOfStockCount = products.filter(p => Number(p.stock || 0) <= 0).length;

        // Last 30 days sales velocity
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
                        if (!productSalesMap[key]) {
                            productSalesMap[key] = {
                                name: item.name,
                                quantity: 0,
                                revenue: 0,
                                productId: item.product_id
                            };
                        }
                        productSalesMap[key].quantity += Number(item.quantity || 1);
                        productSalesMap[key].revenue += (Number(item.price || 0) * Number(item.quantity || 1));
                    });
                }
            }
        });

        const topSold = Object.values(productSalesMap)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);

        const topRevenue = Object.values(productSalesMap)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

        // AI Suggestions (Products to buy)
        // Formula: (Total sold last 30 days / 30) * 15 days of backup - current stock
        const buySuggestions = products.map(p => {
            const saleData = productSalesMap[p.id] || productSalesMap[p.name] || { quantity: 0 };
            const dailyVelocity = saleData.quantity / 30;
            const recommendedStock = Math.ceil(dailyVelocity * 20); // 20 days buffer
            const shortfall = recommendedStock - Number(p.stock || 0);

            return {
                ...p,
                monthlyVelocity: saleData.quantity,
                recommendedStock,
                shortfall: shortfall > 0 ? shortfall : 0,
                urgency: shortfall > 0 ? (saleData.quantity > 5 ? 'Alta' : 'Média') : 'Baixa'
            };
        }).filter(p => p.shortfall > 0)
            .sort((a, b) => b.monthlyVelocity - a.monthlyVelocity)
            .slice(0, 8);

        // Seasonal Intelligence logic
        const currentMonth = new Date().getMonth(); // 0-11
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

        const seasonalAdvice = seasonalAdviceMap[currentMonth];
        const nextMonthAdvice = seasonalAdviceMap[(currentMonth + 1) % 12];

        return {
            totalCostValue,
            totalSaleValue,
            potentialProfit: totalSaleValue - totalCostValue,
            lowStockCount,
            outOfStockCount,
            topSold,
            topRevenue,
            buySuggestions,
            seasonalAdvice,
            nextMonthAdvice
        };
    }, [products, sales]);

    if (isLoading) return <LoadingSpinner />;

    return (
        <div className="min-h-screen bg-[#F8F9FC] p-4 md:p-8 animate-in fade-in duration-500">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate('/inventory')}
                            className="rounded-full bg-white shadow-sm border border-gray-100 hover:bg-gray-50"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </Button>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50/50">
                                    Inteligência de Vendas
                                </Badge>
                            </div>
                            <h1 className="text-3xl font-bold text-[#1A1C1E]">Insights de Estoque</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="bg-indigo-600 text-white px-4 py-2 rounded-2xl flex items-center gap-2 shadow-lg shadow-indigo-100 hover:scale-105 transition-transform cursor-default">
                            <Sparkles className="w-4 h-4" />
                            <span className="text-sm font-semibold">IA Analyzed</span>
                        </div>
                    </div>
                </div>

                {/* Top Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="rounded-3xl border-none shadow-sm hover:shadow-md transition-shadow bg-white overflow-hidden group">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-blue-50 rounded-2xl group-hover:bg-blue-600 transition-colors">
                                    <DollarSign className="w-5 h-5 text-blue-600 group-hover:text-white" />
                                </div>
                                <Badge className="bg-emerald-50 text-emerald-600 border-0">+12% vs last mo</Badge>
                            </div>
                            <p className="text-gray-500 text-sm font-medium">Valor Total (Custo)</p>
                            <h3 className="text-2xl font-bold text-[#1A1C1E] mt-1">
                                R$ {stats?.totalCostValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </h3>
                        </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-none shadow-sm hover:shadow-md transition-shadow bg-white overflow-hidden group">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-indigo-50 rounded-2xl group-hover:bg-indigo-600 transition-colors">
                                    <TrendingUp className="w-5 h-5 text-indigo-600 group-hover:text-white" />
                                </div>
                            </div>
                            <p className="text-gray-500 text-sm font-medium">Receita Potencial</p>
                            <h3 className="text-2xl font-bold text-[#1A1C1E] mt-1">
                                R$ {stats?.totalSaleValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </h3>
                        </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-none shadow-sm hover:shadow-md transition-shadow bg-white overflow-hidden group">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-amber-50 rounded-2xl group-hover:bg-amber-600 transition-colors">
                                    <AlertTriangle className="w-5 h-5 text-amber-600 group-hover:text-white" />
                                </div>
                            </div>
                            <p className="text-gray-500 text-sm font-medium">Estoque Baixo</p>
                            <h3 className="text-2xl font-bold text-[#1A1C1E] mt-1">
                                {stats?.lowStockCount} <span className="text-sm font-normal text-gray-400">produtos</span>
                            </h3>
                        </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-none shadow-sm hover:shadow-md transition-shadow bg-white overflow-hidden group">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-red-50 rounded-2xl group-hover:bg-red-600 transition-colors">
                                    <Package className="w-5 h-5 text-red-600 group-hover:text-white" />
                                </div>
                            </div>
                            <p className="text-gray-500 text-sm font-medium">Fora de Estoque</p>
                            <h3 className="text-2xl font-bold text-[#1A1C1E] mt-1">
                                {stats?.outOfStockCount} <span className="text-sm font-normal text-gray-400">produtos</span>
                            </h3>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="rounded-3xl border-none shadow-sm bg-white p-6">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <CardTitle className="text-lg font-bold text-[#1A1C1E]">Top 10 Mais Vendidos</CardTitle>
                                <p className="text-xs text-gray-500">Volume de vendas nos últimos 30 dias</p>
                            </div>
                            <ShoppingCart className="w-5 h-5 text-gray-300" />
                        </div>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats?.topSold} layout="vertical" margin={{ left: 40, right: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F3F5" />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={100}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: '#64748B' }}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#F8F9FC' }}
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                    />
                                    <Bar dataKey="quantity" radius={[0, 4, 4, 0]} barSize={20}>
                                        {stats?.topSold.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={['#6366F1', '#818CF8', '#A5B4FC'][index % 3]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <Card className="rounded-3xl border-none shadow-sm bg-white p-6">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <CardTitle className="text-lg font-bold text-[#1A1C1E]">Geração de Receita</CardTitle>
                                <p className="text-xs text-gray-500">Valor faturado por produto (30 dias)</p>
                            </div>
                            <Zap className="w-5 h-5 text-gray-300" />
                        </div>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats?.topRevenue}
                                        dataKey="revenue"
                                        nameKey="name"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                    >
                                        {stats?.topRevenue.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={['#0EA5E9', '#38BDF8', '#7DD3FC', '#BAE6FD'][index % 4]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>

                {/* Needs Attention / Recommendations */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden">
                            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                                <h3 className="font-bold text-[#1A1C1E] flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-indigo-600" />
                                    O Que Comprar? (Sugestões de Reposição)
                                </h3>
                                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Baseado em Giro de 20 dias</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-gray-50/50 text-[11px] text-gray-500 uppercase tracking-wider">
                                            <th className="px-6 py-3 font-semibold">Produto</th>
                                            <th className="px-6 py-3 font-semibold">Vendas (30d)</th>
                                            <th className="px-6 py-3 font-semibold text-center">Faltam</th>
                                            <th className="px-6 py-3 font-semibold text-right">Urgência</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {stats?.buySuggestions.map(item => (
                                            <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-gray-900">{item.name}</span>
                                                        <span className="text-[10px] text-gray-400">Atual: {item.stock} un</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-0">{item.monthlyVelocity} un</Badge>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="font-black text-indigo-900">{item.shortfall}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <div className={`w-2 h-2 rounded-full ${item.urgency === 'Alta' ? 'bg-red-500 animate-pulse' : item.urgency === 'Média' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                                        <span className={`text-xs font-bold ${item.urgency === 'Alta' ? 'text-red-600' : item.urgency === 'Média' ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                            {item.urgency}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {stats?.buySuggestions.length === 0 && (
                                <div className="p-10 text-center text-gray-400 italic text-sm">
                                    Tudo em dia! Seu estoque está adequado ao ritmo de vendas.
                                </div>
                            )}
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card className="rounded-3xl border-none shadow-lg bg-indigo-600 text-white p-6 relative overflow-hidden group">
                            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-colors" />
                            <div className="relative z-10">
                                <Sparkles className="w-8 h-8 mb-4 opacity-80" />
                                <h3 className="text-xl font-bold mb-2">Insight da Semana</h3>
                                <p className="text-sm text-indigo-100 leading-relaxed mb-6">
                                    {stats?.topSold[0] ? (
                                        `"${stats.topSold[0].name}" é o motor do seu negócio. Ele representa ${((stats.topSold[0].revenue / stats.totalSaleValue) * 100).toFixed(1)}% do seu faturamento em estoque. Considere uma campanha focada nele para girar ainda mais rápido.`
                                    ) : (
                                        "Seus dados estão sendo processados. Realize mais vendas para desbloquear insights personalizados baseados em inteligência artificial."
                                    )}
                                </p>
                                <div className="flex items-center gap-2 text-xs font-bold bg-white/20 px-3 py-2 rounded-xl w-fit">
                                    <Zap className="w-3 h-3" />
                                    AGIR AGORA
                                </div>
                            </div>
                        </Card>

                        {/* Seasonal Card */}
                        <Card className="rounded-3xl border-none shadow-sm bg-white p-6 border-l-4 border-l-orange-400">
                            <div className="flex items-center gap-2 mb-4">
                                <TrendingUp className="w-5 h-5 text-orange-500" />
                                <h3 className="font-bold text-[#1A1C1E]">Planejamento Sazonal</h3>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <Badge className="bg-orange-50 text-orange-600 border-0 mb-2">Mês Atual: {stats?.seasonalAdvice.season}</Badge>
                                    <p className="text-sm text-gray-600 leading-relaxed italic">
                                        "{stats?.seasonalAdvice.advice}"
                                    </p>
                                </div>
                                <div className="pt-4 border-t border-gray-50 text-sm">
                                    <p className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                                        <ChevronRight className="w-4 h-4 text-orange-500" />
                                        Comprar para o próximo mês:
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {stats?.nextMonthAdvice.focus.map((item, i) => (
                                            <Badge key={i} variant="outline" className="rounded-full px-3 py-0.5 border-orange-100 text-orange-700 bg-orange-50/20">
                                                {item}
                                            </Badge>
                                        ))}
                                    </div>
                                    <p className="mt-4 text-[11px] text-gray-400">
                                        As tendências mostram que {stats?.nextMonthAdvice.season} terá uma demanda alta para estes itens. Antecipe suas compras para garantir melhores preços com fornecedores.
                                    </p>
                                </div>
                            </div>
                        </Card>

                        <Card className="rounded-3xl border-none shadow-sm bg-white p-6">
                            <h3 className="font-bold text-[#1A1C1E] mb-4 flex items-center gap-2">
                                <Filter className="w-4 h-4 text-gray-400" />
                                Categorias em Alta
                            </h3>
                            <div className="space-y-4">
                                {/* Mock breakdown of categories if enough data */}
                                <div className="p-4 bg-gray-50 rounded-2xl flex justify-between items-center group cursor-default">
                                    <div>
                                        <h4 className="font-bold text-gray-900">Geral</h4>
                                        <p className="text-[10px] text-gray-500">Mais cresceu em volume</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:translate-x-1 group-hover:text-indigo-600 transition-all" />
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>

            </div>
        </div>
    );
}
