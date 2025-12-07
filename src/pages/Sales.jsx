import React, { useState } from "react";
import { Search, Filter, Plus, FileText, Download, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function Sales() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: sales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list('-created_date'),
    initialData: [],
  });
  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Settings.list(),
    initialData: [],
  });
  const queryClient = useQueryClient();
  const updateSaleMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Sale.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries(['sales']); setShowEdit(false); setEditSale(null); }
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

  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceSale, setInvoiceSale] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editSale, setEditSale] = useState(null);
  const [editForm, setEditForm] = useState({ customer_name: '', payment_method: '', total_amount: 0 });
  const [showConfirmDeleteSale, setShowConfirmDeleteSale] = useState(false);
  const [confirmDeleteSaleId, setConfirmDeleteSaleId] = useState(null);

  const handleOpenInvoice = (sale) => { setInvoiceSale(sale); setShowInvoice(true); };
  const handleOpenEdit = (sale) => {
    setEditSale(sale);
    setEditForm({
      customer_name: sale.customer_name || '',
      payment_method: sale.payment_method || '',
      total_amount: Number(sale.total_amount || 0),
    });
    setShowEdit(true);
  };
  const handleSubmitEdit = (e) => {
    e.preventDefault();
    if (!editSale) return;
    updateSaleMutation.mutate({ id: editSale.id, data: editForm });
  };

  const deleteSaleMutation = useMutation({
    mutationFn: (id) => base44.entities.Sale.delete(id),
    onSuccess: () => { queryClient.invalidateQueries(['sales']); setShowConfirmDeleteSale(false); setConfirmDeleteSaleId(null); }
  });

  return (
    <div className="flex flex-col min-h-full">
      <div className="p-4 md:p-8 animate-in fade-in duration-500">
        <div className="max-w-[1200px] mx-auto px-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Vendas</h1>
            <p className="text-gray-500 mt-1">Histórico de movimentações</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap md:flex-nowrap justify-end">
            <Button variant="outline" className="gap-2 border-gray-200 text-gray-700 hover:bg-gray-50">
              <FileText className="w-4 h-4" />
              Relatórios
            </Button>
            <Button className="bg-[#3b9cdb] hover:bg-[#2c8ac2] text-white gap-2 px-5 rounded-xl">
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
        <div className="overflow-x-auto w-full px-3">
          <div className="shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)] bg-white rounded-xl border border-gray-200 min-w-[960px]">
            <div className="hidden lg:grid grid-cols-[minmax(110px,1fr)_minmax(80px,auto)_minmax(220px,2fr)_minmax(150px,auto)_minmax(180px,auto)_auto] gap-3 px-3 sm:px-5 py-2.5 text-[11px] font-normal text-[#707887] tracking-wide border-b border-gray-200">
              <div>DATA</div>
              <div>NÚMERO</div>
              <div>CLIENTE <span className="ml-2 text-[10px] font-normal text-gray-400">VENDEDOR</span></div>
              <div>PAGAMENTO</div>
              <div className="text-right">FATURADO <span className="ml-2 text-[10px] font-normal text-gray-400">CASHBACK</span></div>
              <div className="flex items-center justify-end gap-2"></div>
            </div>
            <div className="divide-y divide-gray-100">
              {filteredSales.map((sale) => (
                <React.Fragment key={sale.id}>
                  <div className="hidden lg:grid grid-cols-[minmax(110px,1fr)_minmax(80px,auto)_minmax(220px,2fr)_minmax(150px,auto)_minmax(180px,auto)_auto] gap-3 items-center px-3 sm:px-5 py-2.5 hover:bg-gray-50/70">
                    <div className="flex items-center">
                      {sale.sale_date ? (
                        <span className="text-sm text-gray-700 font-medium">{format(new Date(sale.sale_date), 'dd/MM HH:mm')}</span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </div>
                    <div className="hidden sm:flex items-center">
                      <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[64px]">
                        {sale.sale_number}
                      </span>
                    </div>
                    <div className="leading-tight min-w-0">
                      <div className="text-[13px] font-semibold text-cyan-700 truncate">{sale.customer_name || 'AVULSO'}</div>
                      <div className="text-[10px] text-gray-400">{sale.vendor_name || 'ADMINISTRADOR'}</div>
                    </div>
                    <div>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold border ${paymentMethodColors[sale.payment_method] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                        {sale.payment_method || '-'}
                      </span>
                    </div>
                    <div className="text-right leading-tight tabular-nums">
                      <div className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">{(sale.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                      <div className="text-[11px] font-semibold text-emerald-600 whitespace-nowrap">{(((sale.total_amount || 0) * Number(settings?.[0]?.cashback_percentage || 0)) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pr-2 shrink-0">
                      <Button variant="secondary" size="icon" className="h-6 w-6 rounded bg-amber-50 text-amber-600 border border-amber-200" onClick={() => handleOpenInvoice(sale)}>
                        <FileText className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="secondary" size="icon" className="h-6 w-6 rounded bg-blue-50 text-blue-600 border border-blue-200" onClick={() => handleOpenEdit(sale)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 rounded-lg" onClick={() => { setConfirmDeleteSaleId(sale.id); setShowConfirmDeleteSale(true); }}>
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
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
                    <div className="text-[12px] font-semibold text-emerald-600">{(((sale.total_amount || 0) * Number(settings?.[0]?.cashback_percentage || 0)) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <Button variant="secondary" size="icon" className="h-7 w-7 rounded bg-amber-50 text-amber-600 border border-amber-200" onClick={() => handleOpenInvoice(sale)}>
                      <FileText className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-7 w-7 rounded bg-blue-50 text-blue-600 border border-blue-200" onClick={() => handleOpenEdit(sale)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => { setConfirmDeleteSaleId(sale.id); setShowConfirmDeleteSale(true); }}>
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
        {/* Dialog: Nota Fiscal */}
        <Dialog open={showInvoice} onOpenChange={setShowInvoice}>
          <DialogContent className="sm:max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle>Nota Fiscal</DialogTitle>
            </DialogHeader>
            {invoiceSale && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Número</p>
                    <p className="text-sm font-semibold text-gray-900">{invoiceSale.sale_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Data</p>
                    <p className="text-sm text-gray-800">{invoiceSale.sale_date ? format(new Date(invoiceSale.sale_date), 'dd/MM/yyyy HH:mm') : '-'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Cliente</p>
                  <p className="text-sm font-semibold text-gray-900">{invoiceSale.customer_name || 'AVULSO'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Pagamento</p>
                    <p className="text-sm text-gray-800">{invoiceSale.payment_method || '-'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Faturado</p>
                    <p className="text-sm font-semibold text-gray-900">{(invoiceSale.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Cashback (%)</p>
                    <p className="text-sm text-gray-800">{Number(settings?.[0]?.cashback_percentage || 0).toLocaleString('pt-BR')}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Cashback ganho</p>
                    <p className="text-sm font-semibold text-emerald-600">{(((invoiceSale.total_amount || 0) * Number(settings?.[0]?.cashback_percentage || 0)) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <div className="pt-3 flex flex-wrap gap-2 justify-end">
                  <Button variant="outline" className="rounded-xl" onClick={() => window.print()}>Imprimir</Button>
                  <Button variant="outline" className="rounded-xl">Baixar PDF</Button>
                  <Button variant="outline" className="rounded-xl">Enviar por e-mail</Button>
                  <Button className="rounded-xl" onClick={() => setShowInvoice(false)}>Fechar</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog: Editar Venda */}
        <Dialog open={showEdit} onOpenChange={setShowEdit}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Editar Venda</DialogTitle>
            </DialogHeader>
            {editSale && (
              <form className="space-y-3" onSubmit={handleSubmitEdit}>
                <div>
                  <p className="text-xs text-gray-500">Cliente</p>
                  <input className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" value={editForm.customer_name} onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Pagamento</p>
                  <input className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" value={editForm.payment_method} onChange={(e) => setEditForm({ ...editForm, payment_method: e.target.value })} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Faturado</p>
                  <input type="number" step="0.01" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" value={editForm.total_amount} onChange={(e) => setEditForm({ ...editForm, total_amount: Number(e.target.value) })} />
                </div>
                <div className="pt-2 flex gap-2 justify-end">
                  <Button variant="outline" className="rounded-xl" type="button" onClick={() => { setShowEdit(false); setEditSale(null); }}>Cancelar</Button>
                  <Button className="rounded-xl" type="submit">Salvar</Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={showConfirmDeleteSale}
          onOpenChange={setShowConfirmDeleteSale}
          title="Excluir venda"
          description="Tem certeza que deseja excluir esta venda?"
          confirmText="Excluir"
          cancelText="Cancelar"
          destructive
          onConfirm={() => { if (confirmDeleteSaleId != null) deleteSaleMutation.mutate(confirmDeleteSaleId) }}
        />
      </div>
    </div>
  );
}
