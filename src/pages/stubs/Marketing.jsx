import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import { Zap, DollarSign, TrendingUp, MessageCircle, Star } from 'lucide-react'

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
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customers.list(),
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

  // Algoritmo de Oportunidades
  const opportunities = (customers || [])
    .filter(c => Number(c.cashback_balance || 0) > 0)
    .map(c => {
      const lastSale = sales.find(s => s.customer_id === c.id);
      const lastDate = lastSale ? new Date(lastSale.sale_date) : new Date(0);
      const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

      // Score: Baseado no saldo e na "janela ideal" de retorno (15-60 dias)
      let score = Number(c.cashback_balance || 0) * 0.5;

      if (diffDays >= 15 && diffDays <= 60) score += 40; // Janela quente
      else if (diffDays > 60) score += 20; // Reativação
      else score += 10; // Recente

      return { ...c, score, recency: diffDays };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const handleWhatsAppAction = (customer) => {
    const firstName = customer.name.split(' ')[0];
    const balance = Number(customer.cashback_balance || 0).toFixed(2);
    const msg = `Olá ${firstName}! Tudo bem? Conferi aqui que você tem R$ ${balance} em cashback disponível na nossa loja. 🎁 Que tal aproveitar para nos visitar esta semana?`;
    const phone = String(customer.phone).replace(/\D/g, '');
    if (phone) {
      window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      alert('Cliente sem telefone cadastrado.');
    }
  };

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
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4zM4 11h16v2H4zM4 16h16v2H4z" /></svg>
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
        {/* Oportunidades de Venda */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
            <h2 className="text-lg font-bold text-gray-900">🔥 Oportunidades de Compra</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
              <p className="text-sm text-gray-500 mb-6">Clientes com maior probabilidade de retorno baseada em cashback e data da última compra.</p>

              <div className="space-y-4">
                {opportunities.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm italic">
                    Nenhuma oportunidade identificada no momento.
                  </div>
                ) : opportunities.map((customer) => (
                  <div key={customer.id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/50 hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#3490c7] text-white flex items-center justify-center font-bold text-xs">
                        {customer.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{customer.name}</div>
                        <div className="text-[10px] text-[#3490c7] font-medium uppercase tracking-wider">
                          R$ {Number(customer.cashback_balance).toFixed(2)} de Saldo
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <div className="text-[10px] text-gray-400 uppercase">Última compra</div>
                        <div className="text-xs font-medium text-gray-600">há {customer.recency} dias</div>
                      </div>
                      <button
                        onClick={() => handleWhatsAppAction(customer)}
                        className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 shadow-sm transition-all active:scale-95"
                      >
                        <MessageCircle className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#3490c7] rounded-3xl p-6 text-white relative overflow-hidden flex flex-col justify-between min-h-[200px]">
              <div className="relative z-10">
                <h3 className="text-xl font-black mb-2 leading-tight">IMPULSIONE SUAS VENDAS 🚀</h3>
                <p className="text-[#e1f0f9] text-sm opacity-90 leading-relaxed">
                  Você tem <strong>{opportunities.length} clientes quentes</strong> que não compram há mais de 15 dias e possuem saldo de cashback!
                </p>
              </div>

              <div className="relative z-10 pt-4">
                <div className="text-xs uppercase font-bold tracking-widest opacity-80 mb-2">Dica Pro</div>
                <p className="text-xs italic bg-white/10 p-3 rounded-xl border border-white/20">
                  "O envio de lembretes de cashback aumenta a retenção em até 35% no varejo físico."
                </p>
              </div>

              {/* Efeito decorativo */}
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl text-[#3490c7]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
