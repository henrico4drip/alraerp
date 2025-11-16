import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Receipt, Calendar, User, BarChart3, Search, RefreshCcw, Undo2, Download, Eye, FileText, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function Sales() {
  const { data: sales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list('-created_date'),
    initialData: [],
  });

  // Estados e mutations para exclusão de venda e ajuste de cliente
  const [showConfirmDeleteSale, setShowConfirmDeleteSale] = useState(false);
  const [confirmDeleteSaleId, setConfirmDeleteSaleId] = useState(null);
  const [confirmDeleteSaleData, setConfirmDeleteSaleData] = useState(null);
  const queryClient = useQueryClient();
  const deleteSaleMutation = useMutation({
    mutationFn: (id) => base44.entities.Sale.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['sales']);
    },
    onError: (err) => {
      console.error('Erro ao excluir venda:', err);
      alert(err?.message || 'Falha ao excluir venda');
    }
  });
  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['customers']);
    },
    onError: (err) => {
      console.error('Erro ao ajustar cliente após exclusão de venda:', err);
    }
  });
  const paymentMethodColors = {
    "Dinheiro": "bg-green-100 text-green-800",
    "Cartão de Débito": "bg-blue-100 text-blue-800",
    "Cartão de Crédito": "bg-indigo-100 text-indigo-800",
    "PIX": "bg-cyan-100 text-cyan-800",
    "Cashback": "bg-pink-100 text-pink-800",
  };

  // Estado da barra superior
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("recentes"); // recentes | em_aberto | canceladas
  const [year, setYear] = useState("-");
  const [month, setMonth] = useState("-");
  const [compactView, setCompactView] = useState(false);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return ["-", current, current - 1, current - 2, current - 3, current - 4];
  }, []);

  const months = [
    { value: "-", label: "- MÊS -" },
    { value: 1, label: "JAN" },
    { value: 2, label: "FEV" },
    { value: 3, label: "MAR" },
    { value: 4, label: "ABR" },
    { value: 5, label: "MAI" },
    { value: 6, label: "JUN" },
    { value: 7, label: "JUL" },
    { value: 8, label: "AGO" },
    { value: 9, label: "SET" },
    { value: 10, label: "OUT" },
    { value: 11, label: "NOV" },
    { value: 12, label: "DEZ" },
  ];

  function isCancelled(sale) {
    return sale?.status?.toLowerCase?.() === 'cancelada' || sale?.cancelled === true || sale?.is_canceled === true;
  }

  const filteredSales = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sales.filter((s) => {
      // Filtro por busca
      const text = `${s?.sale_number ?? ''} ${s?.customer_name ?? ''}`.toLowerCase();
      if (q && !text.includes(q)) return false;

      // Filtro por aba
      if (activeTab === 'canceladas' && !isCancelled(s)) return false;
      if (activeTab === 'em_aberto' && isCancelled(s)) return false;

      // Filtros de ano e mês (se houver data)
      if (year !== '-' || month !== '-') {
        const d = s?.sale_date ? new Date(s.sale_date) : null;
        if (!d) return false;
        if (year !== '-' && d.getFullYear() !== Number(year)) return false;
        if (month !== '-' && d.getMonth() + 1 !== Number(month)) return false;
      }
      return true;
    });
  }, [sales, query, activeTab, year, month]);

  function formatDateParts(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d)) return null;
    const day = format(d, 'dd');
    const time = format(d, 'HH:mm');
    const year = format(d, 'yyyy');
    const monthIndex = d.getMonth();
    const months = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
    return { day, month: months[monthIndex], year, time };
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-0 md:p-0">
      <div className="max-w-[1400px] mx-auto">
        {/* Barra superior */}
        <div className="sticky top-[48px] z-10 bg-white border-b border-gray-200">
          {/* Linha 1: busca + ações simples + exportar */}
          <div className="px-3 sm:px-4 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="BUSCA"
                  className="pl-8 h-8 rounded-md text-xs w-[180px] sm:w-64 bg-gray-50 border-gray-200"
                />
              </div>

              {/* Mantidos apenas: Troca e Devolução */}
              <button className="h-8 px-3 rounded bg-gray-100 text-gray-700 text-xs font-medium inline-flex items-center gap-2 border border-gray-200">
                <RefreshCcw className="w-4 h-4" /> TROCA
              </button>
              <button className="h-8 px-3 rounded bg-gray-100 text-gray-700 text-xs font-medium inline-flex items-center gap-2 border border-gray-200">
                <Undo2 className="w-4 h-4" /> DEVOLUÇÃO
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button className="h-8 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-2">
                <Download className="w-4 h-4" /> EXPORTAR
              </Button>
            </div>
          </div>

          {/* Linha 2: abas + filtros */}
          <div className="px-3 sm:px-4 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {[
                { key: 'recentes', label: 'RECENTES' },
                { key: 'em_aberto', label: 'EM ABERTO' },
                { key: 'canceladas', label: 'CANCELADAS' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`h-7 px-3 rounded text-xs font-semibold border transition-colors ${
                    activeTab === t.key
                      ? 'bg-white border-gray-300 text-gray-800 shadow-sm'
                      : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="h-8 rounded border border-gray-200 bg-white text-xs text-gray-700 px-2"
              >
                <option value="-">- ANO -</option>
                {years.filter(y => y !== "-").map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="h-8 rounded border border-gray-200 bg-white text-xs text-gray-700 px-2"
              >
                {months.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>

              {activeTab === 'canceladas' && (
                <span className="h-8 inline-flex items-center px-3 rounded bg-red-50 text-red-600 text-xs font-semibold border border-red-200">
                  CANCELADAS
                </span>
              )}

              <button
                onClick={() => setCompactView(v => !v)}
                className={`h-8 w-8 inline-flex items-center justify-center rounded border ${compactView ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-200'}`}
                title="Alternar visualização"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Conteúdo principal */}
        <div className="p-4 md:p-8">
          <div className="mb-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Histórico de Vendas</h1>
              <p className="text-gray-500 mt-1">Todas as transações realizadas</p>
            </div>
            <Link to={createPageUrl("Reports")}>
              <Button className="bg-blue-600 hover:bg-blue-700 rounded-xl">
                <BarChart3 className="w-4 h-4 mr-2" />
                Relatórios
              </Button>
            </Link>
          </div>

          {/* Tabela estilo da imagem */}
          <div className="shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)] bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Cabeçalho da tabela */}
            <div className="grid grid-cols-[160px_180px_1fr_220px_260px_160px] gap-6 px-6 sm:px-8 py-3 text-[11px] font-normal text-[#707887] tracking-wide border-b border-gray-200">
              <div>DATA</div>
              <div>NÚMERO</div>
              <div>CLIENTE <span className="ml-2 text-[10px] font-normal text-gray-400">VENDEDOR</span></div>
              <div>PAGAMENTO</div>
              <div className="text-right">FATURADO <span className="ml-2 text-[10px] font-normal text-gray-400">LUCRO BRUTO</span></div>
              <div className="flex items-center justify-end gap-2">
                {activeTab === 'canceladas' && (
                  <span className="px-3 py-1 rounded bg-red-50 text-red-600 text-[11px] font-semibold border border-red-200">CANCELADAS</span>
                )}
              </div>
            </div>

            {/* Linhas */}
            <div className="divide-y divide-gray-100">
              {filteredSales.map((sale) => {
                const parts = formatDateParts(sale.sale_date);
                return (
                  <div key={sale.id} className="grid grid-cols-[160px_120px_1fr_220px_260px_160px] gap-6 items-center px-6 sm:px-8 py-3 hover:bg-gray-50/70">
                    {/* DATA */}
                    <div className="flex items-center">
                      {sale.sale_date ? (
                        <span className="text-sm text-gray-700 font-medium">{format(new Date(sale.sale_date), 'dd/MM HH:mm')}</span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </div>

                    {/* NÚMERO */}
                    <div className="hidden sm:flex items-center">
                      <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[11px] font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px]">
                        {sale.sale_number}
                      </span>
                    </div>

                    {/* CLIENTE / VENDEDOR */}
                    <div className="leading-tight">
                      <div className="text-sm font-semibold text-cyan-700 truncate">{sale.customer_name || 'AVULSO'}</div>
                      <div className="text-[10px] text-gray-400">{sale.vendor_name || 'ADMINISTRADOR'}</div>
                    </div>

                    {/* PAGAMENTO */}
                    <div>
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${paymentMethodColors[sale.payment_method] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                        {sale.payment_method || '-'}
                      </span>
                    </div>

                    {/* FATURADO / LUCRO BRUTO */}
                    <div className="text-right leading-tight tabular-nums">
                      <div className="text-[12px] font-semibold text-gray-600">{(sale.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                      <div className="text-[12px] font-semibold text-emerald-600">{(sale.gross_profit || sale.profit || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </div>

                    {/* AÇÕES */}
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="secondary" size="icon" className="h-7 w-7 rounded bg-amber-50 text-amber-600 border border-amber-200">
                        <FileText className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="secondary" size="icon" className="h-7 w-7 rounded bg-blue-50 text-blue-600 border border-blue-200">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => { setConfirmDeleteSaleId(sale.id); setConfirmDeleteSaleData({ id: sale.id, customer_id: sale.customer_id, total_amount: sale.total_amount }); setShowConfirmDeleteSale(true); }}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {filteredSales.length === 0 && (
                <div className="p-12">
                  <Card className="shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)] border-0 rounded-2xl bg-white">
                    <CardContent className="p-12 text-center">
                      <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">Nenhuma venda encontrada</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirmDeleteSale}
        onOpenChange={setShowConfirmDeleteSale}
        title="Excluir venda"
        description="Tem certeza que deseja excluir esta venda? Isso removerá do faturamento."
        confirmText="Excluir"
        cancelText="Cancelar"
        destructive
        onConfirm={() => {
          const s = confirmDeleteSaleData;
          if (s?.id != null) {
            deleteSaleMutation.mutate(s.id, {
              onSuccess: () => {
                // Se houver cliente, ajustar métricas de faturamento do cliente
                if (s.customer_id) {
                  const customers = queryClient.getQueryData(['customers']) || [];
                  const cust = customers.find((c) => c.id === s.customer_id);
                  if (cust) {
                    const newTotalSpent = Math.max(0, Number(cust.total_spent || 0) - Number(s.total_amount || 0));
                    const newTotalPurchases = Math.max(0, (cust.total_purchases || 0) - 1);
                    updateCustomerMutation.mutate({ id: s.customer_id, data: { total_spent: newTotalSpent, total_purchases: newTotalPurchases } });
                  } else {
                    // Sem cliente em cache: apenas invalidar para refletir no próximo carregamento
                    queryClient.invalidateQueries(['customers']);
                  }
                }
              }
            });
          }
        }}
      />

    </div>
  );
}