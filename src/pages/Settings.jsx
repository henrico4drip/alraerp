import React, { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/ConfirmDialog'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Palette, Wallet, Building2, Crown, ExternalLink, QrCode, Mail, MapPin, Upload, ImageIcon, X } from 'lucide-react'

export default function Settings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState(null)
  const [erpName, setErpName] = useState('')
  const [cashbackPercentage, setCashbackPercentage] = useState(5)
  const [cashbackExpirationDays, setCashbackExpirationDays] = useState(30)
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
          setCashbackExpirationDays(typeof s.cashback_expiration_days === 'number' ? s.cashback_expiration_days : 30)
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
      cashback_expiration_days: Number(cashbackExpirationDays) || 30,
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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-6 pb-32 lg:pb-12">
      <div className="max-w-4xl mx-auto space-y-8">

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Configurações</h1>
          <Button onClick={save} className="rounded-xl bg-blue-600 hover:bg-blue-700 h-10 px-6 shadow-lg shadow-blue-200">
            Salvar Alterações
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12"><LoadingSpinner /></div>
        ) : (
          <div className="space-y-6">

            {/* 1. Identidade Visual */}
            <Card className="shadow-sm border-gray-100 rounded-3xl overflow-hidden">
              <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                  <Palette className="w-5 h-5 text-purple-500" /> Identidade Visual
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  <div className="space-y-3">
                    <Label className="text-gray-600 font-medium">Logo da Loja</Label>
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl w-40 h-40 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer relative group" onClick={() => document.getElementById('logoInput').click()}>
                      {settings?.logo_url ? (
                        <img
                          src={settings.logo_url}
                          alt="Logo"
                          className="w-full h-full object-contain p-4"
                        />
                      ) : (
                        <div className="text-center p-4">
                          <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <span className="text-xs text-gray-400">Adicionar Logo</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity flex items-center justify-center">
                        <Upload className="w-6 h-6 text-gray-600" />
                      </div>
                    </div>
                    <input id="logoInput" type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </div>

                  <div className="flex-1 w-full space-y-4">
                    <div className="space-y-2">
                      <Label className="text-gray-700">Nome do ERP (Nome Fantasia)</Label>
                      <Input
                        value={erpName}
                        onChange={(e) => setErpName(e.target.value)}
                        placeholder="Minha Loja Incrível"
                        className="h-12 rounded-xl text-lg border-gray-200 focus:border-blue-500 bg-white"
                      />
                      <p className="text-xs text-gray-500">Este nome aparecerá no topo do menu e nos comprovantes.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. Financeiro */}
            <Card className="shadow-sm border-gray-100 rounded-3xl overflow-hidden">
              <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                  <Wallet className="w-5 h-5 text-green-500" /> Financeiro
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-8">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-gray-700">Cashback Padrão (%)</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.1"
                        value={cashbackPercentage}
                        onChange={(e) => setCashbackPercentage(e.target.value)}
                        className="h-12 rounded-xl border-gray-200 pr-10 text-lg font-semibold"
                      />
                      <span className="absolute right-4 top-3 text-gray-400 pointer-events-none">%</span>
                    </div>
                    <p className="text-xs text-gray-500">Porcentagem devolvida ao cliente em cada venda.</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700">Validade do Cashback (dias)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={cashbackExpirationDays}
                      onChange={(e) => setCashbackExpirationDays(e.target.value)}
                      className="h-12 rounded-xl border-gray-200 text-lg font-semibold"
                    />
                    <p className="text-xs text-gray-500">Tempo até o saldo expirar se não utilizado.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700">Chave PIX Principal</Label>
                  <div className="relative">
                    <QrCode className="absolute left-3 top-3.5 w-5 h-5 text-gray-400 pointer-events-none" />
                    <Input
                      value={pixKey}
                      onChange={(e) => setPixKey(e.target.value)}
                      placeholder="CPF, CNPJ, Email ou Telefone"
                      className="h-12 pl-12 rounded-xl border-gray-200"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-gray-700">Meios de Pagamento Personalizados</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newPaymentMethod}
                      onChange={(e) => setNewPaymentMethod(e.target.value)}
                      placeholder="Ex: Fiado, Vale Refeição..."
                      className="rounded-xl border-gray-200 h-10"
                      onKeyDown={(e) => e.key === 'Enter' && addPaymentMethod()}
                    />
                    <Button onClick={addPaymentMethod} variant="secondary" className="rounded-xl h-10">Adicionar</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {paymentMethods.map((m) => (
                      <div key={m} className="pl-3 pr-2 py-1.5 bg-gray-100 rounded-lg flex items-center gap-2 border border-gray-200">
                        <span className="text-sm font-medium text-gray-700">{m}</span>
                        <button onClick={() => { setConfirmRemovePaymentMethod(m); setShowConfirmRemovePaymentMethod(true); }} className="p-1 hover:bg-gray-200 rounded-md text-gray-400 hover:text-red-500 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {paymentMethods.length === 0 && <span className="text-sm text-gray-400 italic">Nenhum meio extra configurado.</span>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3. Empresa */}
            <Card className="shadow-sm border-gray-100 rounded-3xl overflow-hidden">
              <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                  <Building2 className="w-5 h-5 text-blue-500" /> Dados da Empresa
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-700">CNPJ</Label>
                    <Input value={companyCnpj} onChange={(e) => setCompanyCnpj(e.target.value)} className="h-11 rounded-xl border-gray-200" placeholder="00.000.000/0000-00" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700">Email de Contato</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
                      <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="h-11 pl-12 rounded-xl border-gray-200" placeholder="contato@empresa.com" />
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-4 gap-4">
                  <div className="md:col-span-1 space-y-2">
                    <Label className="text-gray-700">CEP</Label>
                    <Input value={companyZip} onChange={(e) => setCompanyZip(e.target.value)} className="h-11 rounded-xl border-gray-200" placeholder="00000-000" />
                  </div>
                  <div className="md:col-span-3 space-y-2">
                    <Label className="text-gray-700">Endereço</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
                      <Input value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} className="h-11 pl-12 rounded-xl border-gray-200" placeholder="Rua, Número, Bairro" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-700">Cidade</Label>
                    <Input value={companyCity} onChange={(e) => setCompanyCity(e.target.value)} className="h-11 rounded-xl border-gray-200" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700">Estado (UF)</Label>
                    <Input value={companyState} onChange={(e) => setCompanyState(e.target.value)} className="h-11 rounded-xl border-gray-200" maxLength={2} placeholder="UF" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 4. Assinatura */}
            <Card className="shadow-md border-0 ring-1 ring-gray-100 rounded-3xl overflow-hidden bg-gradient-to-br from-white to-blue-50/30">
              <CardHeader className="bg-white/50 border-b border-gray-100 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                  <Crown className="w-5 h-5 text-amber-500" /> Plano & Assinatura
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Status Atual</p>
                      <p className="text-2xl font-bold text-gray-900 mb-1 capitalize">{settings?.plan_name || 'Free'}</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${settings?.subscription_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                        {settings?.subscription_status || 'Trial'}
                      </span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-50 text-xs text-gray-500">
                      Renovação: {settings?.subscription_end_date ? new Date(settings.subscription_end_date).toLocaleDateString('pt-BR') : 'N/A'}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="font-medium text-gray-900">Gerenciamento</p>
                    <p className="text-sm text-gray-500 leading-snug">Acesse o portal do cliente para downloads de faturas, alteração de cartão ou cancelamento.</p>
                    <Button onClick={manageSubscription} disabled={portalBusy} variant="outline" className="w-full rounded-xl border-gray-300 hover:bg-gray-50 justify-between group">
                      {portalBusy ? 'Abrindo...' : 'Abrir Portal'} <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <p className="font-medium text-gray-900">Upgrade</p>
                    <p className="text-sm text-gray-500 leading-snug">Ganhe descontos exclusivos migrando para o plano anual hoje mesmo.</p>
                    <Button onClick={upgradePlan} disabled={upgradeBusy} className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-200 border-0">
                      {upgradeBusy ? 'Processando...' : 'Mudar para Anual'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        )}
      </div>

      <ConfirmDialog
        open={showConfirmRemovePaymentMethod}
        onOpenChange={setShowConfirmRemovePaymentMethod}
        title="Remover método"
        description={`Tem certeza que deseja remover "${confirmRemovePaymentMethod}"?`}
        confirmText="Remover"
        cancelText="Voltar"
        destructive
        onConfirm={() => {
          if (confirmRemovePaymentMethod) removePaymentMethod(confirmRemovePaymentMethod)
        }}
      />
    </div>
  )
}
