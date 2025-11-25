import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Plus, Edit, Trash2, Wallet, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import CustomerDialog from "@/components/CustomerDialog";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function Customers() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    cpf: "",
  });

  // Estado para visualizar cliente
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewCustomer, setViewCustomer] = useState(null);
  const [search, setSearch] = useState("");
  // Ordenação por vencimento de cashback
  const [sortMode, setSortMode] = useState('default');
  // Diálogo de cashback
  const [showCashbackDialog, setShowCashbackDialog] = useState(false);
  const [cashbackCustomer, setCashbackCustomer] = useState(null);
  const [showConfirmDeleteCustomer, setShowConfirmDeleteCustomer] = useState(false);
  const [confirmDeleteCustomerId, setConfirmDeleteCustomerId] = useState(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_date'),
    initialData: [],
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Customer.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['customers']);
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['customers']);
      handleCloseDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Customer.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['customers']);
    },
  });

  const handleOpenDialog = (customer = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name || "",
        phone: customer.phone || "",
        email: customer.email || "",
        cpf: customer.cpf || "",
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        name: "",
        phone: "",
        email: "",
        cpf: "",
      });
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingCustomer(null);
    setFormData({ name: "", phone: "", email: "", cpf: "" });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredCustomers = customers.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.cpf || '').includes(search)
  );

  const sortedCustomers = React.useMemo(() => {
    const arr = [...filteredCustomers];
    if (sortMode === 'cashback_expiry') {
      arr.sort((a, b) => {
        const da = a.cashback_expires_at ? new Date(a.cashback_expires_at).getTime() : Infinity;
        const db = b.cashback_expires_at ? new Date(b.cashback_expires_at).getTime() : Infinity;
        return da - db;
      });
    }
    return arr;
  }, [filteredCustomers, sortMode]);

  // Abrir diálogo de visualização
  const handleOpenView = (customer) => {
    setViewCustomer(customer);
    setShowViewDialog(true);
  };

  // Botão de detalhes de cashback
  const handleOpenCashback = (customer) => {
    setCashbackCustomer(customer);
    setShowCashbackDialog(true);
  };

  const downloadTemplateCSV = () => {
    const headers = ['name','phone','email','cpf']
    const content = headers.join(',') + '\n'
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'clientes_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }
  const exportCSV = () => {
    const headers = ['name','phone','email','cpf']
    const rows = customers.map(c => [c.name||'', c.phone||'', c.email||'', c.cpf||''])
    const content = [headers, ...rows].map(r => r.map(v => String(v).replace(/"/g,'""')).join(',')).join('\n')
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'clientes_export.csv'
    a.click()
    URL.revokeObjectURL(url)
  }
  const importCSV = async (file) => {
    if (!file) return
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter(Boolean)
    if (lines.length === 0) return
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const idx = (name) => headers.indexOf(name)
    for (let i=1;i<lines.length;i++) {
      const cols = lines[i].split(',')
      const payload = {
        name: cols[idx('name')] || '',
        phone: cols[idx('phone')] || '',
        email: cols[idx('email')] || '',
        cpf: cols[idx('cpf')] || '',
      }
      if (payload.name) {
        try { await createMutation.mutateAsync(payload) } catch {}
      }
    }
    setShowImportDialog(false)
  }

  return (
    <div className="min-h-screen max-w-[100vw] bg-gradient-to-b from-gray-50 to-gray-100 p-4 md:p-8 overflow-x-hidden">
      <div className="mx-auto max-w-full sm:max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
            <p className="text-gray-500 mt-1">Gerencie seu programa de cashback</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowImportDialog(true)} className="rounded-xl bg-indigo-600 hover:bg-indigo-700">Importar</Button>
            <Button onClick={() => setShowExportDialog(true)} className="rounded-xl bg-slate-600 hover:bg-slate-700">Exportar</Button>
            <Button
              onClick={() => handleOpenDialog()}
              className="bg-pink-600 hover:bg-pink-700 rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Cliente
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, telefone, email ou CPF"
            className="rounded-xl border-gray-300"
          />
        </div>
        <div className="mb-4">
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value)} className="w-full sm:w-auto rounded-xl border-gray-300 p-2 text-sm">
            <option value="default">Ordenação padrão</option>
            <option value="cashback_expiry">Vencimento de cashback (mais próximo primeiro)</option>
          </select>
        </div>

        <div className="w-full shadow-[12px_0_24px_-12px_rgba(0,0,0,0.25),_-12px_0_24px_-12px_rgba(0,0,0,0.25)] bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="hidden lg:grid grid-cols-[1.5fr_1.5fr_140px_120px_100px_140px] gap-6 px-3 sm:px-8 py-3 text-[11px] font-normal text-[#707887] tracking-wide border-b border-gray-200">
            <div>CLIENTE</div>
            <div>CONTATO</div>
            <div className="text-right">CASHBACK</div>
            <div className="text-right">GASTO</div>
            <div className="text-right">COMPRAS</div>
            <div className="flex items-center justify-end">AÇÕES</div>
          </div>
          <div className="divide-y divide-gray-100">
            {sortedCustomers.map((customer) => (
              <React.Fragment key={customer.id}>
                {/* Desktop row */}
                <div className="hidden lg:grid grid-cols-[1.5fr_1.5fr_140px_120px_100px_140px] gap-6 items-center px-3 sm:px-8 py-3 hover:bg-gray-50/70">
                  <div className="flex items-center gap-2 min-w-0">
                    <Users className="w-5 h-5 text-pink-600" />
                    <p className="font-medium text-sm text-gray-900 truncate">{customer.name}</p>
                  </div>
                  <div className="leading-tight min-w-0">
                    <p className="text-xs text-gray-500 truncate">
                      {(customer.phone || '-')}{customer.email ? ` • ${customer.email}` : ''}{customer.cpf ? ` • CPF ${customer.cpf}` : ''}
                    </p>
                  </div>
                  <div className="text-right tabular-nums">
                    <Badge variant="primary" className="rounded-lg">
                      <Wallet className="w-3 h-3 mr-1" />
                      <span className="tabular-nums">R$ {(customer.cashback_balance || 0).toFixed(2)}</span>
                    </Badge>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className="font-semibold text-green-600 text-sm">R$ {(customer.total_spent || 0).toFixed(2)}</p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className="font-semibold text-indigo-600 text-sm">{customer.total_purchases || 0}</p>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => handleOpenView(customer)} title="Ver cliente">
                      <Eye className="w-4 h-4 text-sky-600" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200" onClick={() => handleOpenCashback(customer)} title="Cashback">
                      <Wallet className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => handleOpenDialog(customer)} title="Editar cliente">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => { setConfirmDeleteCustomerId(customer.id); setShowConfirmDeleteCustomer(true); }} title="Excluir cliente">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
                {/* Mobile card */}
                <div className="lg:hidden px-3 py-2 hover:bg-gray-50/70">
                  <div className="flex items-center gap-2 min-w-0">
                    <Users className="w-5 h-5 text-pink-600" />
                    <p className="font-medium text-sm text-gray-900 truncate flex-1">{customer.name}</p>
                    <Badge variant="primary" className="rounded-lg">
                      <Wallet className="w-3 h-3 mr-1" /> R$ {(customer.cashback_balance || 0).toFixed(2)}
                    </Badge>
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500 truncate">
                    {(customer.phone || '-')}{customer.email ? ` • ${customer.email}` : ''}{customer.cpf ? ` • CPF ${customer.cpf}` : ''}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-xs">
                      <span className="text-gray-600">Gasto: </span>
                      <span className="font-semibold text-green-600">R$ {(customer.total_spent || 0).toFixed(2)}</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-gray-600">Compras: </span>
                      <span className="font-semibold text-indigo-600">{customer.total_purchases || 0}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => handleOpenView(customer)} title="Ver cliente">
                      <Eye className="w-4 h-4 text-sky-600" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200" onClick={() => handleOpenCashback(customer)} title="Cashback">
                      <Wallet className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => handleOpenDialog(customer)} title="Editar cliente">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => { setConfirmDeleteCustomerId(customer.id); setShowConfirmDeleteCustomer(true); }} title="Excluir cliente">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Dialogo de visualizar cliente */}
        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Informações do Cliente</DialogTitle>
            </DialogHeader>
            {viewCustomer && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Nome</p>
                  <p className="text-sm font-semibold text-gray-900">{viewCustomer.name || '-'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Telefone</p>
                    <p className="text-sm text-gray-800">{viewCustomer.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm text-gray-800">{viewCustomer.email || '-'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500">CPF</p>
                  <p className="text-sm text-gray-800">{viewCustomer.cpf || '-'}</p>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="p-2 rounded-lg bg-gray-50 text-center">
                    <p className="text-[10px] text-gray-500">Saldo Cashback</p>
                    <p className="text-sm font-semibold text-indigo-600">R$ {(viewCustomer.cashback_balance || 0).toFixed(2)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-gray-50 text-center">
                    <p className="text-[10px] text-gray-500">Total gasto</p>
                    <p className="text-sm font-semibold text-green-600">R$ {(viewCustomer.total_spent || 0).toFixed(2)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-gray-50 text-center">
                    <p className="text-[10px] text-gray-500">Compras</p>
                    <p className="text-sm font-semibold text-blue-600">{viewCustomer.total_purchases || 0}</p>
                  </div>
                </div>
                <div className="pt-3 flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowViewDialog(false)}>Fechar</Button>
                  <Button className="flex-1 rounded-xl" onClick={() => { setShowViewDialog(false); handleOpenDialog(viewCustomer); }}>Editar</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Diálogo de detalhes de cashback */}
        <Dialog open={showCashbackDialog} onOpenChange={setShowCashbackDialog}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Cashback do Cliente</DialogTitle>
            </DialogHeader>
            {cashbackCustomer && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Cliente</p>
                  <p className="text-sm font-semibold text-gray-900">{cashbackCustomer.name || '-'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2 rounded-lg bg-gray-50 text-center">
                    <p className="text-[10px] text-gray-500">Saldo de cashback</p>
                    <p className="text-sm font-semibold text-indigo-600">R$ {Number(cashbackCustomer.cashback_balance || 0).toFixed(2)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-gray-50 text-center">
                    <p className="text-[10px] text-gray-500">Vencimento</p>
                    <p className="text-sm font-semibold text-gray-800">{cashbackCustomer.cashback_expires_at ? new Date(cashbackCustomer.cashback_expires_at).toLocaleDateString('pt-BR') : 'Sem vencimento'}</p>
                  </div>
                </div>
                <div className="pt-3">
                  <Button variant="outline" className="w-full rounded-xl" onClick={() => setShowCashbackDialog(false)}>Fechar</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialogo de criar/editar cliente (reutilizável) */}
        <CustomerDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          customer={editingCustomer}
          onSaved={() => {
            queryClient.invalidateQueries(['customers']);
            handleCloseDialog();
          }}
        />

        <ConfirmDialog
          open={showConfirmDeleteCustomer}
          onOpenChange={setShowConfirmDeleteCustomer}
          title="Excluir cliente"
          description="Tem certeza que deseja excluir este cliente?"
          confirmText="Excluir"
          cancelText="Cancelar"
          destructive
          onConfirm={() => {
            if (confirmDeleteCustomerId != null) {
              deleteMutation.mutate(confirmDeleteCustomerId);
            }
          }}
        />

        {/* Import/Export Dialogs */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="sm:max-w-lg rounded-2xl">
            <DialogHeader><DialogTitle>Importar clientes</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card className="rounded-xl border border-gray-200">
                <CardHeader><CardTitle className="text-sm">Arquivo CSV</CardTitle></CardHeader>
                <CardContent>
                  <input type="file" accept="text/csv,.csv" onChange={(e) => importCSV(e.target.files?.[0])} />
                  <p className="text-[11px] text-gray-500 mt-2">Campos: name, phone, email, cpf</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl border border-gray-200">
                <CardHeader><CardTitle className="text-sm">Modelo</CardTitle></CardHeader>
                <CardContent>
                  <Button className="rounded-xl" onClick={downloadTemplateCSV}>Baixar modelo CSV</Button>
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader><DialogTitle>Exportar clientes</DialogTitle></DialogHeader>
            <Card className="rounded-xl border border-gray-200">
              <CardContent>
                <Button className="rounded-xl" onClick={exportCSV}>Exportar CSV</Button>
              </CardContent>
            </Card>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
