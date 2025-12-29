import React, { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/ConfirmDialog'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Palette, Wallet, Building2, Crown, ExternalLink, QrCode, Mail, MapPin, Upload, ImageIcon, X, Users, Package } from 'lucide-react'
import { useEffectiveSettings } from '@/hooks/useEffectiveSettings'
import { useTutorial } from '@/hooks/useTutorial'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import SubscriptionLockOverlay from '@/components/SubscriptionLockOverlay'
import RequirePermission from '@/components/RequirePermission'
import FiscalSettings from '@/pages/settings/FiscalSettings'
import WhatsappSettings from '@/pages/settings/WhatsappSettings'

export default function Settings() {
  const { user } = useAuth()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  // Staff State
  const [staffList, setStaffList] = useState([])
  const [showStaffDialog, setShowStaffDialog] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null)
  const [staffForm, setStaffForm] = useState({ name: '', pin: '', role: 'staff', permissions: {} })

  // Settings State
  const [isLoading, setIsLoading] = useState(true)
  const [settings, setSettings] = useState(null)
  const [erpName, setErpName] = useState('')
  const [slug, setSlug] = useState('')
  const [cashbackPercentage, setCashbackPercentage] = useState(5)
  const [cashbackExpirationDays, setCashbackExpirationDays] = useState(30)
  const [paymentMethods, setPaymentMethods] = useState([])
  const [pixKey, setPixKey] = useState('')
  const [companyCnpj, setCompanyCnpj] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [companyCity, setCompanyCity] = useState('')
  const [companyState, setCompanyState] = useState('')
  const [companyZip, setCompanyZip] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [newPaymentMethod, setNewPaymentMethod] = useState('')
  const [showConfirmRemovePaymentMethod, setShowConfirmRemovePaymentMethod] = useState(false)
  const [methodToRemove, setMethodToRemove] = useState(null)
  const [portalBusy, setPortalBusy] = useState(false)

  // Wholesale State
  const [wholesaleEnabled, setWholesaleEnabled] = useState(false)
  const [wholesaleType, setWholesaleType] = useState('global') // 'global' | 'item'
  const [wholesaleMinCount, setWholesaleMinCount] = useState(5)

  useEffect(() => {
    loadStaff()
  }, [])

  const loadStaff = async () => {
    try {
      const list = await base44.entities.Staff.list()
      setStaffList(list)
    } catch (err) { console.error(err) }
  }

  const openStaffDialog = (member = null) => {
    setEditingStaff(member)
    if (member) {
      setStaffForm({ ...member })
    } else {
      setStaffForm({ name: '', pin: '', role: 'staff', permissions: {} })
    }
    setShowStaffDialog(true)
  }

  const saveStaff = async () => {
    if (!staffForm.name || !staffForm.pin) return alert('Nome e PIN são obrigatórios')
    try {
      if (editingStaff) {
        await base44.entities.Staff.update(editingStaff.id, staffForm)
      } else {
        await base44.entities.Staff.create(staffForm)
      }
      setShowStaffDialog(false)
      loadStaff()
    } catch (err) { alert('Erro ao salvar') }
  }

  const deleteStaff = async (id) => {
    if (!confirm('Remover membro?')) return
    try {
      await base44.entities.Staff.delete(id)
      loadStaff()
    } catch (err) { alert('Erro ao remover') }
  }

  const effective = useEffectiveSettings()
  const { restartTutorial, startTutorial } = useTutorial()
  const handleRestartTutorial = () => {
    try { localStorage.removeItem('tutorial_completed') } catch { }
    if (typeof restartTutorial === 'function') restartTutorial()
    else if (typeof startTutorial === 'function') startTutorial()
  }
  useEffect(() => {
    if (!effective) return
    setSettings(effective)
    setErpName(effective.erp_name || '')
    setSlug(effective.slug || '')
    setCashbackPercentage(typeof effective.cashback_percentage === 'number' ? effective.cashback_percentage : 5)
    setCashbackExpirationDays(typeof effective.cashback_expiration_days === 'number' ? effective.cashback_expiration_days : 30)
    setPaymentMethods(Array.isArray(effective.payment_methods) ? effective.payment_methods : [])
    setPixKey(effective.pix_key || '')
    setCompanyCnpj(effective.company_cnpj || '')
    setCompanyAddress(effective.company_address || '')
    setCompanyCity(effective.company_city || '')
    setCompanyState(effective.company_state || '')
    setCompanyZip(effective.company_zip || '')
    setCompanyEmail(effective.contact_email || '')
    setCompanyPhone(effective.company_phone || '')

    // Wholesale load
    setWholesaleEnabled(!!effective.wholesale_enabled)
    setWholesaleType(effective.wholesale_type || 'global')
    setWholesaleMinCount(typeof effective.wholesale_min_count === 'number' ? effective.wholesale_min_count : 5)

    setIsLoading(false)
  }, [effective])

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
      slug: slug ? slug.toLowerCase().replace(/[^a-z0-9-]/g, '-') : undefined,
      cashback_percentage: Number(cashbackPercentage) || 0,
      cashback_expiration_days: Number(cashbackExpirationDays) || 30,
      payment_methods: paymentMethods,
      pix_key: pixKey,
      company_cnpj: companyCnpj,
      company_address: companyAddress,
      company_city: companyCity,
      company_state: companyState,
      company_zip: companyZip,
      contact_email: companyEmail,
      company_phone: companyPhone,
      // Wholesale save
      wholesale_enabled: wholesaleEnabled,
      wholesale_type: wholesaleType,
      wholesale_min_count: Number(wholesaleMinCount) || 1,
    }
    try {
      if (settings) {
        const updated = await base44.entities.Settings.update(settings.id, payload)
        setSettings(updated)
        try { localStorage.setItem('settings', JSON.stringify([updated])) } catch { }
      } else {
        const created = await base44.entities.Settings.create(payload)
        setSettings(created)
        try { localStorage.setItem('settings', JSON.stringify([created])) } catch { }
      }
      alert('Configurações salvas!')
    } catch (err) {
      console.error('Falha ao salvar configurações:', err)
      alert(`Não foi possível salvar: ${err?.message || 'erro desconhecido'}`)
    }
  }

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const patch = {
          wholesale_enabled: wholesaleEnabled,
          wholesale_type: wholesaleType,
          wholesale_min_count: Number(wholesaleMinCount) || 1,
        }
        if (settings) {
          const updated = await base44.entities.Settings.update(settings.id, patch)
          setSettings(updated)
          try { localStorage.setItem('settings', JSON.stringify([updated])) } catch { }
        }
      } catch { }
    }, 300)
    return () => clearTimeout(timer)
  }, [wholesaleEnabled, wholesaleType, wholesaleMinCount])

  const manageSubscription = async () => {
    try {
      setPortalBusy(true)
      const effectiveEmail = (user?.email || companyEmail || '').trim()
      if (!effectiveEmail) {
        alert('Informe o e‑mail de contato ou faça login para abrir o portal.')
        return
      }
      const API = import.meta.env.VITE_API_URL || 'http://localhost:4242'
      const SITE = 'https://alraerp.com.br'
      const returnUrl = `${SITE}/settings`
      const res = await fetch(`${API}/create-portal-session-by-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: effectiveEmail, returnUrl }),
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
    <RequirePermission permission="settings">
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
                <CardContent className="p-6 space-y-6" data-tutorial="store-settings">
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

                      <div className="space-y-2">
                        <Label className="text-gray-700">Link Personalizado da Loja (Slug)</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 text-sm">alraerp.com.br/</span>
                          <Input
                            value={slug}
                            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                            placeholder="minha-loja"
                            className="h-12 rounded-xl text-lg border-gray-200 focus:border-blue-500 bg-white"
                          />
                          <span className="text-gray-400 text-sm">/cashback</span>
                        </div>
                        <p className="text-xs text-gray-500">Identificador único para o link de consulta de saldo enviado no WhatsApp.</p>
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
                    <div className="space-y-2" data-tutorial="cashback-settings">
                      <Label className="text-gray-700">Cashback Padrão (%)</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step="0.1"
                          value={cashbackPercentage}
                          onChange={(e) => setCashbackPercentage(e.target.value)}
                          className="h-12 rounded-xl border-gray-200 pr-12 text-lg font-semibold"
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
                      <Input
                        value={pixKey}
                        onChange={(e) => setPixKey(e.target.value)}
                        placeholder="CPF, CNPJ, Email ou Telefone"
                        className="h-12 pr-12 rounded-xl border-gray-200"
                      />
                      <QrCode className="absolute right-3 top-3.5 w-5 h-5 text-gray-400 pointer-events-none" />
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
                          <button onClick={() => { setMethodToRemove(m); setShowConfirmRemovePaymentMethod(true); }} className="p-1 hover:bg-gray-200 rounded-md text-gray-400 hover:text-red-500 transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {paymentMethods.length === 0 && <span className="text-sm text-gray-400 italic">Nenhum meio extra configurado.</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tutorial */}
              <Card className="shadow-sm border-gray-100 rounded-3xl overflow-hidden">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                    <Users className="w-5 h-5 text-blue-600" /> Tutorial do Sistema
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Recomece o passo a passo guiado para aprender os atalhos e fluxos.</p>
                    <Button onClick={handleRestartTutorial} className="rounded-xl bg-blue-600 hover:bg-blue-700">Reiniciar Tutorial</Button>
                  </div>
                </CardContent>
              </Card>

              {/* Wholesale Settings (New) */}
              <Card className="shadow-sm border-gray-100 rounded-3xl overflow-hidden">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                    <Package className="w-5 h-5 text-amber-600" /> Atacado & Varejo
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="wholesaleEnabled"
                      checked={wholesaleEnabled}
                      onChange={(e) => setWholesaleEnabled(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Label htmlFor="wholesaleEnabled" className="text-base font-medium text-gray-900 cursor-pointer">
                      Vender em Atacado?
                    </Label>
                  </div>

                  {wholesaleEnabled && (
                    <div className="pl-8 space-y-6 border-l-2 border-gray-100 ml-2 animate-in slide-in-from-top-2">
                      <div className="space-y-3">
                        <Label className="text-gray-700 font-semibold">Regra de Ativação do Preço de Atacado</Label>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div
                            onClick={() => setWholesaleType('global')}
                            className={`cursor-pointer border-2 rounded-2xl p-4 transition-all hover:bg-gray-50 ${wholesaleType === 'global' ? 'border-blue-500 bg-blue-50/30' : 'border-gray-200'}`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${wholesaleType === 'global' ? 'border-blue-600' : 'border-gray-300'}`}>
                                {wholesaleType === 'global' && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                              </div>
                              <span className="font-semibold text-gray-900">Misto (Global)</span>
                            </div>
                            <p className="text-sm text-gray-500">
                              O cliente paga preço de atacado se levar <strong>{wholesaleMinCount} ou mais unidades</strong> somando qualquer produto do carrinho.
                            </p>
                          </div>

                          <div
                            onClick={() => setWholesaleType('item')}
                            className={`cursor-pointer border-2 rounded-2xl p-4 transition-all hover:bg-gray-50 ${wholesaleType === 'item' ? 'border-blue-500 bg-blue-50/30' : 'border-gray-200'}`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${wholesaleType === 'item' ? 'border-blue-600' : 'border-gray-300'}`}>
                                {wholesaleType === 'item' && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                              </div>
                              <span className="font-semibold text-gray-900">Por Item</span>
                            </div>
                            <p className="text-sm text-gray-500">
                              O preço de atacado aplica-se apenas aos itens que tiverem <strong>{wholesaleMinCount} ou mais unidades</strong> do mesmo produto.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 max-w-xs">
                        <Label className="text-gray-700">Quantidade Mínima (X)</Label>
                        <Input
                          type="number"
                          min="1"
                          value={wholesaleMinCount}
                          onChange={(e) => setWholesaleMinCount(e.target.value)}
                          className="h-11 rounded-xl border-gray-200"
                        />
                        <p className="text-xs text-gray-500">
                          Quantidade necessária para ativar o preço de atacado conforme a regra acima.
                        </p>
                      </div>
                    </div>
                  )}
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
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-700">CNPJ</Label>
                      <Input value={companyCnpj} onChange={(e) => setCompanyCnpj(e.target.value)} className="h-11 rounded-xl border-gray-200" placeholder="00.000.000/0000-00" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-700">Telefone / WhatsApp</Label>
                      <Input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} className="h-11 rounded-xl border-gray-200" placeholder="(00) 00000-0000" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-700">Email de Contato</Label>
                      <div className="relative">
                        <Input value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} className="h-11 pr-12 rounded-xl border-gray-200" placeholder="contato@empresa.com" />
                        <Mail className="absolute right-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
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
                        <Input value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} className="h-11 pr-12 rounded-xl border-gray-200" placeholder="Rua, Número, Bairro" />
                        <MapPin className="absolute right-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
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

              {/* 3.5 Fiscal Integration */}
              <FiscalSettings />

              {/* 3.6 WhatsApp Integation */}
              <WhatsappSettings />

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
                      <p className="font-medium text-gray-900">Mudar Plano</p>
                      <p className="text-sm text-gray-500 leading-snug">Veja as opções disponíveis e escolha a melhor para o seu negócio.</p>
                      <Button onClick={() => setShowUpgradeModal(true)} className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-200 border-0">
                        Ver Planos
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 5. Equipe */}
              <Card className="shadow-sm border-gray-100 rounded-3xl overflow-hidden">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                    <Users className="w-5 h-5 text-indigo-500" /> Equipe e Acessos
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-500">Gerencie quem tem acesso ao sistema e suas permissões.</p>
                      <Button onClick={() => openStaffDialog()} size="sm" variant="outline">Adicionar Membro</Button>
                    </div>

                    <div className="grid gap-3">
                      {staffList.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-3 border rounded-xl bg-gray-50/50 hover:bg-white transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${member.role === 'admin' ? 'bg-blue-500' : 'bg-gray-500'}`}>
                              {member.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{member.name}</p>
                              <p className="text-xs text-gray-500 uppercase">{member.role}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => openStaffDialog(member)}>Editar</Button>
                            {staffList.length > 1 && (
                              <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => deleteStaff(member.id)}>Remover</Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          )}
        </div>

        <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
          <DialogContent className="max-w-4xl p-0 bg-transparent border-0 shadow-none">
            <DialogHeader className="sr-only">
              <DialogTitle>Plano & Assinatura</DialogTitle>
            </DialogHeader>
            <SubscriptionLockOverlay />
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={showConfirmRemovePaymentMethod}
          onOpenChange={setShowConfirmRemovePaymentMethod}
          title="Remover método"
          description={`Tem certeza que deseja remover "${methodToRemove}"?`}
          confirmText="Remover"
          cancelText="Voltar"
          destructive
          onConfirm={() => {
            if (methodToRemove) removePaymentMethod(methodToRemove)
          }}
        />

        {/* Staff Management Dialog */}
        <Dialog open={showStaffDialog} onOpenChange={setShowStaffDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingStaff ? 'Editar Membro' : 'Novo Membro'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={staffForm.name} onChange={e => setStaffForm({ ...staffForm, name: e.target.value })} placeholder="Ex: João Caixa" />
              </div>
              <div className="space-y-2">
                <Label>PIN (Senha Numérica)</Label>
                <Input value={staffForm.pin} onChange={e => setStaffForm({ ...staffForm, pin: e.target.value })} placeholder="Ex: 1234" maxLength={6} />
              </div>
              <div className="space-y-2">
                <Label>Função</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 border p-3 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="radio" name="role" checked={staffForm.role === 'admin'} onChange={() => setStaffForm({ ...staffForm, role: 'admin' })} />
                    <div>
                      <span className="font-bold block text-sm">Administrador</span>
                      <span className="text-xs text-gray-500">Acesso Total</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 border p-3 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="radio" name="role" checked={staffForm.role === 'staff'} onChange={() => setStaffForm({ ...staffForm, role: 'staff' })} />
                    <div>
                      <span className="font-bold block text-sm">Funcionário</span>
                      <span className="text-xs text-gray-500">Acesso Limitado</span>
                    </div>
                  </label>
                </div>
              </div>

              {staffForm.role === 'staff' && (
                <div className="space-y-2 border-t pt-2">
                  <Label>Permissões</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'financial', label: 'Financeiro' },
                      { key: 'settings', label: 'Configurações' },
                      { key: 'inventory', label: 'Estoque' },
                      { key: 'reports', label: 'Relatórios' }
                    ].map(perm => (
                      <label key={perm.key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!staffForm.permissions[perm.key]}
                          onChange={(e) => setStaffForm({
                            ...staffForm,
                            permissions: { ...staffForm.permissions, [perm.key]: e.target.checked }
                          })}
                        />
                        <span>{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowStaffDialog(false)}>Cancelar</Button>
                <Button onClick={saveStaff}>Salvar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RequirePermission>
  )
}
