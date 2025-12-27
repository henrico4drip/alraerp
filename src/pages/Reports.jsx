import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  BarChart,
  Bar
} from "recharts";
import {
  Card,
  CardContent
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Receipt,
  TrendingUp,
  Users,
  Package,
  Clock
} from "lucide-react";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Reports() {
  const { data: sales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list('-created_date'),
    initialData: [],
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
    initialData: [],
  });

  // Default to current month
  const [dateRange, setDateRange] = useState({
    from: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    to: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  const [filters, setFilters] = useState({
    payment: "all",
    search: ""
  });

  // --- Data Processing ---

  const productCostMap = useMemo(() => {
    const map = new Map();
    products.forEach(p => map.set(p.id, Number(p.cost || 0)));
    return map;
  }, [products]);

  const costOfSale = (sale) => {
    return (sale.items || []).reduce((sum, item) => {
      const cost = productCostMap.get(item.product_id) || 0;
      return sum + cost * (item.quantity || 0);
    }, 0);
  };

  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      if (!sale.sale_date) return false;
      const d = parseISO(sale.sale_date); // using parseISO for better reliability
      const start = parseISO(dateRange.from);
      const end = new Date(parseISO(dateRange.to));
      end.setHours(23, 59, 59, 999);

      if (d < start || d > end) return false;

      if (filters.payment !== "all" && sale.payment_method !== filters.payment) return false;

      if (filters.search) {
        const s = filters.search.toLowerCase();
        const matchesName = (sale.customer_name || '').toLowerCase().includes(s);
        const matchesId = (sale.sale_number || '').toLowerCase().includes(s);
        if (!matchesName && !matchesId) return false;
      }

      return true;
    });
  }, [sales, dateRange, filters]);

  const summary = useMemo(() => {
    const totalRevenue = filteredSales.reduce((sum, s) => {
      const net = Math.max(0, Number(s.total_amount || 0) - Number(s.discount_amount || 0) - Number(s.cashback_used || 0));
      return sum + net;
    }, 0);
    const totalCost = filteredSales.reduce((sum, s) => sum + costOfSale(s), 0);
    const totalEarned = filteredSales.reduce((sum, s) => sum + (s.cashback_earned || 0), 0);
    const count = filteredSales.length;
    const avgTicket = count ? totalRevenue / count : 0;
    const netProfit = totalRevenue - totalCost - totalEarned; // Simplificado

    return { totalRevenue, totalCost, totalEarned, count, avgTicket, netProfit };
  }, [filteredSales]);

  // Daily Series for Chart
  const dailyData = useMemo(() => {
    const map = new Map();

    // Fill all days in range
    let current = parseISO(dateRange.from);
    const end = parseISO(dateRange.to);

    while (current <= end) {
      const k = format(current, 'yyyy-MM-dd');
      map.set(k, {
        date: k,
        label: format(current, 'dd/MM'),
        fullLabel: format(current, "dd 'de' MMM", { locale: ptBR }),
        revenue: 0,
        cost: 0,
        profit: 0,
        count: 0
      });
      current.setDate(current.getDate() + 1);
    }

    filteredSales.forEach(sale => {
      const k = format(parseISO(sale.sale_date), 'yyyy-MM-dd');
      if (map.has(k)) {
        const d = map.get(k);
        const rev = Math.max(0, Number(sale.total_amount || 0) - Number(sale.discount_amount || 0) - Number(sale.cashback_used || 0));
        const cost = costOfSale(sale);
        const earned = Number(sale.cashback_earned || 0);

        d.revenue += rev;
        d.cost += cost;
        d.profit += (rev - cost - earned);
        d.count += 1;
      }
    });

    return Array.from(map.values());
  }, [filteredSales, dateRange]);

  // Payment Methods Pie Data
  const paymentData = useMemo(() => {
    const counts = filteredSales.reduce((acc, s) => {
      const method = s.payment_method || 'Outros';
      // Split combined methods if needed, simpler to just take the string for now
      const net = Math.max(0, Number(s.total_amount || 0) - Number(s.discount_amount || 0) - Number(s.cashback_used || 0));
      acc[method] = (acc[method] || 0) + net;
      return acc;
    }, {});

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredSales]);

  // Top Lists
  const topProducts = useMemo(() => {
    const map = new Map();
    filteredSales.forEach(s => {
      (s.items || []).forEach(it => {
        const name = it.product_name || it.name || 'Produto';
        const current = map.get(name) || { name, quantity: 0, total: 0 };
        current.quantity += Number(it.quantity || 0);
        current.total += Number(it.total_price || 0);
        map.set(name, current);
      });
    });
    return Array.from(map.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [filteredSales]);

  const topCustomers = useMemo(() => {
    const map = new Map();
    filteredSales.forEach(s => {
      const name = s.customer_name || 'Cliente Avulso';
      const current = map.get(name) || { name, total: 0 };
      const net = Math.max(0, Number(s.total_amount || 0) - Number(s.discount_amount || 0) - Number(s.cashback_used || 0));
      current.total += net;
      map.set(name, current);
    });
    return Array.from(map.values())
      .filter(c => c.name !== 'Cliente Avulso')
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filteredSales]);

  const hourlyData = useMemo(() => {
    // Initialize array for 24 hours
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      sales: 0
    }));

    filteredSales.forEach(s => {
      if (s.sale_date) { // or created_date if sale_date is date-only
        try {
          const d = parseISO(s.sale_date); // Assuming sale_date is ISO with time
          // If sale_date is only YYYY-MM-DD, this won't work well for hours.
          // However, let's assume it carries time or we fallback.
          // If sales come from backend with full timestamp, parseISO handles it.
          const h = d.getHours();
          if (h >= 0 && h < 24) {
            hours[h].sales += 1;
          }
        } catch (e) {
          // ignore invalid dates
        }
      }
    });

    return hours;
  }, [filteredSales]);

  // --- Render Helpers ---

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-sm p-4 border border-slate-100 shadow-xl rounded-xl text-sm min-w-[200px]">
          <p className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-2">
            {payload[0].payload.fullLabel || payload[0].name}
          </p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 mb-1 last:mb-0">
              <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: entry.fill || entry.color }} />
              <span className="text-slate-500 capitalize font-medium flex-1">
                {entry.name === 'revenue' ? 'Faturamento' :
                  entry.name === 'cost' ? 'Custo' :
                    entry.name === 'profit' ? 'Lucro' :
                      entry.name}
              </span>
              <span className="font-bold text-slate-700">
                {entry.name === 'count' || entry.name === 'Quantidade'
                  ? entry.value
                  : `R$ ${Number(entry.value).toFixed(2)}`}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-[#fafbfc] pt-6 pb-20 px-4 md:px-8">
      <div className="max-w-[1600px] mx-auto space-y-8">

        {/* Header Controls */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Relatórios Gerenciais</h1>
              <p className="text-xs text-slate-400 font-medium">Análise detalhada de performance</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <Input
                type="date"
                value={dateRange.from}
                onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                className="h-8 border-none bg-transparent shadow-none w-32 text-xs font-semibold focus-visible:ring-0 text-slate-600"
              />
              <span className="text-slate-300">|</span>
              <Input
                type="date"
                value={dateRange.to}
                onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                className="h-8 border-none bg-transparent shadow-none w-32 text-xs font-semibold focus-visible:ring-0 text-slate-600"
              />
            </div>

            <Select value={filters.payment} onValueChange={v => setFilters(prev => ({ ...prev, payment: v }))}>
              <SelectTrigger className="w-[140px] h-10 rounded-xl border-slate-200 bg-white shadow-sm text-xs font-medium">
                <SelectValue placeholder="Pagamento" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Todas as Formas</SelectItem>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="Cartão de Crédito">Crédito</SelectItem>
                <SelectItem value="Cartão de Débito">Débito</SelectItem>
                <SelectItem value="Dinheiro">Dinheiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Summary Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {[
            {
              label: "Receita Total",
              value: `R$ ${summary.totalRevenue.toFixed(2)}`,
              sub: "Faturamento Bruto",
              icon: DollarSign,
              color: "text-blue-600",
              bg: "bg-blue-50"
            },
            {
              label: "Lucro Líquido",
              value: `R$ ${summary.netProfit.toFixed(2)}`,
              sub: "Receita - Custo - Cashback",
              icon: TrendingUp,
              color: "text-green-600",
              bg: "bg-green-50"
            },
            {
              label: "Vendas Realizadas",
              value: summary.count,
              sub: `Ticket Médio: R$ ${summary.avgTicket.toFixed(2)}`,
              icon: Receipt,
              color: "text-purple-600",
              bg: "bg-purple-50"
            },
            {
              label: "Cashback Gerado",
              value: `R$ ${summary.totalEarned.toFixed(2)}`,
              sub: "Custo de Fidelidade",
              icon: Users,
              color: "text-orange-600",
              bg: "bg-orange-50"
            }
          ].map((item, idx) => (
            <motion.div key={idx} variants={itemVariants}>
              <Card className="hover:scale-[1.02] transition-transform duration-200 cursor-default border-0 shadow-sm hover:shadow-md bg-white rounded-2xl overflow-hidden group">
                <CardContent className="p-5 flex items-start justify-between relative">
                  <div className="z-10 relative">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{item.label}</p>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight group-hover:text-slate-900 transition-colors">{item.value}</h3>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium bg-slate-50 inline-block px-1.5 py-0.5 rounded border border-slate-100">{item.sub}</p>
                  </div>
                  <div className={`p-3 rounded-2xl ${item.bg} ${item.color} group-hover:scale-110 transition-transform duration-300`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Column 1 - Main Content (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">

            {/* Main Chart */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Fluxo Financeiro</h3>
                  <p className="text-sm text-slate-400 font-medium">Receita vs Lucro diário</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="px-3 py-1 bg-blue-50 text-blue-700 border-blue-100 font-semibold cursor-default">Faturamento</Badge>
                  <Badge variant="outline" className="px-3 py-1 bg-green-50 text-green-700 border-green-100 font-semibold cursor-default">Lucro</Badge>
                </div>
              </div>

              <div className="h-[350px] w-full">
                {dailyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="label"
                        stroke="#94a3b8"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={12}
                        minTickGap={30}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={12}
                        tickFormatter={(value) => `R$${value / 1000}k`}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={12}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', opacity: 0.5 }} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name="revenue"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                        animationDuration={1500}
                      />
                      <Area
                        type="monotone"
                        dataKey="profit"
                        name="profit"
                        stroke="#10b981"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        fill="url(#colorProfit)"
                        animationDuration={1500}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400">
                    Sem dados para o período selecionado
                  </div>
                )}
              </div>
            </motion.div>

            {/* Top Customers (Moved here) */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800">Top Clientes</h3>
                <Users className="w-4 h-4 text-slate-300" />
              </div>
              <div className="space-y-4">
                {topCustomers.map((c, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {c.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs font-bold text-slate-700 truncate">{c.name}</span>
                        <span className="text-xs font-bold text-green-600">R$ {c.total.toFixed(0)}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${topCustomers[0]?.total ? (c.total / topCustomers[0].total) * 100 : 0}%` }}
                          transition={{ duration: 1, delay: 0.6 }}
                          className="h-full bg-green-400 rounded-full"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {topCustomers.length === 0 && <p className="text-xs text-slate-400">Sem dados</p>}
              </div>
            </motion.div>
          </div>

          {/* Column 2 - Sidebar (1/3 width) */}
          <div className="space-y-6">

            {/* Payment Methods */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6"
            >
              <h3 className="text-sm font-bold text-slate-800 mb-4">Formas de Pagamento</h3>
              <div className="h-[200px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {paymentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text for Total */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-slate-800">
                    {filteredSales.length}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Vendas</span>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {paymentData.slice(0, 3).map((d, i) => (
                  <div key={i} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-slate-600 font-medium">{d.name || 'Outros'}</span>
                    </div>
                    <span className="text-slate-900 font-bold">{Math.round((d.value / summary.totalRevenue) * 100)}%</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Top Products */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800">Top Produtos</h3>
                <Package className="w-4 h-4 text-slate-300" />
              </div>
              <div className="space-y-4">
                {topProducts.map((p, i) => (
                  <div key={i} className="relative group">
                    <div className="flex justify-between items-end mb-1 text-xs z-10 relative">
                      <span className="font-semibold text-slate-700 truncate max-w-[70%] group-hover:text-blue-600 transition-colors">{p.name}</span>
                      <span className="text-slate-600 font-bold">{p.quantity} un</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${topProducts[0]?.quantity ? (p.quantity / topProducts[0].quantity) * 100 : 0}%` }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className="h-full bg-slate-300 rounded-full group-hover:bg-blue-500 transition-colors"
                      />
                    </div>
                  </div>
                ))}
                {topProducts.length === 0 && <p className="text-xs text-slate-400">Sem dados</p>}
              </div>
            </motion.div>

            {/* Peak Hours */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800">Horários de Pico</h3>
                <Clock className="w-4 h-4 text-slate-300" />
              </div>
              <div className="h-[120px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="hour"
                      fontSize={10}
                      axisLine={false}
                      tickLine={false}
                      tickMargin={5}
                      interval={3}
                    />
                    <YAxis
                      hide
                    />
                    <Tooltip
                      cursor={{ fill: '#f1f5f9' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-slate-800 text-white text-xs px-2 py-1 rounded-md shadow-lg">
                              {payload[0].payload.hour}h: <span className="font-bold">{payload[0].value} vendas</span>
                            </div>
                          )
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="sales"
                      fill="#3b82f6"
                      radius={[4, 4, 4, 4]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

          </div>
        </div>

      </div>
    </div>
  );
}
