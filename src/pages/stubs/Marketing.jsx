import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import { Zap, DollarSign, TrendingUp } from 'lucide-react'

export default function Marketing(){
  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Settings.list(),
    initialData: [],
  })
  const { data: sales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list('-created_date'),
    initialData: [],
  })

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

  return (
    <div className="p-4 w-full">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Marketing</h1>
          <p className="text-sm text-gray-500">Indicadores e ações de engajamento</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#3490c7]/10 text-[#3490c7] flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div className="text-xs text-gray-500">Cashback ativo</div>
            </div>
            <div className="mt-3 text-2xl font-bold text-gray-900">{settings?.[0]?.cashback_percentage ?? 0}%</div>
            <div className="mt-1 text-xs text-gray-500">Percentual configurado</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#3490c7]/10 text-[#3490c7] flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <div className="text-xs text-gray-500">Receita do mês</div>
            </div>
            <div className="mt-3 text-2xl font-bold text-gray-900">{monthlyTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}</div>
            <div className="mt-1 text-xs text-gray-500">Vendas geradas</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#3490c7]/10 text-[#3490c7] flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="text-xs text-gray-500">Retenção</div>
            </div>
            <div className="mt-3 text-2xl font-bold text-gray-900">{retentionPercent}%</div>
            <div className="mt-1 text-xs text-gray-500">Clientes recorrentes</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#3490c7]/10 text-[#3490c7] flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4zM4 11h16v2H4zM4 16h16v2H4z"/></svg>
              </div>
              <div className="text-xs text-gray-500">Clientes únicos</div>
            </div>
            <div className="mt-3 text-2xl font-bold text-gray-900">{monthUniqueCustomers}</div>
            <div className="mt-1 text-xs text-gray-500">No período</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Campanhas</div>
              <div className="text-xs text-gray-500">Crie ações de engajamento</div>
            </div>
            <Link to={createPageUrl('Reports')} className="inline-flex items-center justify-center h-9 px-3 text-sm rounded-xl bg-[#3490c7] text-white hover:bg-[#2c8ac2]">Ver Relatórios</Link>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Cupons</div>
              <div className="text-xs text-gray-500">Configure descontos e vantagens</div>
            </div>
            <button className="h-9 px-3 text-sm rounded-xl border border-gray-200 hover:bg-gray-50">Configurar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
