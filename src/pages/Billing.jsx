import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/auth/AuthContext'

export default function Billing() {
  const navigate = useNavigate()
  const { logout } = useAuth()
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
    try {
      await logout()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  const startSubscriptionCheckout = async (plan) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('http://localhost:4242/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error(data?.error?.message || 'Falha ao criar sessão de assinatura')
      }
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
      const res = await fetch('http://localhost:4242/create-payment-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error(data?.error?.message || 'Falha ao criar sessão de pagamento')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl border-0 shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Assinatura confirmada 🎉</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700">Obrigado! Sua assinatura está ativa. Você já pode acessar todas as funcionalidades do ERP.</p>
            <div className="flex gap-3">
              <Button className="rounded-xl" onClick={() => navigate('/dashboard', { replace: true })}>Ir para o Dashboard</Button>
              <Button variant="secondary" className="rounded-xl" onClick={() => navigate('/settings', { replace: true })}>Abrir Configurações</Button>
              <Button className="rounded-xl bg-blue-600 hover:bg-blue-700" onClick={handleLogout}>Sair da conta</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        <div className="flex justify-end mb-2">
          <Button onClick={handleLogout} className="rounded-xl bg-blue-600 hover:bg-blue-700">Sair da conta</Button>
        </div>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Escolha seu plano</h1>
          <p className="text-gray-600 mt-2">Assine para liberar todo o potencial do seu ERP. Pagamento via cartão. Apple Pay/Google Pay aparecem automaticamente quando elegíveis.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-0 shadow rounded-2xl bg-white">
            <CardHeader>
              <CardTitle>Plano Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 border rounded-xl">
                <div className="text-3xl font-bold">R$ 47,90/mês</div>
                <ul className="mt-3 text-sm text-gray-700 space-y-1">
                  <li>• Todas funcionalidades do ERP</li>
                  <li>• Suporte por e-mail</li>
                  <li>• Cancelamento a qualquer momento</li>
                </ul>
                <Button disabled={loading} className="mt-4 w-full rounded-xl" onClick={() => startSubscriptionCheckout('monthly')}>Assinar (Cartão)</Button>
                <Button disabled={loading} className="mt-2 w-full rounded-xl bg-blue-600 hover:bg-blue-700" onClick={() => startOneTimePayment('monthly')}>Pagar Pix/Boleto/Cartão</Button>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow rounded-2xl bg-white">
            <CardHeader>
              <CardTitle>Plano Anual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 border rounded-xl">
                <div className="text-3xl font-bold">R$ 459,84/ano</div>
                <div className="text-sm text-green-700">20% de desconto</div>
                <ul className="mt-3 text-sm text-gray-700 space-y-1">
                  <li>• Todas funcionalidades do ERP</li>
                  <li>• Suporte prioritário</li>
                  <li>• Economia anual</li>
                </ul>
                <Button disabled={loading} variant="secondary" className="mt-4 w-full rounded-xl" onClick={() => startSubscriptionCheckout('annual')}>Assinar (Cartão)</Button>
                <Button disabled={loading} className="mt-2 w-full rounded-xl bg-blue-600 hover:bg-blue-700" onClick={() => startOneTimePayment('annual')}>Pagar Pix/Boleto/Cartão</Button>
              </div>
            </CardContent>
          </Card>
        </div>
        {error && (
          <div className="mt-4 text-center text-red-600 text-sm">{error}</div>
        )}
        {loading && (
          <div className="mt-4 text-center text-sm">Criando sessão de pagamento...</div>
        )}
        <div className="mt-6 text-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">Cartão (Visa, Mastercard, Elo)</span>
            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">Apple Pay</span>
            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">Google Pay</span>
            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">Pix</span>
            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">Boleto</span>
          </div>
          <div className="mt-2 text-gray-500 text-xs">Assinaturas recorrentes: cartão (inclui Apple/Google Pay). Pix/Boleto: pagamento avulso sem recorrência automática.</div>
        </div>
        <div className="mt-6 text-center text-xs text-gray-500">
          Apple Pay e Google Pay são exibidos pelo Stripe quando disponíveis (Apple Pay exige domínio verificado e Safari; Google Pay pode aparecer em Chrome/Android).
        </div>
      </div>
    </div>
  )
}