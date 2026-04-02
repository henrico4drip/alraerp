import React, { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Search, User, CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronUp, Package, X } from 'lucide-react'
import { isBefore, startOfDay, isValid } from 'date-fns'

const asPaymentsArray = (p) => Array.isArray(p) ? p : (p ? [p] : [])

export default function CustomerStatement({ sales = [], customers = [], open, onOpenChange, inline = false }) {
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedCustomerId, setSelectedCustomerId] = useState(null)
    const [activeTab, setActiveTab] = useState('all') // 'all' | 'open' | 'paid'
    const [expandedSale, setExpandedSale] = useState(null)

    const today = startOfDay(new Date())

    // Autocomplete customers
    const filteredCustomers = useMemo(() => {
        if (!searchTerm || searchTerm.length < 2) return []
        const q = searchTerm.toLowerCase()
        return customers.filter(c =>
            (c.name || '').toLowerCase().includes(q) ||
            (c.phone || '').includes(q) ||
            (c.cpf || '').includes(q)
        ).slice(0, 8)
    }, [customers, searchTerm])

    const selectedCustomer = useMemo(() => {
        if (!selectedCustomerId) return null
        return customers.find(c => c.id === selectedCustomerId) || null
    }, [customers, selectedCustomerId])

    // Get all carnê data for selected customer
    const customerCarneData = useMemo(() => {
        if (!selectedCustomerId) return []
        return sales.filter(s => {
            if (s.customer_id !== selectedCustomerId) return false
            const payments = asPaymentsArray(s.payments)
            return payments.some(p => p.method === 'Carnê' && Array.isArray(p.schedule))
        })
    }, [sales, selectedCustomerId])

    // Summary
    const summary = useMemo(() => {
        let totalOpen = 0, totalPaid = 0, countOpen = 0, countPaid = 0, countOverdue = 0
        for (const sale of customerCarneData) {
            const payments = asPaymentsArray(sale.payments)
            for (const p of payments) {
                if (p.method !== 'Carnê' || !Array.isArray(p.schedule)) continue
                for (const inst of p.schedule) {
                    if (String(inst.index).includes('.P')) continue // parcela parcial
                    if (inst.status === 'paid') {
                        totalPaid += Number(inst.value_paid || inst.amount || 0)
                        countPaid++
                    } else {
                        totalOpen += Number(inst.amount || 0)
                        countOpen++
                        const due = new Date(inst.due_date)
                        if (isValid(due) && isBefore(due, today)) countOverdue++
                    }
                }
            }
        }
        return { totalOpen, totalPaid, countOpen, countPaid, countOverdue }
    }, [customerCarneData, today])

    const handleSelectCustomer = (customer) => {
        setSelectedCustomerId(customer.id)
        setSearchTerm(customer.name || '')
        setActiveTab('all')
        setExpandedSale(null)
    }

    const handleClear = () => {
        setSelectedCustomerId(null)
        setSearchTerm('')
        setActiveTab('all')
        setExpandedSale(null)
    }

    const getItemsDescription = (sale) => {
        const items = Array.isArray(sale.items) ? sale.items : []
        if (items.length === 0) return 'Compra'
        const names = items.slice(0, 3).map(i => i.name || i.product_name || 'Produto')
        const suffix = items.length > 3 ? ` +${items.length - 3}` : ''
        return names.join(', ') + suffix
    }

    const renderContent = () => (
        <div className={`flex flex-col h-full bg-white ${inline ? '' : 'max-h-[90vh]'}`}>
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold">Extrato do Cliente</h2>
                        <p className="text-slate-400 text-xs mt-0.5">Visualize todas as parcelas de crediário</p>
                    </div>
                    <User className="w-8 h-8 text-slate-500" />
                </div>

                {/* Search */}
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="w-4 h-4 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar cliente por nome, telefone ou CPF..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value)
                            if (selectedCustomerId) setSelectedCustomerId(null)
                        }}
                        className="w-full bg-white/10 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-all text-sm"
                    />
                    {(searchTerm || selectedCustomerId) && (
                        <button onClick={handleClear} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    )}

                    {/* Autocomplete Dropdown */}
                    {filteredCustomers.length > 0 && !selectedCustomerId && (
                        <div className="absolute z-50 top-full mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                            {filteredCustomers.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => handleSelectCustomer(c)}
                                    className="w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors flex items-center gap-3 border-b border-slate-700/50 last:border-0"
                                >
                                    <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-slate-300">
                                        {(c.name || '?')[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm text-white">{c.name || 'Sem nome'}</p>
                                        <p className="text-[10px] text-slate-400">{c.phone || ''} {c.cpf ? `• ${c.cpf}` : ''}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                {!selectedCustomerId ? (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                        <Search className="w-16 h-16 opacity-20 mb-4" />
                        <p className="font-bold text-lg text-slate-600">Consulte um CPF ou Nome</p>
                        <p className="text-sm">Inicie a busca para gerenciar as parcelas do cliente selecionado.</p>
                    </div>
                ) : customerCarneData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                        <Package className="w-16 h-16 opacity-20 mb-4" />
                        <p className="font-bold text-lg text-slate-600">Sem crediário registrado</p>
                        <p className="text-sm">{selectedCustomer?.name || 'Este cliente'} não possui histórico de carnê nesta loja.</p>
                    </div>
                ) : (
                    <div className="space-y-6 max-w-4xl mx-auto">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-white border border-red-100 rounded-3xl p-5 shadow-sm">
                                <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest mb-1">Em Aberto</p>
                                <p className="text-2xl font-black text-red-700">R$ {summary.totalOpen.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                <p className="text-xs text-slate-400 mt-1 font-medium">{summary.countOpen} parcela{summary.countOpen !== 1 ? 's' : ''}</p>
                            </div>
                            <div className="bg-white border border-emerald-100 rounded-3xl p-5 shadow-sm">
                                <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mb-1">Total Pago</p>
                                <p className="text-2xl font-black text-emerald-700">R$ {summary.totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                <p className="text-xs text-slate-400 mt-1 font-medium">{summary.countPaid} parcela{summary.countPaid !== 1 ? 's' : ''}</p>
                            </div>
                            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Total Histórico</p>
                                <p className="text-2xl font-black text-slate-800">R$ {(summary.totalOpen + summary.totalPaid).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                <p className="text-xs text-slate-400 mt-1 font-medium">{summary.countOpen + summary.countPaid} parcelas</p>
                            </div>
                        </div>

                        {summary.countOverdue > 0 && (
                            <div className="bg-red-500 rounded-2xl p-4 flex items-center gap-4 text-white shadow-lg shadow-red-200">
                                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                                    <AlertCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-black text-sm uppercase">Dívida em Atraso</p>
                                    <p className="text-red-100 text-xs">Existem {summary.countOverdue} parcela{summary.countOverdue !== 1 ? 's' : ''} vencida{summary.countOverdue !== 1 ? 's' : ''}.</p>
                                </div>
                            </div>
                        )}

                        {/* Tabs */}
                        <div className="flex gap-2 bg-slate-200/50 p-1 rounded-2xl w-full sm:w-fit">
                            {[
                                { key: 'all', label: 'Todas' },
                                { key: 'open', label: `Em Aberto (${summary.countOpen})` },
                                { key: 'paid', label: `Pagas (${summary.countPaid})` },
                            ].map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${activeTab === tab.key ? 'bg-white text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Sales List */}
                        <div className="space-y-4">
                            {customerCarneData.map((sale) => {
                                const payments = asPaymentsArray(sale.payments)
                                const carnePayments = payments.filter(p => p.method === 'Carnê' && Array.isArray(p.schedule))
                                const itemsDesc = getItemsDescription(sale)
                                const isExpanded = expandedSale === sale.id

                                // Collect all installments for filtering
                                let allInstallments = []
                                carnePayments.forEach((p, pIdx) => {
                                    const schedule = [...(p.schedule || [])].filter(i => !String(i.index).includes('.P'))
                                    schedule.forEach(inst => {
                                        allInstallments.push({ ...inst, totalCount: schedule.length })
                                    })
                                })

                                // Filter by tab
                                const filtered = allInstallments.filter(inst => {
                                    if (activeTab === 'open') return inst.status !== 'paid'
                                    if (activeTab === 'paid') return inst.status === 'paid'
                                    return true
                                })

                                if (filtered.length === 0) return null

                                return (
                                    <div key={sale.id} className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                                        <button
                                            onClick={() => setExpandedSale(isExpanded ? null : sale.id)}
                                            className="w-full p-5 bg-slate-50/10 flex flex-col sm:flex-row items-center gap-4 hover:bg-slate-50 transition-colors text-left"
                                        >
                                            <div className="bg-blue-50 p-3 rounded-2xl text-blue-600 shrink-0">
                                                <Package className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="font-black text-slate-900 text-sm tracking-tight">VENDA #{sale.sale_number}</p>
                                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">
                                                        {sale.sale_date ? new Date(sale.sale_date).toLocaleDateString('pt-BR') : ''}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 font-medium line-clamp-1">{itemsDesc}</p>
                                            </div>
                                            <div className="flex items-center gap-6 shrink-0">
                                                <div className="text-right">
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Valor Total</p>
                                                    <p className="font-black text-slate-900 text-lg">R$ {Number(sale.total_amount || 0).toFixed(2)}</p>
                                                </div>
                                                {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-300" /> : <ChevronDown className="w-5 h-5 text-slate-300" />}
                                            </div>
                                        </button>

                                        {isExpanded && (
                                            <div className="divide-y divide-slate-50 border-t border-slate-100 animate-in slide-in-from-top-2">
                                                {/* Detalhamento dos Produtos da Venda */}
                                                <div className="p-5 bg-slate-50/30">
                                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Itens desta Compra:</p>
                                                   <div className="space-y-2">
                                                        {Array.isArray(sale.items) && sale.items.map((item, idx) => (
                                                            <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-100/50 shadow-sm text-sm">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="w-7 h-7 flex items-center justify-center bg-slate-100 rounded-lg text-[10px] font-bold text-slate-500">
                                                                        {item.quantity}x
                                                                    </span>
                                                                    <span className="font-semibold text-slate-700">{item.name || item.product_name || 'Item'}</span>
                                                                </div>
                                                                <span className="font-bold text-slate-900">R$ {Number(item.total_price || (item.unit_price * item.quantity) || 0).toFixed(2)}</span>
                                                            </div>
                                                        ))}
                                                   </div>
                                                </div>

                                                {/* Lista de Parcelas */}
                                                <div className="p-2 space-y-1">
                                                    {filtered.sort((a, b) => (Number(a.index) || 0) - (Number(b.index) || 0)).map((inst, idx) => {
                                                        const isPaid = inst.status === 'paid'
                                                        const dueDate = new Date(inst.due_date)
                                                        const isOverdue = !isPaid && isValid(dueDate) && isBefore(dueDate, today)

                                                        return (
                                                            <div key={`${inst.index}-${idx}`} className={`px-4 py-4 rounded-2xl flex items-center gap-4 ${isPaid ? 'bg-slate-50/50 grayscale-[0.5]' : 'hover:bg-slate-50/70 transition-colors'}`}>
                                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                                                                    isPaid ? 'bg-emerald-100 text-emerald-600' :
                                                                    isOverdue ? 'bg-red-100 text-red-600' :
                                                                    'bg-amber-100 text-amber-600'
                                                                }`}>
                                                                    {isPaid ? <CheckCircle2 className="w-5 h-5 text-emerald-600/70" /> :
                                                                    isOverdue ? <AlertCircle className="w-5 h-5 text-red-600/70" /> :
                                                                    <Clock className="w-5 h-5 text-amber-600/70" />}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-black text-slate-800 text-sm tracking-tight uppercase">
                                                                        Parcela {inst.index} de {inst.totalCount}
                                                                    </p>
                                                                    <p className="text-xs text-slate-500 font-medium">
                                                                        {isPaid ? (
                                                                            <>Quitada em {inst.payment_date ? new Date(inst.payment_date).toLocaleDateString('pt-BR') : '-'}</>
                                                                        ) : isOverdue ? (
                                                                            <span className="text-red-600 font-bold">Vencida em {isValid(dueDate) ? dueDate.toLocaleDateString('pt-BR') : ''}</span>
                                                                        ) : (
                                                                            <>Vencimento {isValid(dueDate) ? dueDate.toLocaleDateString('pt-BR') : ''}</>
                                                                        )}
                                                                    </p>
                                                                </div>
                                                                <div className="text-right shrink-0">
                                                                    <p className={`font-black text-base ${isPaid ? 'text-emerald-600' : 'text-slate-900'}`}>
                                                                        R$ {Number(inst.amount || inst.value_paid || 0).toFixed(2)}
                                                                    </p>
                                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                                                                        isPaid ? 'text-emerald-500' :
                                                                        isOverdue ? 'text-red-500' :
                                                                        'text-amber-500'
                                                                    }`}>
                                                                        {isPaid ? 'Pago' : isOverdue ? 'Atrasado' : 'Pendente'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            {!inline && (
                <div className="p-4 border-t border-slate-100 bg-white flex justify-end shrink-0">
                    <Button variant="outline" className="rounded-xl border-slate-200 text-slate-600" onClick={() => onOpenChange(false)}>Fechar Extrato</Button>
                </div>
            )}
        </div>
    )

    if (inline) return renderContent()

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl flex flex-col">
                {renderContent()}
            </DialogContent>
        </Dialog>
    )
}
