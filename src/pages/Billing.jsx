import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'

export default function Billing() {
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [openFaq, setOpenFaq] = useState(null)
  const [billingCycle, setBillingCycle] = useState('monthly') // 'monthly' | 'annual'

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const s = params.get('status')
    if (s) {
      setStatus(s)
      if (s === 'success') {
        try { window.localStorage.setItem('subscribed', 'true') } catch { }
      }
    }
  }, [])

  const handleLogout = async () => {
    try { await logout() } finally { navigate('/login', { replace: true }) }
  }

  const startSubscriptionCheckout = async (plan) => {
    setLoading(true)
    setError('')
    try {
      const API = import.meta.env.VITE_API_URL || 'http://localhost:4242'
      const res = await fetch(`${API}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, user_id: user?.id, user_email: user?.email }),
      })
      const data = await res.json()
      if (data.url) { window.location.href = data.url } else { throw new Error(data?.error?.message || 'Falha ao criar sessão de assinatura') }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  const faqItems = [
    {
      question: 'Como funciona o período grátis?',
      answer: 'Ao se cadastrar, você tem 7 dias para testar todas as funcionalidades do plano escolhido sem nenhum custo. Se não gostar, basta cancelar antes do término do período e você não será cobrado.',
    },
    {
      question: 'Posso cancelar a qualquer momento?',
      answer: 'Sim! Não há fidelidade em nenhum plano. Você pode cancelar sua assinatura a qualquer momento diretamente pelo painel de configurações, sem burocracia.',
    },
    {
      question: 'Tem suporte técnico?',
      answer: 'Sim! No plano Starter você tem suporte por e-mail. No Pro, suporte prioritário por WhatsApp. E no Business, suporte VIP com atendimento dedicado.',
    },
    {
      question: 'Posso trocar de plano depois?',
      answer: 'Claro! Você pode fazer upgrade ou downgrade a qualquer momento. A diferença de valor é calculada proporcionalmente (pro-rata).',
    },
    {
      question: 'Os dados são seguros?',
      answer: 'Sim! Seus dados são hospedados em servidores brasileiros com criptografia de ponta a ponta. Fazemos backups automáticos diariamente.',
    },
  ]

  // ── Plan Definitions ──
  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      tagline: 'Para quem está começando',
      monthlyPrice: 97,
      annualPrice: 970, // ~2 meses grátis
      highlight: false,
      badge: null,
      features: [
        { name: 'Dashboard com métricas', included: true },
        { name: 'Caixa / PDV completo', included: true },
        { name: 'Gestão de estoque', included: true },
        { name: 'Cadastro de clientes', included: true },
        { name: 'Histórico de vendas', included: true },
        { name: 'Relatórios básicos', included: true },
        { name: 'Agenda e Tarefas', included: true },
        { name: 'Sistema de Cashback', included: true },
        { name: 'Portal do Cliente', included: true },
        { name: 'Suporte por e-mail', included: true },
        { name: 'Até 500 produtos', included: true },
        { name: 'Usuários', value: '1' },
        { name: 'Contas a pagar/receber', included: false },
        { name: 'Pix QR automático', included: false },
        { name: 'CRM com WhatsApp', included: false },
        { name: 'Funil de vendas (Kanban)', included: false },
        { name: 'Marketing IA', included: false },
        { name: 'Ranking de Leads IA', included: false },
        { name: 'Preço atacado/varejo', included: false },
        { name: 'Gestão de equipe', included: false },
      ],
      checkoutPlan: billingCycle === 'monthly' ? 'starter_monthly' : 'starter_annual',
    },
    {
      id: 'pro',
      name: 'Pro',
      tagline: 'O mais escolhido',
      monthlyPrice: 197,
      annualPrice: 1970,
      highlight: true,
      badge: 'MAIS POPULAR',
      features: [
        { name: 'Tudo do Starter, mais:', section: true },
        { name: 'Dashboard com métricas', included: true },
        { name: 'Caixa / PDV completo', included: true },
        { name: 'Gestão de estoque', included: true },
        { name: 'Cadastro de clientes', included: true },
        { name: 'Histórico de vendas', included: true },
        { name: 'Relatórios avançados', included: true },
        { name: 'Agenda e Tarefas (Kanban)', included: true },
        { name: 'Sistema de Cashback', included: true },
        { name: 'Portal do Cliente', included: true },
        { name: 'Contas a pagar/receber', included: true },
        { name: 'Pix QR automático', included: true },
        { name: 'CRM com WhatsApp', included: true },
        { name: 'Funil de vendas (Kanban)', included: true },
        { name: 'Preço atacado/varejo', included: true },
        { name: 'Suporte prioritário', included: true },
        { name: 'Até 2.000 produtos', included: true },
        { name: 'Usuários', value: '3' },
        { name: 'Marketing IA', included: false },
        { name: 'Ranking de Leads IA', included: false },
      ],
      checkoutPlan: billingCycle === 'monthly' ? 'pro_monthly' : 'pro_annual',
    },
    {
      id: 'business',
      name: 'Business',
      tagline: 'Para escalar seu negócio',
      monthlyPrice: 347,
      annualPrice: 3470,
      highlight: false,
      badge: '🚀 COMPLETO',
      features: [
        { name: 'Tudo do Pro, mais:', section: true },
        { name: 'Dashboard com métricas', included: true },
        { name: 'Caixa / PDV completo', included: true },
        { name: 'Gestão de estoque ilimitada', included: true },
        { name: 'Cadastro de clientes', included: true },
        { name: 'Histórico de vendas', included: true },
        { name: 'Relatórios avançados', included: true },
        { name: 'Agenda e Tarefas (Kanban)', included: true },
        { name: 'Sistema de Cashback', included: true },
        { name: 'Portal do Cliente', included: true },
        { name: 'Contas a pagar/receber', included: true },
        { name: 'Pix QR automático', included: true },
        { name: 'CRM com WhatsApp', included: true },
        { name: 'Funil de vendas (Kanban)', included: true },
        { name: 'Preço atacado/varejo', included: true },
        { name: 'Marketing IA completo', included: true },
        { name: 'Ranking de Leads IA', included: true },
        { name: 'Gestão de equipe e permissões', included: true },
        { name: 'Produtos ilimitados', included: true },
        { name: 'Usuários', value: 'Ilimitados' },
        { name: 'Suporte VIP com WhatsApp', included: true },
        { name: 'Consultoria de implantação', included: true },
      ],
      checkoutPlan: billingCycle === 'monthly' ? 'business_monthly' : 'business_annual',
    },
  ]

  const differentials = [
    { icon: '🇧🇷', title: '100% em português', desc: 'Interface e suporte totalmente em português.' },
    { icon: '🖥️', title: 'Servidor brasileiro', desc: 'Hospedagem local para velocidade máxima.' },
    { icon: '💬', title: 'CRM com WhatsApp', desc: 'Funil de vendas integrado ao WhatsApp.' },
    { icon: '💰', title: 'Cashback integrado', desc: 'Fidelize clientes com cashback automático.' },
    { icon: '🤖', title: 'Inteligência Artificial', desc: 'Marketing e leads analisados por IA.' },
    { icon: '📱', title: 'Funciona no celular', desc: 'PWA instalável como app nativo.' },
  ]

  const styles = {
    gradientBg: { background: 'linear-gradient(180deg, #4fa6dd 0%, #5eaef5 40%, #6db8f9 100%)', fontFamily: "'Poppins', sans-serif" },
    glassCard: 'bg-white/15 backdrop-blur-xl border border-white/30 shadow-2xl text-white',
    glassInner: 'bg-black/20 border border-white/10',
    btnPrimary: 'bg-[#76cc2e] hover:bg-[#65b025] text-white shadow-lg transform transition hover:-translate-y-1 font-bold uppercase tracking-wide',
    btnSecondary: 'bg-white/20 hover:bg-white/30 text-white border border-white/40',
  }

  /* ── Success Screen ── */
  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={styles.gradientBg}>
        <div className={`w-full max-w-2xl rounded-3xl p-8 ${styles.glassCard} text-center`}>
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 bg-[#76cc2e] rounded-full flex items-center justify-center text-4xl shadow-lg">🎉</div>
          </div>
          <h2 className="text-3xl font-bold mb-4">Assinatura confirmada!</h2>
          <p className="text-white/80 mb-8 text-lg">Obrigado! Sua assinatura está ativa. Você já pode acessar todas as funcionalidades do AlraERP+.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className={`px-8 py-3 rounded-full ${styles.btnPrimary}`} onClick={() => navigate('/dashboard', { replace: true })}>Ir para o Dashboard</button>
            <button className={`px-8 py-3 rounded-full ${styles.btnSecondary}`} onClick={() => navigate('/settings', { replace: true })}>Configurações</button>
            <button className="px-8 py-3 rounded-full text-white/70 hover:text-white hover:underline" onClick={handleLogout}>Sair</button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Main Billing Page ── */
  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8" style={styles.gradientBg}>

      {/* ── Header ── */}
      <div className="w-full max-w-7xl flex justify-between items-center mb-8 px-2">
        <Link to="/" className="text-white hover:opacity-90 transition-opacity">
          <div className="logo text-2xl font-bold">alra<span className="text-sm font-light align-top ml-0.5">erp+</span></div>
        </Link>
        <div className="flex items-center gap-4">
          {user && (
            <button onClick={handleLogout} className="text-white/80 hover:text-white text-sm font-medium transition-colors">Sair da conta</button>
          )}
        </div>
      </div>

      {/* ── Headline ── */}
      <div className="text-center mb-6">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 drop-shadow-md">Escolha seu plano</h1>
        <p className="text-white/90 text-lg max-w-2xl mx-auto font-light">Tudo que você precisa para gerenciar e escalar seu negócio.</p>
      </div>

      {/* ── Guarantee Badge ── */}
      <div className="mb-6">
        <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full ${styles.glassCard}`} style={{ animation: 'pulse-soft 3s ease-in-out infinite' }}>
          <span className="text-2xl">🛡️</span>
          <span className="font-semibold text-sm md:text-base">7 dias grátis para testar. Cancele quando quiser.</span>
        </div>
      </div>

      {/* ── Billing Cycle Toggle ── */}
      <div className="mb-12 flex items-center gap-3">
        <div className={`inline-flex items-center rounded-full p-1 ${styles.glassCard}`}>
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${billingCycle === 'monthly' ? 'bg-white text-blue-700 shadow-md' : 'text-white/80 hover:text-white'
              }`}
          >
            Mensal
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${billingCycle === 'annual' ? 'bg-white text-blue-700 shadow-md' : 'text-white/80 hover:text-white'
              }`}
          >
            Anual
          </button>
        </div>
        {billingCycle === 'annual' && (
          <span className="text-xs bg-[#76cc2e] text-white px-3 py-1 rounded-full font-bold animate-in zoom-in-95 duration-300 shadow-md">
            Economize 2 meses! 🎉
          </span>
        )}
      </div>

      {/* ── Plan Cards ── */}
      <div className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10 mb-12 px-2">
        {plans.map((plan) => {
          const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.annualPrice
          const perMonth = billingCycle === 'annual' ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice

          return (
            <div
              key={plan.id}
              className={`rounded-3xl p-6 md:p-8 flex flex-col relative transition duration-300
                ${plan.highlight
                  ? `${styles.glassCard} border-2 border-[#76cc2e]/60 hover:bg-white/20 ring-2 ring-[#76cc2e]/30 shadow-[0_0_40px_rgba(118,204,46,0.15)] md:-mt-4 md:mb-4`
                  : `${styles.glassCard} hover:bg-white/20`
                }`}
            >
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#76cc2e] text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg whitespace-nowrap z-10">
                  {plan.badge}
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-5 mt-1">
                <h3 className="text-xl font-bold opacity-95">{plan.name}</h3>
                <p className="text-white/60 text-xs mt-1">{plan.tagline}</p>

                <div className="flex items-baseline justify-center mt-4">
                  <span className="text-lg text-white/60">R$</span>
                  <span className="text-5xl font-bold mx-1">{perMonth}</span>
                  <span className="text-sm opacity-70">/mês</span>
                </div>

                {billingCycle === 'annual' && (
                  <div className="mt-1">
                    <span className="text-white/50 text-xs line-through mr-2">R$ {plan.monthlyPrice * 12}/ano</span>
                    <span className="text-white text-xs font-bold">R$ {plan.annualPrice}/ano</span>
                  </div>
                )}
              </div>

              {/* Features List */}
              <div className={`rounded-xl mb-6 flex-grow overflow-hidden ${styles.glassInner}`}>
                <div className="divide-y divide-white/5">
                  {plan.features.map((feat, i) => {
                    if (feat.section) {
                      return (
                        <div key={i} className="px-4 py-2 bg-white/5">
                          <span className="text-xs font-bold text-white uppercase tracking-wider">{feat.name}</span>
                        </div>
                      )
                    }
                    return (
                      <div key={i} className={`flex items-center justify-between px-4 py-2.5 ${i % 2 === 0 ? 'bg-white/[0.03]' : ''}`}>
                        <span className={`text-xs ${feat.included !== false ? 'text-white/90' : 'text-white/30'}`}>{feat.name}</span>
                        <span className="ml-2 flex-shrink-0">
                          {feat.value
                            ? <span className="text-xs font-bold text-white">{feat.value}</span>
                            : feat.included
                              ? <span className="text-white text-sm font-bold">✓</span>
                              : <span className="text-white/20 text-sm">✕</span>
                          }
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* CTA */}
              <div className="space-y-2 mt-auto">
                <button
                  disabled={loading}
                  className={`w-full py-3.5 rounded-xl text-sm ${plan.highlight
                    ? `${styles.btnPrimary} disabled:opacity-50`
                    : `${styles.btnSecondary} disabled:opacity-50 hover:-translate-y-1 transform transition`
                    }`}
                  onClick={() => startSubscriptionCheckout(plan.checkoutPlan)}
                >
                  {loading ? 'Processando...' : 'Começar 7 dias grátis'}
                </button>
                <p className="text-center text-white/40 text-[10px]">Sem compromisso · Cancele a qualquer momento</p>
              </div>
            </div>
          )
        })}
      </div>

      {error && (<div className="w-full max-w-lg mb-8 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-center text-white text-sm backdrop-blur-sm">⚠️ {error}</div>)}

      {/* ── Comparison Table (Desktop) ── */}
      <div className="w-full max-w-5xl mb-12 hidden lg:block">
        <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-8 drop-shadow-md">Compare os planos</h2>
        <div className={`rounded-2xl overflow-hidden ${styles.glassCard}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-4 px-6 text-white/70 font-medium w-1/3">Recurso</th>
                <th className="text-center py-4 px-4 text-white font-bold">Starter<br /><span className="text-white/50 text-xs font-normal">R$ {plans[0].monthlyPrice}/mês</span></th>
                <th className="text-center py-4 px-4 font-bold" style={{ background: 'rgba(118,204,46,0.1)' }}>Pro<br /><span className="text-white/50 text-xs font-normal">R$ {plans[1].monthlyPrice}/mês</span></th>
                <th className="text-center py-4 px-4 text-white font-bold">Business<br /><span className="text-white/50 text-xs font-normal">R$ {plans[2].monthlyPrice}/mês</span></th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Dashboard', s: true, p: true, b: true },
                { name: 'Caixa / PDV', s: true, p: true, b: true },
                { name: 'Gestão de estoque', s: 'Até 500', p: 'Até 2.000', b: 'Ilimitado' },
                { name: 'Cadastro de clientes', s: true, p: true, b: true },
                { name: 'Histórico de vendas', s: true, p: true, b: true },
                { name: 'Relatórios', s: 'Básicos', p: 'Avançados', b: 'Avançados' },
                { name: 'Agenda e Tarefas', s: true, p: true, b: true },
                { name: 'Sistema de Cashback', s: true, p: true, b: true },
                { name: 'Portal do Cliente', s: true, p: true, b: true },
                { name: 'Contas a pagar/receber', s: false, p: true, b: true },
                { name: 'Pix QR automático', s: false, p: true, b: true },
                { name: 'CRM com WhatsApp', s: false, p: true, b: true },
                { name: 'Funil de vendas (Kanban)', s: false, p: true, b: true },
                { name: 'Preço atacado/varejo', s: false, p: true, b: true },
                { name: 'Marketing IA', s: false, p: false, b: true },
                { name: 'Ranking de Leads IA', s: false, p: false, b: true },
                { name: 'Gestão de equipe', s: false, p: false, b: true },
                { name: 'Usuários', s: '1', p: '3', b: 'Ilimitados' },
                { name: 'Suporte', s: 'E-mail', p: 'Prioritário', b: 'VIP WhatsApp' },
              ].map((row, i) => (
                <tr key={i} className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-white/[0.03]' : ''}`}>
                  <td className="py-3 px-6 text-white/90 text-xs font-medium">{row.name}</td>
                  {[row.s, row.p, row.b].map((val, j) => (
                    <td key={j} className={`py-3 px-4 text-center ${j === 1 ? 'bg-white/[0.03]' : ''}`}>
                      {val === true
                        ? <span className="text-white font-bold">✓</span>
                        : val === false
                          ? <span className="text-white/20">✕</span>
                          : <span className="text-xs font-semibold text-white/80">{val}</span>
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Differentials ── */}
      <div className="w-full max-w-5xl mb-12">
        <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-8 drop-shadow-md">Por que escolher o AlraERP+?</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {differentials.map((d, i) => (
            <div key={i} className={`rounded-2xl p-4 text-center ${styles.glassCard} hover:bg-white/20 transition duration-300 hover:-translate-y-1 transform`}>
              <div className="text-3xl mb-2">{d.icon}</div>
              <h3 className="font-semibold text-xs mb-1">{d.title}</h3>
              <p className="text-white/50 text-[10px] leading-relaxed">{d.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FAQ ── */}
      <div className="w-full max-w-2xl mb-12">
        <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-8 drop-shadow-md">Perguntas frequentes</h2>
        <div className="space-y-3">
          {faqItems.map((item, i) => (
            <div
              key={i}
              className={`rounded-2xl overflow-hidden transition-all duration-300 ${styles.glassCard} cursor-pointer`}
              onClick={() => toggleFaq(i)}
            >
              <div className="flex items-center justify-between p-5">
                <span className="font-medium text-sm md:text-base pr-4">{item.question}</span>
                <span
                  className="text-xl transition-transform duration-300 flex-shrink-0"
                  style={{ transform: openFaq === i ? 'rotate(45deg)' : 'rotate(0deg)' }}
                >
                  +
                </span>
              </div>
              <div
                className="overflow-hidden transition-all duration-300"
                style={{
                  maxHeight: openFaq === i ? '200px' : '0px',
                  opacity: openFaq === i ? 1 : 0,
                }}
              >
                <p className="px-5 pb-5 text-white/70 text-sm leading-relaxed">{item.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Payment Methods ── */}
      <div className="w-full max-w-2xl mb-8 text-center text-white/60">
        <div className="flex flex-wrap justify-center gap-2 mb-3 text-xs font-medium">
          <span className="px-3 py-1 rounded-full bg-white/10">Cartão de Crédito</span>
          <span className="px-3 py-1 rounded-full bg-white/10">Pix</span>
          <span className="px-3 py-1 rounded-full bg-white/10">Apple Pay</span>
          <span className="px-3 py-1 rounded-full bg-white/10">Google Pay</span>
        </div>
        <p className="text-xs max-w-2xl mx-auto leading-relaxed">Pagamentos processados via Stripe. Apple Pay e Google Pay aparecem automaticamente quando disponíveis no seu dispositivo.</p>
      </div>

      {/* ── Pulse animation keyframes ── */}
      <style>{`
        @keyframes pulse-soft {
          0%, 100% { box-shadow: 0 0 0 0 rgba(118, 204, 46, 0.3); }
          50% { box-shadow: 0 0 20px 6px rgba(118, 204, 46, 0.15); }
        }
      `}</style>
    </div>
  )
}
