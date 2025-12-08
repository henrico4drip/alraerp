import React, { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/ConfirmDialog'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function Settings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState(null)
  const [erpName, setErpName] = useState('')
  const [cashbackPercentage, setCashbackPercentage] = useState(5)
  const [paymentMethods, setPaymentMethods] = useState([])
  const [newPaymentMethod, setNewPaymentMethod] = useState('')
  const [pixKey, setPixKey] = useState('')

  // Novos campos do estabelecimento
  const [companyCnpj, setCompanyCnpj] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [companyCity, setCompanyCity] = useState('')
  const [companyState, setCompanyState] = useState('')
  const [companyZip, setCompanyZip] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [portalBusy, setPortalBusy] = useState(false)
  const [upgradeBusy, setUpgradeBusy] = useState(false)
  const [showConfirmRemovePaymentMethod, setShowConfirmRemovePaymentMethod] = useState(false)
  const [confirmRemovePaymentMethod, setConfirmRemovePaymentMethod] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.Settings.list()
        if (list.length > 0) {
          const s = list[0]
          setSettings(s)
          setErpName(s.erp_name || '')
          setCashbackPercentage(typeof s.cashback_percentage === 'number' ? s.cashback_percentage : 5)
          setPaymentMethods(Array.isArray(s.payment_methods) ? s.payment_methods : [])
          setPixKey(s.pix_key || '')
          setCompanyCnpj(s.company_cnpj || '')
          setCompanyAddress(s.company_address || '')
          setCompanyCity(s.company_city || '')
          setCompanyState(s.company_state || '')
          setCompanyZip(s.company_zip || '')
          setContactEmail(s.contact_email || '')
        }
      } catch (err) {
        console.error('Falha ao carregar configurações:', err)
        alert(`Falha ao carregar configurações: ${err?.message || 'erro desconhecido'}`)
      } finally {
        setIsLoading(false)
      }
    })()
  }, [])

  const addPaymentMethod = () => {
    if (!newPaymentMethod.trim()) return
    const next = [...paymentMethods, newPaymentMethod.trim()]
    setPaymentMethods(next)
    setNewPaymentMethod('')
  }

  const removePaymentMethod = (m) => {
    setPaymentMethods(paymentMethods.filter((x) => x !== m))
  }

  const save = async () => {
    const payload = {
      erp_name: erpName,
      cashback_percentage: Number(cashbackPercentage) || 0,
      payment_methods: paymentMethods,
      pix_key: pixKey,
      company_cnpj: companyCnpj,
      company_address: companyAddress,
      company_city: companyCity,
      company_state: companyState,
      company_zip: companyZip,
      contact_email: contactEmail,
    }
    try {
      if (settings) {
        const updated = await base44.entities.Settings.update(settings.id, payload)
        setSettings(updated)
      } else {
        const created = await base44.entities.Settings.create(payload)
        setSettings(created)
      }
      alert('Configurações salvas!')
    } catch (err) {
      console.error('Falha ao salvar configurações:', err)
      alert(`Não foi possível salvar: ${err?.message || 'erro desconhecido'}`)
    }
  }

  const manageSubscription = async () => {
    try {
      setPortalBusy(true)
      const effectiveEmail = (user?.email || contactEmail || '').trim()
      if (!effectiveEmail) {
        alert('Informe o e‑mail de contato ou faça login para abrir o portal.')
        return
      }
      const API = import.meta.env.VITE_API_URL || 'http://localhost:4242'
      const res = await fetch(`${API}/create-portal-session-by-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: effectiveEmail }),
      })
      const json = await res.json()
      if (json?.url) {
        window.location.href = json.url
      } else {
        alert('Não foi possível abrir o portal de assinatura')
      }
    } catch (err) {
      alert('Erro ao abrir o portal de assinatura')
    } finally {
      setPortalBusy(false)
    }
  }

  const upgradePlan = async () => {
    try {
      setUpgradeBusy(true)
      const API = import.meta.env.VITE_API_URL || 'http://localhost:4242'
      const res = await fetch(`${API}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'annual', user_id: user?.id || undefined }),
      })
      const json = await res.json()
      if (json?.url) {
        window.location.href = json.url
      } else {
        alert('Não foi possível iniciar o upgrade')
      }
    } catch (err) {
      alert('Erro ao iniciar o upgrade')
    } finally {
      setUpgradeBusy(false)
    }
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file })
      if (settings) {
        await base44.entities.Settings.update(settings.id, { logo_url: file_url })
        setSettings({ ...settings, logo_url: file_url })
      } else {
        const created = await base44.entities.Settings.create({ logo_url: file_url })
        setSettings(created)
      }
      try { localStorage.setItem('logo_url', file_url) } catch { }
    } catch (err) {
      console.error('Erro ao enviar logo', err)
    }
  }

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Configurações</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="space-y-6">
              {/* Seção de Logo da Loja */}
              <div className="space-y-2">
                <Label>Logo da loja</Label>
                <div className="flex items-center gap-4">
                  {settings?.logo_url ? (
                    <img
                      src={settings.logo_url}
                      alt="Logo"
                      className="h-16 w-auto object-contain"
                      loading="eager"
                      decoding="async"
                      fetchpriority="high"
                      height={64}
                    />
                  ) : (
                    <img
                      src={'/logo-fallback.svg'}
                      alt="Logo"
                      className="h-16 w-auto object-contain opacity-70"
                      loading="eager"
                      decoding="async"
                      fetchpriority="high"
                      height={64}
                    />
                  )}
                  <div>
                    <input
                      id="logoInput"
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <Button type="button" className="rounded-xl" onClick={() => document.getElementById('logoInput').click()}>
                      Trocar logo
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do ERP</Label>
                  <Input value={erpName} onChange={(e) => setErpName(e.target.value)} placeholder="Meu Negócio" />
                </div>
                <div className="space-y-2">
                  <Label>Percentual de Cashback (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={cashbackPercentage}
                    onChange={(e) => setCashbackPercentage(e.target.value)}
                    placeholder="5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Chave PIX</Label>
                  <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="email@exemplo.com, telefone, EVP ou CPF/CNPJ" />
                </div>
                <div className="space-y-2">
                  <Label>E-mail de Contato</Label>
                  <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="contato@minhaloja.com" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Meios de Pagamento (Outros)</Label>
                <div className="flex gap-2">
                  <Input
                    value={newPaymentMethod}
                    onChange={(e) => setNewPaymentMethod(e.target.value)}
                    placeholder="Ex.: Boleto, Transferência, Vale"
                    className="flex-1"
                  />
                  <Button onClick={addPaymentMethod}>Adicionar</Button>
                </div>
                {paymentMethods.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {paymentMethods.map((m) => (
                      <div key={m} className="px-2 py-1 bg-gray-100 rounded-xl flex items-center gap-2">
                        <span>{m}</span>
                        <button className="text-red-600" onClick={() => { setConfirmRemovePaymentMethod(m); setShowConfirmRemovePaymentMethod(true); }}>x</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Dados do Estabelecimento</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input value={companyCnpj} onChange={(e) => setCompanyCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
                  </div>
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <Input value={companyZip} onChange={(e) => setCompanyZip(e.target.value)} placeholder="00000-000" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Endereço</Label>
                    <Input value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} placeholder="Rua, número, bairro" />
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input value={companyCity} onChange={(e) => setCompanyCity(e.target.value)} placeholder="Cidade" />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado (UF)</Label>
                    <Input value={companyState} onChange={(e) => setCompanyState(e.target.value)} placeholder="RS" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={save} className="rounded-xl">Salvar Configurações</Button>
              </div>

              <div className="mt-8">
                <Label className="block mb-2">Assinatura</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border rounded-xl p-4 bg-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Plano atual</p>
                        <p className="text-base font-semibold text-gray-900">{settings?.plan_name || 'Indisponível'}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-700 border border-gray-200">{settings?.subscription_status || (localStorage.getItem('subscribed') === 'true' ? 'active' : (new Date(localStorage.getItem('trial_until') || 0).getTime() > Date.now() ? 'trialing' : 'inactive'))}</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">Renovação: {settings?.subscription_end_date ? new Date(settings.subscription_end_date).toLocaleDateString('pt-BR') : '-'}</div>
                  </div>
                  <div className="border rounded-xl p-4 bg-white">
                    <p className="text-sm text-gray-500">Gerenciar</p>
                    <p className="text-xs text-gray-600 mb-3">Abrir portal para cancelar, trocar forma de pagamento ou alterar plano</p>
                    <Button onClick={manageSubscription} disabled={portalBusy} className="rounded-xl w-full bg-[#3490c7] text-white hover:bg-[#2c8ac2]">{portalBusy ? 'Abrindo...' : 'Abrir Portal de Assinatura'}</Button>
                  </div>
                  <div className="border rounded-xl p-4 bg-white">
                    <p className="text-sm text-gray-500">Upgrade</p>
                    <p className="text-xs text-gray-600 mb-3">Migre para anual com desconto e cobrança imediata no Stripe</p>
                    <Button onClick={upgradePlan} disabled={upgradeBusy} className="rounded-xl w-full bg-[#3490c7] hover:bg-[#2c8ac2] text-white">{upgradeBusy ? 'Processando...' : 'Ir para plano anual'}</Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showConfirmRemovePaymentMethod}
        onOpenChange={setShowConfirmRemovePaymentMethod}
        title="Remover método de pagamento"
        description={`Remover o método de pagamento "${confirmRemovePaymentMethod}"?`}
        confirmText="Remover"
        cancelText="Cancelar"
        destructive
        onConfirm={() => {
          if (confirmRemovePaymentMethod) removePaymentMethod(confirmRemovePaymentMethod)
        }}
      />
    </div>
  )
}
