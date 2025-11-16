import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, Calendar, DollarSign, Receipt, TrendingUp, Users } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";

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

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [payment, setPayment] = useState("");
  const [search, setSearch] = useState("");
  const [chartType, setChartType] = useState('bar'); // 'bar' | 'line'

  const productCostMap = useMemo(() => {
    const map = new Map();
    products.forEach(p => map.set(p.id, Number(p.cost || 0)));
    return map;
  }, [products]);

  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      const d = sale.sale_date ? new Date(sale.sale_date) : null;
      const afterFrom = fromDate ? (d && d >= new Date(fromDate)) : true;
      const beforeTo = toDate ? (d && d <= new Date(toDate + 'T23:59:59')) : true;
      const paymentOk = payment ? sale.payment_method === payment : true;
      const searchOk = search ? (
        (sale.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (sale.sale_number || '').toLowerCase().includes(search.toLowerCase())
      ) : true;
      return afterFrom && beforeTo && paymentOk && searchOk;
    });
  }, [sales, fromDate, toDate, payment, search]);

  const costOfSale = (sale) => {
    return (sale.items || []).reduce((sum, item) => {
      const cost = productCostMap.get(item.product_id) || 0;
      return sum + cost * (item.quantity || 0);
    }, 0);
  };

  const last7Days = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = startOfDay(subDays(new Date(), i));
      const key = format(date, 'yyyy-MM-dd');
      days.push({ key, label: format(date, 'dd/MM') });
    }
    return days;
  }, []);

  const timeSeries7 = useMemo(() => {
    const byDay = last7Days.map(d => ({ key: d.key, label: d.label, revenue: 0, cost: 0 }));
    const indexByKey = Object.fromEntries(byDay.map((d, i) => [d.key, i]));
    filteredSales.forEach(sale => {
      if (!sale.sale_date) return;
      const k = format(startOfDay(new Date(sale.sale_date)), 'yyyy-MM-dd');
      const idx = indexByKey[k];
      if (idx === undefined) return;
      byDay[idx].revenue += Number(sale.total_amount || 0);
      byDay[idx].cost += Number(costOfSale(sale) || 0);
    });
    return byDay;
  }, [filteredSales, last7Days]);

  const summary = useMemo(() => {
    const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalCost = filteredSales.reduce((sum, s) => sum + costOfSale(s), 0);
    const totalEarned = filteredSales.reduce((sum, s) => sum + (s.cashback_earned || 0), 0);
    const count = filteredSales.length;
    const avgTicket = count ? totalRevenue / count : 0;
    const byPayment = filteredSales.reduce((acc, s) => {
      const key = s.payment_method || 'Indefinido';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return { totalRevenue, totalCost, totalEarned, count, avgTicket, byPayment };
  }, [filteredSales]);

  const topCustomers = useMemo(() => {
    const map = new Map();
    filteredSales.forEach(s => {
      const key = s.customer_name || 'Avulso';
      map.set(key, (map.get(key) || 0) + (s.total_amount || 0));
    });
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filteredSales]);

  // Produtos mais vendidos (por quantidade)
  const topProducts = useMemo(() => {
    const map = new Map();
    filteredSales.forEach(s => {
      (s.items || []).forEach(it => {
        const key = it.product_id || it.name || it.product_name || 'Produto';
        const name = it.product_name || it.name || String(key);
        const qty = Number(it.quantity || 0);
        const revenue = Number((it.total_price != null ? it.total_price : (it.unit_price || 0) * qty) || 0);
        const prev = map.get(key) || { name, qty: 0, revenue: 0 };
        map.set(key, { name, qty: prev.qty + qty, revenue: prev.revenue + revenue });
      });
    });
    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [filteredSales]);

  const paymentMethods = [
    "",
    "Dinheiro",
    "Cartão de Débito",
    "Cartão de Crédito",
    "PIX",
    "Cashback",
  ];

  const maxValue = Math.max(
    1,
    ...timeSeries7.map(d => Math.max(d.revenue, d.cost))
  );

  const asPolyline = (key) => {
    const w = 560; // approx, will stretch via viewBox
    const h = 160;
    const step = w / (timeSeries7.length - 1 || 1);
    const points = timeSeries7.map((d, i) => {
      const v = d[key] / maxValue;
      const x = i * step;
      const y = h - v * h;
      return `${x},${y}`;
    }).join(' ');
    return { w, h, points };
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top row cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)] rounded-2xl bg-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">Receita Total</div>
                <div className="text-2xl font-bold text-blue-700">R$ {summary.totalRevenue.toFixed(2)}</div>
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </CardContent>
          </Card>
          <Card className="border-0 shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)] rounded-2xl bg-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">Total Vendas</div>
                <div className="text-2xl font-bold text-blue-700">{summary.count}</div>
              </div>
              <Receipt className="w-8 h-8 text-blue-600" />
            </CardContent>
          </Card>
          <Card className="border-0 shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)] rounded-2xl bg-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">Ticket Médio</div>
                <div className="text-2xl font-bold text-blue-700">R$ {summary.avgTicket.toFixed(2)}</div>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </CardContent>
          </Card>
          <Card className="border-0 shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)] rounded-2xl bg-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">Cashback Dado</div>
                <div className="text-2xl font-bold text-blue-700">R$ {summary.totalEarned.toFixed(2)}</div>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-600" />
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)] rounded-2xl bg-white">
          <CardContent className="p-4 grid md:grid-cols-5 gap-3">
            <div>
              <Label className="text-sm text-gray-700">De</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-xl border-gray-200" />
            </div>
            <div>
              <Label className="text-sm text-gray-700">Até</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-xl border-gray-200" />
            </div>
            <div>
              <Label className="text-sm text-gray-700">Pagamento</Label>
              <Select value={payment} onValueChange={(v) => setPayment(v)}>
                <SelectTrigger className="rounded-xl border-gray-200">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {paymentMethods.map((m) => (
                    <SelectItem key={m || 'todos'} value={m}>{m || 'Todos'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-sm text-gray-700">Busca</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cliente ou Nº da venda" className="rounded-xl border-gray-200" />
            </div>
          </CardContent>
        </Card>

        {/* Charts row */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Sales last 7 days with revenue vs cost */}
          <Card className="shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)] border-0 rounded-2xl bg-white">
            <CardHeader className="bg-gray-50 border-b border-gray-100 rounded-t-2xl p-4 flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-gray-900 text-base">
                <Receipt className="w-5 h-5 text-blue-600" /> Vendas nos Últimos 7 Dias
              </CardTitle>
              <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setChartType(t => t === 'bar' ? 'line' : 'bar')}>
                {chartType === 'bar' ? 'Gráfico de Linhas' : 'Gráfico de Barras'}
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              {chartType === 'bar' ? (
                <div className="h-44 flex items-end gap-3">
                  {timeSeries7.map((d, i) => {
                    const revH = Math.max(4, Math.round((d.revenue / maxValue) * 160));
                    const costH = Math.max(4, Math.round((d.cost / maxValue) * 160));
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center">
                        <div className="w-full flex items-end gap-1 h-40">
                          <div className="flex-1 bg-blue-500/80 rounded-t" style={{ height: revH }} title={`Faturamento R$ ${d.revenue.toFixed(2)}`}></div>
                          <div className="flex-1 bg-blue-300 rounded-t" style={{ height: costH }} title={`Custo R$ ${d.cost.toFixed(2)}`}></div>
                        </div>
                        <div className="text-xs text-gray-600 mt-1">{d.label}</div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="h-44">
                  {(() => {
                    const rev = asPolyline('revenue');
                    const cst = asPolyline('cost');
                    return (
                      <svg viewBox={`0 0 ${rev.w} ${rev.h}`} className="w-full h-40">
                        <polyline fill="none" stroke="#3b82f6" strokeWidth="3" points={rev.points} />
                        <polyline fill="none" stroke="#93c5fd" strokeWidth="3" points={cst.points} />
                      </svg>
                    );
                  })()}
                  <div className="flex justify-between text-xs text-gray-600">
                    {timeSeries7.map((d) => (<div key={d.key}>{d.label}</div>))}
                  </div>
                </div>
              )}
              <div className="text-xs text-gray-600 mt-2">Custo no período: <span className="font-medium">R$ {timeSeries7.reduce((s, d) => s + d.cost, 0).toFixed(2)}</span></div>
            </CardContent>
          </Card>

          {/* By payment method + cost footer */}
          <Card className="shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)] border-0 rounded-2xl bg-white">
            <CardHeader className="bg-gray-50 border-b border-gray-100 rounded-t-2xl p-4">
              <CardTitle className="flex items-center gap-2 text-gray-900 text-base">
                <TrendingUp className="w-5 h-5 text-blue-600" /> Produtos mais vendidos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {topProducts.length === 0 && (
                <div className="text-sm text-gray-600">Sem dados no período.</div>
              )}
              <div className="space-y-3">
                {topProducts.map((p) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold">
                      {p.name.substring(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-800 font-medium">{p.name}</span>
                        <span className="text-blue-700 font-semibold">{p.qty} un • R$ {p.revenue.toFixed(2)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded mt-1">
                        <div className="h-2 bg-blue-500 rounded" style={{ width: `${Math.min(100, (p.qty / (topProducts[0]?.qty || 1)) * 100)}%` }}></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-600 mt-2">Custo total (todas as vendas filtradas): <span className="font-medium">R$ {summary.totalCost.toFixed(2)}</span></div>
            </CardContent>
          </Card>
        </div>

        {/* Top 5 clientes */}
        <Card className="shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)] border-0 rounded-2xl bg-white">
          <CardHeader className="bg-gray-50 border-b border-gray-100 rounded-t-2xl p-4">
            <CardTitle className="flex items-center gap-2 text-gray-900 text-base">
              <Users className="w-5 h-5 text-blue-600" /> Top 5 Clientes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {topCustomers.length === 0 && (
              <div className="text-sm text-gray-600">Sem dados no período.</div>
            )}
            <div className="space-y-3">
              {topCustomers.map((c) => (
                <div key={c.name} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold">
                    {c.name.substring(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-800 font-medium">{c.name}</span>
                      <span className="text-blue-700 font-semibold">R$ {c.total.toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded mt-1">
                      <div className="h-2 bg-blue-500 rounded" style={{ width: `${Math.min(100, (c.total / (topCustomers[0]?.total || 1)) * 100)}%` }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Table of filtered sales */}
        <Card className="shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)] border-0 rounded-2xl bg-white">
          <CardHeader className="bg-gray-50 border-b border-gray-100 rounded-t-2xl">
            <CardTitle className="flex items-center gap-2 text-gray-900 text-base">
              <Calendar className="w-5 h-5 text-blue-600" /> Vendas filtradas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="text-left text-xs text-[#707887]">
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Pagamento</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Cashback +/-</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="border-t">
                      <td className="px-4 py-3 text-sm text-gray-700">{sale.sale_date ? format(new Date(sale.sale_date), "dd/MM HH:mm") : '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{sale.customer_name || 'Avulso'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{sale.payment_method}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">R$ {(sale.total_amount || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className="text-blue-700">+ R$ {(sale.cashback_earned || 0).toFixed(2)}</span>
                        {sale.cashback_used > 0 && (
                          <span className="ml-2 text-blue-500">- R$ {sale.cashback_used.toFixed(2)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredSales.length === 0 && (
                    <tr><td className="px-4 py-6 text-center text-sm text-gray-600" colSpan={5}>Nenhuma venda encontrada com os filtros.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}