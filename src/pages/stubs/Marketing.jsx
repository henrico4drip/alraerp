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
      <div className="max-w-4xl mx-auto">
        {/* Card de aviso com efeito glass */}
        <div className="mb-6">
          <div
            className="relative rounded-3xl p-[2px]"
            style={{ background: 'linear-gradient(135deg, #6d28d9 0%, #3490c7 100%)' }}
          >
            <div className="rounded-3xl bg-white/60 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] px-8 py-10 sm:px-12 sm:py-12 text-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/70 rounded-xl flex items-center justify-center text-black/80">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M13 3l-2 2 6 6 2-2-6-6zm-9 9l-1 6 6-1 9-9-5-5-9 9z"/></svg>
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-semibold text-white">Marketing em construção</h2>
                  <p className="text-white text-sm sm:text-base mt-1">Estamos preparando recursos de fidelização, campanhas e relatórios.</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-white">
                <div className="rounded-xl bg-white/20 border border-white/40 px-4 py-3">• Cashback e pontos</div>
                <div className="rounded-xl bg-white/20 border border-white/40 px-4 py-3">• Campanhas e cupons</div>
                <div className="rounded-xl bg-white/20 border border-white/40 px-4 py-3">• Relatórios de engajamento</div>
              </div>
            </div>
          </div>
        </div>
        <div className="pt-2">
          <div
            className="relative w-full rounded-2xl shadow-md"
            style={{
              background: 'linear-gradient(135deg, #6d28d9 0%, #3490c7 100%)',
              color: 'white',
              padding: 'clamp(20px, 4vw, 40px) clamp(22px, 4vw, 44px)',
              minHeight: 'clamp(240px, 32vw, 420px)'
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

            {/* Conteúdo base */}
          </div>
        </div>
      </div>

      {/* Outros itens de Marketing viriam aqui abaixo */}
    </div>
  )
}
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import {
  Zap,
  DollarSign,
  TrendingUp,
  Rocket,
  Gift,
  Megaphone,
  PieChart
} from 'lucide-react'

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
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Marketing</h1>
          <p className="text-gray-500 mt-1">Fidelize clientes e aumente suas vendas.</p>
        </div>

        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 via-blue-500 to-cyan-400 rounded-[2rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative bg-white rounded-[1.7rem] p-1 shadow-xl">
            <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-[1.5rem] px-6 py-8 sm:p-10 border border-white/50">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-8">
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-200 text-white transform -rotate-3">
                    <Rocket className="w-8 h-8" />
                  </div>
                  <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-1 rounded-full shadow-sm border border-white">
                    EM BREVE
                  </div>
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900">Marketing Suite 2.0</h2>
                  <p className="text-gray-600 mt-1 max-w-xl">
                    Estamos finalizando um conjunto poderoso de ferramentas para você vender mais.
                    Prepare-se para campanhas automáticas e fidelização inteligente.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 shrink-0">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Clube de Pontos</h3>
                    <p className="text-xs text-gray-500">Recompensas automáticas</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-600 shrink-0">
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Campanhas</h3>
                    <p className="text-xs text-gray-500">Disparos via WhatsApp</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                    <PieChart className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Analytics</h3>
                    <p className="text-xs text-gray-500">Raio-X do cliente</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1">
          <div
            className="relative w-full rounded-[1.7rem] shadow-lg overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            }}
          >
            <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
            <div className="relative p-8 sm:p-10 text-white">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-1 opacity-90">
                    <Zap className="w-5 h-5" />
                    <span className="text-sm font-medium tracking-wide uppercase">Status Atual</span>
                  </div>
                  <div className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                    Cashback Ativo
                  </div>
                  <div className="mt-2 inline-flex items-center bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm border border-white/30">
                    <span className="font-bold">{settings?.[0]?.cashback_percentage ?? 0}%</span>
                    <span className="ml-1 opacity-90">configurado</span>
                  </div>
                </div>
                <div className="flex flex-col gap-4 min-w-[200px]">
                  <div className="flex items-center gap-4 bg-white/10 rounded-xl p-3 border border-white/10">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xl font-bold leading-none">
                        {monthlyTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                      </div>
                      <div className="text-xs opacity-80 mt-1">Vendas (Mês atual)</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 bg-white/10 rounded-xl p-3 border border-white/10">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xl font-bold leading-none">
                        +{retentionPercent}%
                      </div>
                      <div className="text-xs opacity-80 mt-1">Retenção de Clientes</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-white/20 flex justify-end">
                <Link
                  to={createPageUrl('Reports')}
                  className="group flex items-center gap-2 text-sm font-semibold hover:text-white/90 transition-colors"
                >
                  Ver Relatório Detalhado
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
