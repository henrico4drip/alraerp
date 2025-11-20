import React, { useState } from "react";
import { Search, Filter, Plus, FileText, Download, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

export default function Sales() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: sales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list('-created_date'),
    initialData: [],
  });
  const paymentMethodColors = {
    "Dinheiro": "bg-green-100 text-green-800 border-green-200",
    "Cartão de Débito": "bg-blue-100 text-blue-800 border-blue-200",
    "Cartão de Crédito": "bg-indigo-100 text-indigo-800 border-indigo-200",
    "PIX": "bg-cyan-100 text-cyan-800 border-cyan-200",
    "Cashback": "bg-pink-100 text-pink-800 border-pink-200",
  };
  const filteredSales = (sales || []).filter((s) => {
    const q = (searchTerm || '').trim().toLowerCase();
    if (!q) return true;
    const text = `${s?.sale_number ?? ''} ${s?.customer_name ?? ''}`.toLowerCase();
    return text.includes(q);
  });

  return (
    <div className="flex flex-col min-h-full">
      <div className="p-4 md:p-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Vendas</h1>
            <p className="text-gray-500 mt-1">Histórico de movimentações</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2 border-gray-200 text-gray-700 hover:bg-gray-50">
              <FileText className="w-4 h-4" />
              Relatórios
            </Button>
            <Button className="bg-[#3b9cdb] hover:bg-[#2c8ac2] text-white gap-2 px-6 rounded-xl">
              <Plus className="w-4 h-4" />
              Nova Venda
            </Button>
          </div>
        </div>
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar por cliente, número ou valor"
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-blue-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Histório de vendas</h2>
        <div className="shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)] bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="hidden lg:grid grid-cols-[160px_180px_1fr_220px_260px_160px] gap-6 px-6 sm:px-8 py-3 text-[11px] font-normal text-[#707887] tracking-wide border-b border-gray-200">
            <div>DATA</div>
            <div>NÚMERO</div>
            <div>CLIENTE <span className="ml-2 text-[10px] font-normal text-gray-400">VENDEDOR</span></div>
            <div>PAGAMENTO</div>
            <div className="text-right">FATURADO <span className="ml-2 text-[10px] font-normal text-gray-400">LUCRO BRUTO</span></div>
            <div className="flex items-center justify-end gap-2"></div>
          </div>
          <div className="divide-y divide-gray-100">
            {filteredSales.map((sale) => (
              <React.Fragment key={sale.id}>
                <div className="hidden lg:grid grid-cols-[160px_120px_1fr_220px_260px_160px] gap-6 items-center px-6 sm:px-8 py-3 hover:bg-gray-50/70">
                  <div className="flex items-center">
                    {sale.sale_date ? (
                      <span className="text-sm text-gray-700 font-medium">{format(new Date(sale.sale_date), 'dd/MM HH:mm')}</span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </div>
                  <div className="hidden sm:flex items-center">
                    <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[11px] font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px]">
                      {sale.sale_number}
                    </span>
                  </div>
                  <div className="leading-tight">
                    <div className="text-sm font-semibold text-cyan-700 truncate">{sale.customer_name || 'AVULSO'}</div>
                    <div className="text-[10px] text-gray-400">{sale.vendor_name || 'ADMINISTRADOR'}</div>
                  </div>
                  <div>
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${paymentMethodColors[sale.payment_method] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                      {sale.payment_method || '-'}
                    </span>
                  </div>
                  <div className="text-right leading-tight tabular-nums">
                    <div className="text-[12px] font-semibold text-gray-600">{(sale.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div className="text-[12px] font-semibold text-emerald-600">{(sale.gross_profit || sale.profit || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="secondary" size="icon" className="h-7 w-7 rounded bg-amber-50 text-amber-600 border border-amber-200">
                      <FileText className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-7 w-7 rounded bg-blue-50 text-blue-600 border border-blue-200">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
                <div className="lg:hidden px-3 py-2 hover:bg-gray-50/70">
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] text-gray-700 font-medium">{sale.sale_date ? format(new Date(sale.sale_date), 'dd/MM HH:mm') : '-'}</div>
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-mono">{sale.sale_number}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-cyan-700 truncate">{sale.customer_name || 'AVULSO'}</div>
                      <div className="text-[10px] text-gray-400 truncate">{sale.vendor_name || 'ADMINISTRADOR'}</div>
                    </div>
                    <span className={`ml-2 inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${paymentMethodColors[sale.payment_method] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>{sale.payment_method || '-'}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="text-[12px] font-semibold text-gray-600">{(sale.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div className="text-[12px] font-semibold text-emerald-600">{(sale.gross_profit || sale.profit || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <Button variant="secondary" size="icon" className="h-7 w-7 rounded bg-amber-50 text-amber-600 border border-amber-200">
                      <FileText className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-7 w-7 rounded bg-blue-50 text-blue-600 border border-blue-200">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
