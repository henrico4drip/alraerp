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
      <div className="max-w-4xl mx-auto relative">
        {/* Liquid Glass overlay card in front */}
        <div className="absolute inset-x-0 -top-4 z-20 mx-4 sm:mx-0 rounded-2xl border border-white/25 bg-white/12 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white/90">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M13 3l-2 2 6 6 2-2-6-6zm-9 9l-1 6 6-1 9-9-5-5-9 9z"/></svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Estamos construindo esta página</h2>
              <p className="text-white/80 text-sm">Em breve, recursos de Marketing e fidelização ficarão disponíveis aqui.</p>
            </div>
          </div>
        </div>
        <div className="pt-24">
          <div
            className="relative w-full rounded-2xl shadow-md"
            style={{
              background: 'linear-gradient(135deg, #6d28d9 0%, #3490c7 100%)',
              color: 'white',
              padding: 'clamp(16px, 3vw, 28px) clamp(18px, 3.2vw, 32px)'
            }}
          >
          <div className="flex items-start gap-2">
            <Zap className="w-6 h-6 opacity-90" />
            <div className="font-extrabold tracking-tight" style={{ fontSize: 'clamp(18px, 2.6vw, 26px)' }}>
              Cashback Ativo ({settings?.[0]?.cashback_percentage ?? 0}%)
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <DollarSign className="w-5 h-5" />
            <div className="font-bold" style={{ fontSize: 'clamp(16px, 2vw, 20px)' }}>
              {monthlyTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
            </div>
            <div className="text-white/90" style={{ fontSize: 'clamp(12px, 1.8vw, 14px)' }}>
              vendas geradas este mês
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <TrendingUp className="w-5 h-5" />
            <div className="text-white" style={{ fontSize: 'clamp(12px, 1.8vw, 14px)' }}>
              +{retentionPercent}% retenção de clientes
            </div>
          </div>
          <div className="mt-3 text-right">
            <Link to={createPageUrl('Reports')} className="text-white/90 underline text-[12px]">Ver Relatório</Link>
          </div>
          </div>
        </div>
      </div>

      {/* Outros itens de Marketing viriam aqui abaixo */}
    </div>
  )
}
