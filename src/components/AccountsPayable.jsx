import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Plus, Filter, Calendar as CalendarIcon, DollarSign, Trash2, Pencil, CheckCircle2, AlertCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, addMonths, subMonths, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Scale, TrendingUp, TrendingDown, Target, Package } from 'lucide-react';

export default function AccountsPayable() {
    const queryClient = useQueryClient();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showBalanceDialog, setShowBalanceDialog] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [expenseForm, setExpenseForm] = useState({
        description: '',
        amount: '',
        due_date: format(new Date(), 'yyyy-MM-dd'),
        provider: '',
        category: '',
        status: 'open',
        recurrence: 'none', // none, fixed, installments
        installments_count: 1
    });

    const [showImportDialog, setShowImportDialog] = useState(false);
    const [showExportDialog, setShowExportDialog] = useState(false);

    const { data: expenses = [] } = useQuery({
        queryKey: ['expenses'],
        queryFn: () => base44.entities.Expense.list('-due_date'),
        initialData: []
    });

    const { data: sales = [] } = useQuery({
        queryKey: ['sales'],
        queryFn: () => base44.entities.Sale.list('-sale_date'),
        initialData: []
    });

    const { data: products = [] } = useQuery({
        queryKey: ['products'],
        queryFn: () => base44.entities.Product.list(),
        initialData: []
    });

    const createExpenseMutation = useMutation({
        mutationFn: (data) => base44.entities.Expense.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['expenses']);
            setShowAddDialog(false);
            resetForm();
        }
    });

    const updateExpenseMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.Expense.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['expenses']);
            setShowAddDialog(false);
            resetForm();
        }
    });

    const deleteExpenseMutation = useMutation({
        mutationFn: (id) => base44.entities.Expense.delete(id),
        onSuccess: () => queryClient.invalidateQueries(['expenses'])
    });

    const resetForm = () => {
        setEditingExpense(null);
        setExpenseForm({
            description: '',
            amount: '',
            due_date: format(new Date(), 'yyyy-MM-dd'),
            provider: '',
            category: '',
            status: 'open',
            recurrence: 'none',
            installments_count: 1
        });
    };

    const handleOpenEdit = (expense) => {
        setEditingExpense(expense);
        setExpenseForm({
            ...expense,
            amount: expense.amount,
            due_date: expense.due_date ? expense.due_date.split('T')[0] : '',
        });
        setShowAddDialog(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            ...expenseForm,
            amount: parseFloat(expenseForm.amount) || 0,
            due_date: new Date(expenseForm.due_date).toISOString(),
        };

        if (editingExpense) {
            updateExpenseMutation.mutate({ id: editingExpense.id, data: payload });
        } else {
            // Logic for installments/recurrence could create multiple items here
            if (payload.recurrence === 'installments' && payload.installments_count > 1) {
                const count = parseInt(payload.installments_count);
                const baseDate = new Date(expenseForm.due_date);
                const amountPerInstallment = payload.amount / count; // or payload.amount IS per installment? usually amount is total.
                // Lets assume user enters TOTAL amount for installments.
                const singleValue = parseFloat((payload.amount / count).toFixed(2));

                const batch = [];
                for (let i = 0; i < count; i++) {
                    const d = new Date(baseDate);
                    d.setMonth(d.getMonth() + i);
                    batch.push({
                        ...payload,
                        description: `${payload.description} (${i + 1}/${count})`,
                        amount: singleValue,
                        due_date: d.toISOString(),
                        recurrence: 'none', // individual items don't recur, they ARE the recurrence
                        group_id: Date.now().toString() // simple group id
                    });
                }
                // We need to run multiple creates. Promise.all
                // Base44 client create is singular. 
                // We can just loop mutate. Or logic in a useEffect? 
                // Better to handle in the mutationFn wrapper or just here sequentially as it's client side logic primarily.
                try {
                    await Promise.all(batch.map(item => base44.entities.Expense.create(item)));
                    queryClient.invalidateQueries(['expenses']);
                    setShowAddDialog(false);
                    resetForm();
                } catch (err) {
                    alert('Erro ao criar parcelas');
                }
            } else {
                createExpenseMutation.mutate(payload);
            }
        }
    };

    const toggleStatus = (expense) => {
        const newStatus = expense.status === 'paid' ? 'open' : 'paid';
        updateExpenseMutation.mutate({
            id: expense.id,
            data: {
                status: newStatus,
                paid_at: newStatus === 'paid' ? new Date().toISOString() : null
            }
        });
    };

    const downloadTemplateCSV = () => {
        const headers = ['description', 'amount', 'due_date', 'provider', 'category', 'status']
        const content = headers.join(',') + '\n'
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'despesas_template.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    const exportCSV = () => {
        const headers = ['description', 'amount', 'due_date', 'provider', 'category', 'status']
        const rows = expenses.map(e => [
            e.description || '',
            e.amount || 0,
            e.due_date ? e.due_date.split('T')[0] : '',
            e.provider || '',
            e.category || '',
            e.status || 'open'
        ])
        const content = [headers, ...rows].map(r => r.map(v => String(v).replace(/"/g, '""')).join(',')).join('\n')
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'despesas_export.csv'
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

        const creations = []
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',')
            const payload = {
                description: cols[idx('description')] || '',
                amount: parseFloat(cols[idx('amount')]) || 0,
                due_date: cols[idx('due_date')] ? new Date(cols[idx('due_date')]).toISOString() : new Date().toISOString(),
                provider: cols[idx('provider')] || '',
                category: cols[idx('category')] || '',
                status: cols[idx('status')] || 'open',
            }
            if (payload.description) {
                creations.push(base44.entities.Expense.create(payload))
            }
        }

        try {
            await Promise.all(creations)
            queryClient.invalidateQueries(['expenses'])
            setShowImportDialog(false)
        } catch (err) {
            alert('Erro ao importar despesas')
        }
    }

    // Filter Logic
    const filteredExpenses = useMemo(() => {
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);

        return expenses.filter(exp => {
            if (!exp?.due_date) return false;
            const d = new Date(exp.due_date);
            const matchesMonth = isWithinInterval(d, { start, end });
            const matchesSearch = (exp.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (exp.provider || '').toLowerCase().includes(searchTerm.toLowerCase());
            return matchesMonth && matchesSearch;
        }).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    }, [expenses, currentMonth, searchTerm]);

    const totals = useMemo(() => {
        return filteredExpenses.reduce((acc, curr) => {
            acc.total += (curr.amount || 0);
            if (curr.status === 'paid') acc.paid += (curr.amount || 0);
            else acc.open += (curr.amount || 0);
            return acc;
        }, { total: 0, paid: 0, open: 0 });
    }, [filteredExpenses]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-28 relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-24 h-24 bg-red-50 rounded-full -mr-8 -mt-8 z-0"></div>
                    <div className="relative z-10">
                        <p className="text-gray-500 text-sm font-medium uppercase tracking-wide">Total a Pagar (Mês)</p>
                        <h3 className="text-2xl font-bold text-gray-900 mt-1">R$ {totals.open.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                    </div>
                    <div className="relative z-10 mt-auto">
                        <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded-full font-medium">Pendente</span>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-28 relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-24 h-24 bg-green-50 rounded-full -mr-8 -mt-8 z-0"></div>
                    <div className="relative z-10">
                        <p className="text-gray-500 text-sm font-medium uppercase tracking-wide">Total Pago (Mês)</p>
                        <h3 className="text-2xl font-bold text-gray-900 mt-1">R$ {totals.paid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                    </div>
                    <div className="relative z-10 mt-auto">
                        <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full font-medium">Realizado</span>
                    </div>
                </div>
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 flex flex-col justify-between h-28 opacity-75">
                    <p className="text-gray-500 text-sm font-medium uppercase tracking-wide">Total Geral do Mês</p>
                    <h3 className="text-2xl font-bold text-gray-700 mt-1">R$ {totals.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-1">
                        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="rounded-lg h-8 w-8 hover:bg-white hover:shadow-sm">‹</Button>
                        <span className="text-sm font-bold text-gray-700 min-w-[120px] text-center capitalize">
                            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                        </span>
                        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="rounded-lg h-8 w-8 hover:bg-white hover:shadow-sm">›</Button>
                    </div>
                    <div className="h-6 w-px bg-gray-200 hidden md:block"></div>
                </div>
                <div className="flex w-full md:w-auto gap-3">
                    <input
                        placeholder="Buscar despesas..."
                        className="flex-1 md:w-64 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:bg-white focus:border-blue-500 outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <Button onClick={() => setShowBalanceDialog(true)} variant="outline" className="rounded-xl border-blue-200 text-blue-600 bg-blue-50/50 hover:bg-blue-50 gap-2">
                            <Scale className="w-4 h-4" /> Balanço
                        </Button>
                        <Button onClick={() => setShowImportDialog(true)} variant="outline" className="rounded-xl border-gray-200 text-gray-600">
                            Importar
                        </Button>
                        <Button onClick={() => setShowExportDialog(true)} variant="outline" className="rounded-xl border-gray-200 text-gray-600">
                            Exportar
                        </Button>
                        <Button onClick={() => { resetForm(); setShowAddDialog(true); }} className="bg-red-600 hover:bg-red-700 text-white rounded-xl gap-2 shadow-lg shadow-red-200">
                            <Plus className="w-4 h-4" /> Nova Despesa
                        </Button>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4">Vencimento</th>
                                <th className="px-6 py-4">Descrição</th>
                                <th className="px-6 py-4">Fornecedor</th>
                                <th className="px-6 py-4">Categoria</th>
                                <th className="px-6 py-4">Valor</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredExpenses.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <CalendarIcon className="w-8 h-8 opacity-20" />
                                            <p>Nenhuma despesa encontrada para este período.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredExpenses.map((expense) => {
                                    const isPaid = expense.status === 'paid';
                                    const isLate = !isPaid && new Date(expense.due_date) < new Date().setHours(0, 0, 0, 0);
                                    return (
                                        <tr key={expense.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className={`px-6 py-4 font-medium ${isLate ? 'text-red-500' : 'text-gray-700'}`}>
                                                {new Date(expense.due_date).toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900">{expense.description}</td>
                                            <td className="px-6 py-4 text-gray-500">{expense.provider || '-'}</td>
                                            <td className="px-6 py-4">
                                                {expense.category && (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-xs font-medium text-gray-600">
                                                        {expense.category}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-gray-900">R$ {Number(expense.amount).toFixed(2)}</td>
                                            <td className="px-6 py-4 text-center">
                                                <button onClick={() => toggleStatus(expense)} className={`
                                                    inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide transition-all
                                                    ${isPaid ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'}
                                                `}>
                                                    {isPaid ? <><CheckCircle2 className="w-3 h-3" /> Pago</> : <><AlertCircle className="w-3 h-3" /> Aberto</>}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(expense)} className="h-8 w-8 text-blue-600 hover:bg-blue-50 rounded-lg">
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => deleteExpenseMutation.mutate(expense.id)} className="h-8 w-8 text-red-500 hover:bg-red-50 rounded-lg">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="max-w-md rounded-3xl">
                    <DialogHeader>
                        <DialogTitle>{editingExpense ? 'Editar Despesa' : 'Nova Despesa'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Descrição</label>
                            <input
                                required
                                value={expenseForm.description}
                                onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:border-blue-500 outline-none transition-colors"
                                placeholder="Ex: Conta de Luz"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Valor (R$)</label>
                                <input
                                    required
                                    type="number"
                                    step="0.01"
                                    value={expenseForm.amount}
                                    onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:border-blue-500 outline-none transition-colors"
                                    placeholder="0,00"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Vencimento</label>
                                <input
                                    required
                                    type="date"
                                    value={expenseForm.due_date}
                                    onChange={e => setExpenseForm({ ...expenseForm, due_date: e.target.value })}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:border-blue-500 outline-none transition-colors"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Fornecedor (Opcional)</label>
                            <input
                                value={expenseForm.provider}
                                onChange={e => setExpenseForm({ ...expenseForm, provider: e.target.value })}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:border-blue-500 outline-none transition-colors"
                                placeholder="Ex: ENEL"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Categoria (Opcional)</label>
                            <input
                                value={expenseForm.category}
                                onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:border-blue-500 outline-none transition-colors"
                                placeholder="Ex: Fixas, Manutenção..."
                            />
                        </div>

                        {!editingExpense && (
                            <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="recurrence"
                                        checked={expenseForm.recurrence === 'installments'}
                                        onChange={e => setExpenseForm({ ...expenseForm, recurrence: e.target.checked ? 'installments' : 'none' })}
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <label htmlFor="recurrence" className="text-sm font-medium text-gray-700">É uma compra parcelada?</label>
                                </div>
                                {expenseForm.recurrence === 'installments' && (
                                    <div className="animate-in slide-in-from-top-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Número de Parcelas</label>
                                        <input
                                            type="number"
                                            min="2"
                                            max="48"
                                            value={expenseForm.installments_count}
                                            onChange={e => setExpenseForm({ ...expenseForm, installments_count: e.target.value })}
                                            className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 focus:border-blue-500 outline-none"
                                        />
                                        <p className="text-[10px] text-gray-500 mt-1">O valor total será dividido pelo número de parcelas.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-gray-100">
                            <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)} className="rounded-xl">Cancelar</Button>
                            <Button type="submit" className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white">Salvar</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Balance Dialog */}
            <BalanceModal
                open={showBalanceDialog}
                onOpenChange={setShowBalanceDialog}
                sales={sales}
                expenses={expenses}
                products={products}
                currentMonth={currentMonth}
            />

            {/* Import Dialog */}
            <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                <DialogContent className="max-w-md rounded-3xl">
                    <DialogHeader>
                        <DialogTitle>Importar Despesas</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex gap-3">
                            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-blue-900">Instruções</p>
                                <p className="text-xs text-blue-700 mt-1">O arquivo deve ser um CSV com os cabeçalhos: description, amount, due_date, provider, category, status.</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Button onClick={downloadTemplateCSV} variant="outline" className="w-full rounded-xl justify-start gap-2 h-12">
                                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                                    <Plus className="w-4 h-4 text-gray-600" />
                                </div>
                                <span>Baixar Modelo CSV</span>
                            </Button>

                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={(e) => importCSV(e.target.files?.[0])}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <Button variant="outline" className="w-full rounded-xl justify-start gap-2 h-12 border-dashed border-2">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                        <Plus className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <span>Selecionar Arquivo CSV</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Export Dialog */}
            <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
                <DialogContent className="max-w-sm rounded-3xl">
                    <DialogHeader>
                        <DialogTitle>Exportar Despesas</DialogTitle>
                    </DialogHeader>
                    <div className="pt-4 space-y-4">
                        <p className="text-sm text-gray-500">Deseja exportar todas as despesas cadastradas para um arquivo CSV?</p>
                        <Button onClick={() => { exportCSV(); setShowExportDialog(false); }} className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-12 gap-2">
                            Download CSV
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function BalanceModal({ open, onOpenChange, sales, expenses, products, currentMonth }) {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    const metrics = useMemo(() => {
        // 1. Vendido (Total sales of the month)
        const soldMonth = sales
            .filter(s => isWithinInterval(new Date(s.sale_date), { start, end }))
            .reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);

        // 2. A Receber (Open installments in this month)
        let receivablesMonth = 0;
        sales.forEach(s => {
            const payments = Array.isArray(s.payments) ? s.payments : (s.payments ? [s.payments] : []);
            payments.forEach(p => {
                if (p.method === 'Carnê' && Array.isArray(p.schedule)) {
                    p.schedule.forEach(inst => {
                        const due = new Date(inst.due_date);
                        if (inst.status !== 'paid' && isWithinInterval(due, { start, end })) {
                            receivablesMonth += Number(inst.amount) || 0;
                        }
                    });
                }
            });
        });

        // 3. A Pagar (Expenses of the month)
        const payablesMonth = expenses
            .filter(e => isWithinInterval(new Date(e.due_date), { start, end }) && e.status !== 'paid')
            .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

        const paidMonth = expenses
            .filter(e => isWithinInterval(new Date(e.due_date), { start, end }) && e.status === 'paid')
            .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

        // 4. Potencial de Venda (Stock value)
        const stockPotential = products.reduce((sum, p) => sum + ((Number(p.stock) || 0) * (Number(p.price) || 0)), 0);

        const balanceActual = soldMonth - paidMonth;
        const balanceProjected = (soldMonth + receivablesMonth) - (payablesMonth + paidMonth);

        return { soldMonth, receivablesMonth, payablesMonth, paidMonth, stockPotential, balanceActual, balanceProjected };
    }, [sales, expenses, products, start, end]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
                <div className="bg-gradient-to-br from-slate-900 to-blue-950 p-8 text-white">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold">Balanço Financeiro</h2>
                            <p className="text-blue-300 text-sm mt-1 capitalize">
                                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                            </p>
                        </div>
                        <Scale className="w-10 h-10 text-blue-400 opacity-50" />
                    </div>

                    <div className="grid grid-cols-2 gap-8 mt-10">
                        <div>
                            <p className="text-blue-200 text-xs uppercase font-bold tracking-wider">Saldo Atual</p>
                            <h3 className="text-4xl font-black mt-1">R$ {metrics.balanceActual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                            <p className="text-[10px] text-blue-300 mt-1">Vendas realizadas - Despesas pagas</p>
                        </div>
                        <div className="text-right">
                            <p className="text-blue-200 text-xs uppercase font-bold tracking-wider">Projeção Final</p>
                            <h3 className={`text-4xl font-black mt-1 ${metrics.balanceProjected >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                R$ {metrics.balanceProjected.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </h3>
                            <p className="text-[10px] text-blue-300 mt-1">Considerando tudo a receber e a pagar</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-white grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase font-bold">Total Vendido</p>
                                <p className="text-lg font-bold text-gray-900">R$ {metrics.soldMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <Target className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase font-bold">A Receber (Carnês)</p>
                                <p className="text-lg font-bold text-gray-900">R$ {metrics.receivablesMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                                <TrendingDown className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase font-bold">A Pagar (Despesas)</p>
                                <p className="text-lg font-bold text-gray-900 text-red-600">R$ {(metrics.payablesMonth + metrics.paidMonth).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                <Package className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-[10px] text-indigo-500 uppercase font-bold">Potencial em Estoque</p>
                                <p className="text-lg font-bold text-indigo-900">R$ {metrics.stockPotential.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-2 pt-4 border-t border-gray-100">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-gray-500 uppercase">Liquidez do Período</span>
                            <span className="text-xs font-bold text-gray-900">
                                {metrics.soldMonth > 0 ? ((metrics.balanceActual / metrics.soldMonth) * 100).toFixed(1) : 0}% Lucro Bruto
                            </span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-green-500 transition-all duration-1000"
                                style={{ width: `${Math.max(0, Math.min(100, (metrics.balanceActual / (metrics.soldMonth || 1)) * 100))}%` }}
                            />
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
