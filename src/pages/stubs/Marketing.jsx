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
            className="relative rounded-3xl p-[2px] ring-1 ring-white/30"
          >
            <div
              className="rounded-3xl backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] px-8 py-10 sm:px-12 sm:py-12 bg-transparent"
              style={{ background: 'linear-gradient(180deg, rgba(52,144,199,0.20) 0%, rgba(255,255,255,0.00) 70%)' }}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/70 rounded-xl flex items-center justify-center text-white/90">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M13 3l-2 2 6 6 2-2-6-6zm-9 9l-1 6 6-1 9-9-5-5-9 9z"/></svg>
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-semibold text-white">Marketing em construção</h2>
                  <p className="text-white/80 text-sm sm:text-base mt-1">Estamos preparando recursos de fidelização, campanhas e relatórios.</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-white">
                <div className="rounded-xl bg-white/20 px-4 py-3 text-white">• Cashback e pontos</div>
                <div className="rounded-xl bg-white/20 px-4 py-3 text-white">• Campanhas e cupons</div>
                <div className="rounded-xl bg-white/20 px-4 py-3 text-white">• Relatórios de engajamento</div>
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
import { Zap, DollarSign, TrendingUp } from 'lucide-react'

const WorkerLadderSVG = ({ className }) => (
  <svg viewBox="0 0 200 300" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M60 280L80 20" stroke="white" strokeWidth="6" strokeLinecap="round"/>
    <path d="M140 280L120 20" stroke="white" strokeWidth="6" strokeLinecap="round"/>
    <path d="M65 240H135" stroke="white" strokeWidth="4" strokeLinecap="round"/>
    <path d="M68 190H132" stroke="white" strokeWidth="4" strokeLinecap="round"/>
    <path d="M71 140H129" stroke="white" strokeWidth="4" strokeLinecap="round"/>
    <path d="M74 90H126" stroke="white" strokeWidth="4" strokeLinecap="round"/>
    <g transform="translate(40, 60)">
      <path d="M45 100L40 130" stroke="#334155" strokeWidth="12" strokeLinecap="round"/>
      <path d="M75 100L75 130" stroke="#334155" strokeWidth="12" strokeLinecap="round"/>
      <path d="M60 100V50" stroke="#76cc2e" strokeWidth="24" strokeLinecap="round"/>
      <circle cx="60" cy="35" r="14" fill="#f1f5f9"/>
      <path d="M60 60L90 50" stroke="#76cc2e" strokeWidth="10" strokeLinecap="round"/>
      <rect x="85" y="35" width="8" height="25" rx="2" transform="rotate(-15 85 35)" fill="#3b82f6"/>
    </g>
  </svg>
)

const WorkerScaffoldSVG = ({ className }) => (
  <svg viewBox="0 0 250 300" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="150" width="210" height="10" rx="2" fill="rgba(255,255,255,0.3)"/>
    <path d="M30 300V150" stroke="white" strokeWidth="4" strokeDasharray="10 10" opacity="0.6"/>
    <path d="M220 300V150" stroke="white" strokeWidth="4" strokeDasharray="10 10" opacity="0.6"/>
    <path d="M30 220L220 220" stroke="white" strokeWidth="2" opacity="0.4"/>
    <g transform="translate(140, 105)">
      <path d="M20 50L20 85" stroke="#1e293b" strokeWidth="10" strokeLinecap="round"/>
      <path d="M40 50L50 80" stroke="#1e293b" strokeWidth="10" strokeLinecap="round"/>
      <path d="M30 50L30 10" stroke="#fbbf24" strokeWidth="20" strokeLinecap="round"/>
      <circle cx="30" cy="-5" r="12" fill="#f8fafc"/>
      <path d="M16 -5C16 -13 22 -19 30 -19C38 -19 44 -13 44 -5" stroke="#f59e0b" strokeWidth="4" fill="#f59e0b"/>
      <path d="M30 20L55 25" stroke="#fbbf24" strokeWidth="8" strokeLinecap="round"/>
      <rect x="50" y="5" width="20" height="25" rx="2" fill="white" transform="rotate(10)"/>
      <path d="M55 20L65 10" stroke="#10b981" strokeWidth="2" transform="rotate(10)"/>
    </g>
  </svg>
)

export default function Marketing() {
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
        <div className="mb-6 relative group">
          <div className="relative rounded-3xl p-[2px] ring-1 ring-white/30 overflow-hidden">
            <div
              className="relative rounded-3xl backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] px-8 py-10 sm:px-12 sm:py-12 bg-transparent z-10"
              style={{ background: 'linear-gradient(180deg, rgba(52,144,199,0.20) 0%, rgba(255,255,255,0.00) 70%)' }}
            >
              <div className="relative z-10 pr-20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/70 rounded-xl flex items-center justify-center text-white/90 shadow-sm">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M13 3l-2 2 6 6 2-2-6-6zm-9 9l-1 6 6-1 9-9-5-5-9 9z"/></svg>
                  </div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-semibold text-white">Marketing em construção</h2>
                    <p className="text-white/80 text-sm sm:text-base mt-1">Estamos preparando recursos de fidelização e campanhas.</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-white max-w-md">
                  <div className="rounded-xl bg-white/20 px-4 py-2 text-white border border-white/10">• Cashback e pontos</div>
                  <div className="rounded-xl bg-white/20 px-4 py-2 text-white border border-white/10">• Campanhas e cupons</div>
                </div>
              </div>
              <div className="absolute right-0 bottom-0 h-full w-40 pointer-events-none z-0 opacity-90">
                <WorkerLadderSVG className="w-full h-full drop-shadow-lg" />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2 relative overflow-visible">
          <div
            className="relative w-full rounded-2xl shadow-xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #6d28d9 0%, #3490c7 100%)',
              color: 'white',
              padding: 'clamp(20px, 4vw, 40px) clamp(22px, 4vw, 44px)',
              minHeight: 'clamp(240px, 32vw, 320px)'
            }}
          >
            <div className="relative z-10 max-w-[70%]">
              <div className="flex items-start gap-2">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Zap className="w-6 h-6 text-yellow-300 fill-current" />
                </div>
                <div>
                  <div className="font-extrabold tracking-tight leading-tight" style={{ fontSize: 'clamp(18px, 2.6vw, 26px)' }}>
                    Cashback Ativo ({settings?.[0]?.cashback_percentage ?? 0}%)
                  </div>
                  <p className="text-xs text-white/70 mt-1">Otimizando retenção</p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-4">
                <div>
                  <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
                    <DollarSign className="w-4 h-4" /> Vendas do mês
                  </div>
                  <div className="font-bold text-3xl">
                    {monthlyTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
                    <TrendingUp className="w-4 h-4" /> Retenção
                  </div>
                  <div className="bg-white/20 px-3 py-1 rounded-full text-sm font-semibold inline-block">
                    +{retentionPercent}% de clientes retornando
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <Link to={createPageUrl('Reports')} className="inline-flex items-center gap-2 bg-white text-blue-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-50 transition-colors shadow-sm">
                  Ver Relatório Completo
                </Link>
              </div>
            </div>

            <div className="absolute -right-4 -bottom-4 h-[110%] w-64 pointer-events-none opacity-90 z-0">
              <WorkerScaffoldSVG className="w-full h-full drop-shadow-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import { Zap, DollarSign, TrendingUp } from 'lucide-react'

const WorkerLadderSVG = ({ className }) => (
  <svg viewBox="0 0 200 300" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M60 280L80 20" stroke="white" strokeWidth="6" strokeLinecap="round"/>
    <path d="M140 280L120 20" stroke="white" strokeWidth="6" strokeLinecap="round"/>
    <path d="M65 240H135" stroke="white" strokeWidth="4" strokeLinecap="round"/>
    <path d="M68 190H132" stroke="white" strokeWidth="4" strokeLinecap="round"/>
    <path d="M71 140H129" stroke="white" strokeWidth="4" strokeLinecap="round"/>
    <path d="M74 90H126" stroke="white" strokeWidth="4" strokeLinecap="round"/>
    <g transform="translate(40, 60)">
      <path d="M45 100L40 130" stroke="#334155" strokeWidth="12" strokeLinecap="round"/>
      <path d="M75 100L75 130" stroke="#334155" strokeWidth="12" strokeLinecap="round"/>
      <path d="M60 100V50" stroke="#76cc2e" strokeWidth="24" strokeLinecap="round"/>
      <circle cx="60" cy="35" r="14" fill="#f1f5f9"/>
      <path d="M60 60L90 50" stroke="#76cc2e" strokeWidth="10" strokeLinecap="round"/>
      <rect x="85" y="35" width="8" height="25" rx="2" transform="rotate(-15 85 35)" fill="#3b82f6"/>
    </g>
  </svg>
)

const WorkerScaffoldSVG = ({ className }) => (
  <svg viewBox="0 0 250 300" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="150" width="210" height="10" rx="2" fill="rgba(255,255,255,0.3)"/>
    <path d="M30 300V150" stroke="white" strokeWidth="4" strokeDasharray="10 10" opacity="0.6"/>
    <path d="M220 300V150" stroke="white" strokeWidth="4" strokeDasharray="10 10" opacity="0.6"/>
    <path d="M30 220L220 220" stroke="white" strokeWidth="2" opacity="0.4"/>
    <g transform="translate(140, 105)">
      <path d="M20 50L20 85" stroke="#1e293b" strokeWidth="10" strokeLinecap="round"/>
      <path d="M40 50L50 80" stroke="#1e293b" strokeWidth="10" strokeLinecap="round"/>
      <path d="M30 50L30 10" stroke="#fbbf24" strokeWidth="20" strokeLinecap="round"/>
      <circle cx="30" cy="-5" r="12" fill="#f8fafc"/>
      <path d="M16 -5C16 -13 22 -19 30 -19C38 -19 44 -13 44 -5" stroke="#f59e0b" strokeWidth="4" fill="#f59e0b"/>
      <path d="M30 20L55 25" stroke="#fbbf24" strokeWidth="8" strokeLinecap="round"/>
      <rect x="50" y="5" width="20" height="25" rx="2" fill="white" transform="rotate(10)"/>
      <path d="M55 20L65 10" stroke="#10b981" strokeWidth="2" transform="rotate(10)"/>
    </g>
  </svg>
)

export default function Marketing() {
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
        {/* CARD 1: Glass + Escada */}
        <div className="mb-6 relative group">
          <div className="relative rounded-3xl p-[2px] ring-1 ring-white/30 overflow-visible">
            <div
              className="relative rounded-3xl backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] px-8 py-10 sm:px-12 sm:py-12 bg-transparent z-10"
              style={{ background: 'linear-gradient(180deg, rgba(52,144,199,0.20) 0%, rgba(255,255,255,0.00) 70%)' }}
            >
              <div className="relative z-10 pr-20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/70 rounded-xl flex items-center justify-center text-white/90 shadow-sm">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M13 3l-2 2 6 6 2-2-6-6zm-9 9l-1 6 6-1 9-9-5-5-9 9z"/></svg>
                  </div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-semibold text-white">Marketing em construção</h2>
                    <p className="text-white/80 text-sm sm:text-base mt-1">Estamos preparando recursos de fidelização e campanhas.</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-white max-w-md">
                  <div className="rounded-xl bg-white/20 px-4 py-2 text-white border border-white/10">• Cashback e pontos</div>
                  <div className="rounded-xl bg-white/20 px-4 py-2 text-white border border-white/10">• Campanhas e cupons</div>
                </div>
              </div>
              <div className="absolute right-0 bottom-0 h-full w-40 pointer-events-none z-20 opacity-90">
                <WorkerLadderSVG className="w-full h-full drop-shadow-lg" />
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: Gradiente + Andaime */}
        <div className="pt-2 relative overflow-visible">
          <div
            className="relative w-full rounded-2xl shadow-xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #6d28d9 0%, #3490c7 100%)',
              color: 'white',
              padding: 'clamp(20px, 4vw, 40px) clamp(22px, 4vw, 44px)',
              minHeight: 'clamp(240px, 32vw, 320px)'
            }}
          >
            <div className="relative z-10 max-w-[70%]">
              <div className="flex items-start gap-2">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Zap className="w-6 h-6 text-yellow-300 fill-current" />
                </div>
                <div>
                  <div className="font-extrabold tracking-tight leading-tight" style={{ fontSize: 'clamp(18px, 2.6vw, 26px)' }}>
                    Cashback Ativo ({settings?.[0]?.cashback_percentage ?? 0}%)
                  </div>
                  <p className="text-xs text-white/70 mt-1">Otimizando retenção</p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-4">
                <div>
                  <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
                    <DollarSign className="w-4 h-4" /> Vendas do mês
                  </div>
                  <div className="font-bold text-3xl">
                    {monthlyTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
                    <TrendingUp className="w-4 h-4" /> Retenção
                  </div>
                  <div className="bg-white/20 px-3 py-1 rounded-full text-sm font-semibold inline-block">
                    +{retentionPercent}% de clientes retornando
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <Link to={createPageUrl('Reports')} className="inline-flex items-center gap-2 bg-white text-blue-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-50 transition-colors shadow-sm">
                  Ver Relatório Completo
                </Link>
              </div>
            </div>

            <div className="absolute -right-4 -bottom-4 h-[110%] w-64 pointer-events-none opacity-90 z-20">
              <WorkerScaffoldSVG className="w-full h-full drop-shadow-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import { Zap, DollarSign, TrendingUp } from 'lucide-react'

// --- ILUSTRAÇÕES SVG (Estilo Landing Page) ---

const WorkerLadderSVG = ({ className }) => (
  <svg viewBox="0 0 200 300" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Escada */}
    <path d="M60 280L80 20" stroke="white" strokeWidth="6" strokeLinecap="round"/>
    <path d="M140 280L120 20" stroke="white" strokeWidth="6" strokeLinecap="round"/>
    <path d="M65 240H135" stroke="white" strokeWidth="4" strokeLinecap="round"/>
    <path d="M68 190H132" stroke="white" strokeWidth="4" strokeLinecap="round"/>
    <path d="M71 140H129" stroke="white" strokeWidth="4" strokeLinecap="round"/>
    <path d="M74 90H126" stroke="white" strokeWidth="4" strokeLinecap="round"/>
    
    {/* Personagem */}
    <g transform="translate(40, 60)">
      {/* Perna Esquerda */}
      <path d="M45 100L40 130" stroke="#334155" strokeWidth="12" strokeLinecap="round"/>
      {/* Perna Direita (na escada) */}
      <path d="M75 100L75 130" stroke="#334155" strokeWidth="12" strokeLinecap="round"/>
      {/* Corpo */}
      <path d="M60 100V50" stroke="#76cc2e" strokeWidth="24" strokeLinecap="round"/>
      {/* Cabeça */}
      <circle cx="60" cy="35" r="14" fill="#f1f5f9"/>
      {/* Braço (Segurando ferramenta) */}
      <path d="M60 60L90 50" stroke="#76cc2e" strokeWidth="10" strokeLinecap="round"/>
      {/* Ferramenta (Chave de fenda/Pincel) */}
      <rect x="85" y="35" width="8" height="25" rx="2" transform="rotate(-15 85 35)" fill="#3b82f6"/>
    </g>
  </svg>
)

const WorkerScaffoldSVG = ({ className }) => (
  <svg viewBox="0 0 250 300" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Andaime */}
    <rect x="20" y="150" width="210" height="10" rx="2" fill="rgba(255,255,255,0.3)"/>
    <path d="M30 300V150" stroke="white" strokeWidth="4" strokeDasharray="10 10" opacity="0.6"/>
    <path d="M220 300V150" stroke="white" strokeWidth="4" strokeDasharray="10 10" opacity="0.6"/>
    <path d="M30 220L220 220" stroke="white" strokeWidth="2" opacity="0.4"/>
    
    {/* Personagem Sentado */}
    <g transform="translate(140, 105)">
      {/* Pernas penduradas */}
      <path d="M20 50L20 85" stroke="#1e293b" strokeWidth="10" strokeLinecap="round"/>
      <path d="M40 50L50 80" stroke="#1e293b" strokeWidth="10" strokeLinecap="round"/>
      {/* Corpo */}
      <path d="M30 50L30 10" stroke="#fbbf24" strokeWidth="20" strokeLinecap="round"/>
      {/* Cabeça */}
      <circle cx="30" cy="-5" r="12" fill="#f8fafc"/>
      {/* Capacete */}
      <path d="M16 -5C16 -13 22 -19 30 -19C38 -19 44 -13 44 -5" stroke="#f59e0b" strokeWidth="4" fill="#f59e0b"/>
      {/* Braço segurando gráfico */}
      <path d="M30 20L55 25" stroke="#fbbf24" strokeWidth="8" strokeLinecap="round"/>
      <rect x="50" y="5" width="20" height="25" rx="2" fill="white" transform="rotate(10)"/>
      <path d="M55 20L65 10" stroke="#10b981" strokeWidth="2" transform="rotate(10)"/>
    </g>
  </svg>
)

// --- COMPONENTE PRINCIPAL ---

export default function Marketing() {
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
        
        {/* CARD 1: EM CONSTRUÇÃO (Glassmorphism + Bonequinho na Escada) */}
        <div className="mb-6 relative group">
          <div className="relative rounded-3xl p-[2px] ring-1 ring-white/30 overflow-hidden">
            <div 
              className="relative rounded-3xl backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] px-8 py-10 sm:px-12 sm:py-12 bg-transparent z-10"
              style={{ background: 'linear-gradient(180deg, rgba(52,144,199,0.20) 0%, rgba(255,255,255,0.00) 70%)' }}
            >
              {/* Conteúdo do Texto (Com max-width para não ficar em cima do desenho) */}
              <div className="relative z-10 pr-20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/70 rounded-xl flex items-center justify-center text-white/90 shadow-sm">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M13 3l-2 2 6 6 2-2-6-6zm-9 9l-1 6 6-1 9-9-5-5-9 9z"/></svg>
                  </div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-semibold text-white">Marketing em construção</h2>
                    <p className="text-white/80 text-sm sm:text-base mt-1">Estamos preparando recursos de fidelização e campanhas.</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-white max-w-md">
                  <div className="rounded-xl bg-white/20 px-4 py-2 text-white border border-white/10">• Cashback e pontos</div>
                  <div className="rounded-xl bg-white/20 px-4 py-2 text-white border border-white/10">• Campanhas e cupons</div>
                </div>
              </div>

              {/* BONEQUINHO NA ESCADA (Posicionado Absolute na direita) */}
              <div className="absolute right-0 bottom-0 h-full w-40 pointer-events-none z-0 opacity-90">
                <WorkerLadderSVG className="w-full h-full drop-shadow-lg" />
              </div>

            </div>
          </div>
        </div>

        {/* CARD 2: CASHBACK ATIVO (Gradiente + Bonequinho no Andaime) */}
        <div className="pt-2 relative overflow-visible">
          <div 
            className="relative w-full rounded-2xl shadow-xl overflow-hidden"
            style={{ 
              background: 'linear-gradient(135deg, #6d28d9 0%, #3490c7 100%)', 
              color: 'white', 
              padding: 'clamp(20px, 4vw, 40px) clamp(22px, 4vw, 44px)', 
              minHeight: 'clamp(240px, 32vw, 320px)'
            }}
          >
            {/* Conteúdo (lado esquerdo) */}
            <div className="relative z-10 max-w-[70%]">
              <div className="flex items-start gap-2">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Zap className="w-6 h-6 text-yellow-300 fill-current" />
                </div>
                <div>
                  <div className="font-extrabold tracking-tight leading-tight" style={{ fontSize: 'clamp(18px, 2.6vw, 26px)' }}>
                    Cashback Ativo ({settings?.[0]?.cashback_percentage ?? 0}%)
                  </div>
                  <p className="text-xs text-white/70 mt-1">Otimizando retenção</p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-4">
                <div>
                  <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
                    <DollarSign className="w-4 h-4" /> Vendas do mês
                  </div>
                  <div className="font-bold text-3xl">
                    {monthlyTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
                    <TrendingUp className="w-4 h-4" /> Retenção
                  </div>
                  <div className="bg-white/20 px-3 py-1 rounded-full text-sm font-semibold inline-block">
                    +{retentionPercent}% de clientes retornando
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <Link to={createPageUrl('Reports')} className="inline-flex items-center gap-2 bg-white text-blue-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-50 transition-colors shadow-sm">
                  Ver Relatório Completo
                </Link>
              </div>
            </div>

            {/* BONEQUINHO NO ANDAIME (Posicionado Absolute na direita) */}
            <div className="absolute -right-4 -bottom-4 h-[110%] w-64 pointer-events-none opacity-90 z-0">
              <WorkerScaffoldSVG className="w-full h-full drop-shadow-xl" />
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
