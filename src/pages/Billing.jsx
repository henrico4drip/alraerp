import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'

export default function Billing() {
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const s = params.get('status')
    if (s) {
      setStatus(s)
      if (s === 'success') {
        try { window.localStorage.setItem('subscribed', 'true') } catch {}
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

  const startOneTimePayment = async (plan) => {
    setLoading(true)
    setError('')
    try {
      const API = import.meta.env.VITE_API_URL || 'http://localhost:4242'
      const res = await fetch(`${API}/create-payment-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, user_id: user?.id, user_email: user?.email }),
      })
      const data = await res.json()
      if (data.url) { window.location.href = data.url } else { throw new Error(data?.error?.message || 'Falha ao criar sessão de pagamento') }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const styles = {
    gradientBg: { background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', fontFamily: "'Poppins', sans-serif" },
    glassCard: 'bg-white/15 backdrop-blur-xl border border-white/30 shadow-2xl text-white',
    glassInner: 'bg-black/20 border border-white/10',
    btnPrimary: 'bg-[#76cc2e] hover:bg-[#65b025] text-white shadow-lg transform transition hover:-translate-y-1 font-bold uppercase tracking-wide',
    btnSecondary: 'bg-white/20 hover:bg-white/30 text-white border border-white/40',
    btnBlue: 'bg-blue-600/80 hover:bg-blue-600 text-white backdrop-blur-sm',
  }

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8" style={styles.gradientBg}>
      <div className="w-full max-w-5xl flex justify-between items-center mb-8">
        <div className="text-2xl font-bold text-white">alra<span className="text-sm font-light align-top ml-0.5">erp+</span></div>
        <button onClick={handleLogout} className="text-white/80 hover:text-white text-sm font-medium transition-colors">Sair da conta</button>
      </div>
      <div className="w-full max-w-5xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 drop-shadow-md">Escolha seu plano</h1>
          <p className="text-white/90 text-lg max-w-2xl mx-auto font-light">Assine para liberar todo o potencial do seu ERP e oferecer Cashback.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-8 relative z-10">
          <div className={`rounded-3xl p-8 flex flex-col ${styles.glassCard} hover:bg-white/20 transition duration-300`}>
            <div className="mb-4">
              <h3 className="text-xl font-semibold opacity-90">Plano Mensal</h3>
              <div className="flex items-baseline mt-2"><span className="text-4xl font-bold">R$ 47,90</span><span className="text-sm opacity-70 ml-2">/mês</span></div>
            </div>
            <div className={`p-5 rounded-xl mb-6 flex-grow ${styles.glassInner}`}>
              <ul className="space-y-3 text-sm text-white/90">
                <li className="flex items-center gap-2">✓ Todas funcionalidades do ERP</li>
                <li className="flex items-center gap-2">✓ Sistema de Cashback</li>
                <li className="flex items-center gap-2">✓ Suporte por e-mail</li>
                <li className="flex items-center gap-2">✓ Cancele quando quiser</li>
              </ul>
            </div>
            <div className="space-y-3">
              <button disabled={loading} className={`w-full py-3.5 rounded-xl ${styles.btnPrimary} disabled:opacity-50`} onClick={() => startSubscriptionCheckout('monthly')}>{loading ? 'Processando...' : 'Assinar (Recorrente)'}</button>
              <button disabled={loading} className={`w-full py-3 rounded-xl ${styles.btnBlue} text-sm font-medium disabled:opacity-50`} onClick={() => startOneTimePayment('monthly')}>Pagar Pix/Boleto (1 mês)</button>
            </div>
          </div>
          <div className={`rounded-3xl p-8 flex flex-col border-2 border-[#76cc2e]/50 relative ${styles.glassCard} hover:bg-white/20 transition duration-300`}>
            <div className="absolute -top-4 right-8 bg-[#76cc2e] text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">MAIS POPULAR</div>
            <div className="mb-4">
              <h3 className="text-xl font-semibold opacity-90">Plano Anual</h3>
              <div className="flex items-baseline mt-2"><span className="text-4xl font-bold">R$ 459,84</span><span className="text-sm opacity-70 ml-2">/ano</span></div>
              <div className="text-[#76cc2e] text-sm font-bold mt-1">Economize 20%</div>
            </div>
            <div className={`p-5 rounded-xl mb-6 flex-grow ${styles.glassInner}`}>
              <ul className="space-y-3 text-sm text-white/90">
                <li className="flex items-center gap-2">✓ Tudo do plano mensal</li>
                <li className="flex items-center gap-2">✓ Suporte Prioritário</li>
                <li className="flex items-center gap-2">✓ Consultoria de implantação</li>
                <li className="flex items-center gap-2">✓ Cobrança única anual</li>
              </ul>
            </div>
            <div className="space-y-3">
              <button disabled={loading} className={`w-full py-3.5 rounded-xl ${styles.btnPrimary} disabled:opacity-50`} onClick={() => startSubscriptionCheckout('annual')}>{loading ? 'Processando...' : 'Assinar (Recorrente)'}</button>
              <button disabled={loading} className={`w-full py-3 rounded-xl ${styles.btnBlue} text-sm font-medium disabled:opacity-50`} onClick={() => startOneTimePayment('annual')}>Pagar Pix/Boleto (1 ano)</button>
            </div>
          </div>
        </div>
        {error && (<div className="mt-6 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-center text-white text-sm backdrop-blur-sm">⚠️ {error}</div>)}
        <div className="mt-10 text-center text-white/60">
          <div className="flex flex-wrap justify-center gap-2 mb-3 text-xs font-medium">
            <span className="px-3 py-1 rounded-full bg-white/10">Cartão de Crédito</span>
            <span className="px-3 py-1 rounded-full bg-white/10">Pix</span>
            <span className="px-3 py-1 rounded-full bg-white/10">Apple Pay</span>
            <span className="px-3 py-1 rounded-full bg-white/10">Google Pay</span>
          </div>
          <p className="text-xs max-w-2xl mx-auto leading-relaxed">Pagamentos processados via Stripe. Apple Pay e Google Pay aparecem automaticamente quando disponíveis no seu dispositivo. Pagamentos via Pix/Boleto não renovam automaticamente.</p>
        </div>
      </div>
    </div>
  )
}
