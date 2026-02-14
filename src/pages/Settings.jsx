import React, { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/ConfirmDialog'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Palette, Wallet, Building2, Crown, ExternalLink, QrCode, Mail, MapPin, Upload, ImageIcon, X, Users, Package, Instagram, Megaphone, Target, Brain } from 'lucide-react'
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
  const [blockPayables, setBlockPayables] = useState(false)
  const [newPaymentMethod, setNewPaymentMethod] = useState('')
  const [showConfirmRemovePaymentMethod, setShowConfirmRemovePaymentMethod] = useState(false)
  const [methodToRemove, setMethodToRemove] = useState(null)
  const [portalBusy, setPortalBusy] = useState(false)
  const [instagramHandle, setInstagramHandle] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [brandVoice, setBrandVoice] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [mainProducts, setMainProducts] = useState('')

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
    setBlockPayables(!!effective.block_payables)

    // Wholesale load
    setWholesaleEnabled(!!effective.wholesale_enabled)
    setWholesaleType(effective.wholesale_type || 'global')
    setWholesaleMinCount(typeof effective.wholesale_min_count === 'number' ? effective.wholesale_min_count : 5)
    setInstagramHandle(effective.instagram_handle || '')
    setWebsiteUrl(effective.website_url || '')
    setBrandVoice(effective.brand_voice || '')
    setTargetAudience(effective.target_audience || '')
    setMainProducts(effective.main_products || '')

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
      block_payables: blockPayables,
      // Wholesale save
      wholesale_enabled: wholesaleEnabled,
      wholesale_type: wholesaleType,
      wholesale_min_count: Number(wholesaleMinCount) || 1,
      instagram_handle: instagramHandle,
      website_url: websiteUrl,
      brand_voice: brandVoice,
      target_audience: targetAudience,
      main_products: mainProducts,
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
  const [activeCategory, setActiveCategory] = useState('general')

  const categories = [
    { id: 'general', label: 'Geral', icon: Building2, color: 'text-blue-600' },
    { id: 'financial', label: 'Financeiro', icon: Wallet, color: 'text-emerald-600' },
    { id: 'whatsapp', label: 'WhatsApp', icon: QrCode, color: 'text-teal-600' },
    { id: 'marketing', label: 'Marketing', icon: Megaphone, color: 'text-pink-600' },
    { id: 'wholesale', label: 'Atacado & Varejo', icon: Package, color: 'text-amber-600' },
    { id: 'fiscal', label: 'Fiscal', icon: Mail, color: 'text-indigo-600' },
    { id: 'team', label: 'Equipe', icon: Users, color: 'text-slate-600' },
    { id: 'subscription', label: 'Assinatura', icon: Crown, color: 'text-amber-500' },
  ]

  if (isLoading) return <div className="flex items-center justify-center min-h-[400px]"><LoadingSpinner /></div>

  return (
    <RequirePermission permission="settings">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Configurações</h1>
          <p className="mt-1 text-sm text-gray-500">Gerencie sua loja, equipe e integrações em um só lugar.</p>
        </header>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-full md:w-64 shrink-0">
            <nav className="space-y-1 bg-gray-50/50 p-2 rounded-2xl border border-gray-100">
              {categories.map((cat) => {
                const Icon = cat.icon
                const isActive = activeCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
                      ? 'bg-white text-blue-600 shadow-sm border border-gray-100 ring-1 ring-black/5'
                      : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
                      }`}
                  >
                    <Icon className={`w-5 h-5 ${cat.color} ${isActive ? 'opacity-100' : 'opacity-70'}`} />
                    {cat.label}
                  </button>
                )
              })}
              <div className="pt-4 mt-4 border-t border-gray-100 px-4 pb-2">
                <button
                  onClick={handleRestartTutorial}
                  className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-2 transition-colors"
                >
                  Reiniciar Tutorial
                </button>
              </div>
            </nav>
          </aside>

          {/* Settings Content */}
          <div className="flex-1 space-y-6">
            {activeCategory === 'general' && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                {/* 1. Identidade Visual */}
                <Card className="shadow-sm border-gray-100 rounded-3xl overflow-hidden">
                  <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                      <Palette className="w-5 h-5 text-blue-600" /> Identidade Visual
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                      <div className="w-full md:w-48 aspect-square rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center bg-gray-50 relative group hover:bg-gray-100 transition-colors" onClick={() => document.getElementById('logoInput').click()}>
                        {settings?.logo_url ? (
                          <img
                            src={settings.logo_url}
                            alt="Logo"
                            className="w-full h-full object-contain p-4"
                          />
                        ) : (
                          <>
                            <ImageIcon className="w-8 h-8 text-gray-300 mb-2 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] text-gray-400 font-medium tracking-tight">LOGO DA LOJA</span>
                          </>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/5 transition-opacity rounded-2xl cursor-pointer">
                          <Upload className="w-5 h-5 text-gray-600" />
                        </div>
                      </div>
                      <input id="logoInput" type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />

                      <div className="flex-1 space-y-4 w-full">
                        <div className="space-y-2">
                          <Label className="text-gray-700">Nome do ERP / Loja</Label>
                          <Input
                            value={erpName}
                            onChange={(e) => setErpName(e.target.value)}
                            className="h-11 rounded-xl border-gray-200"
                            placeholder="Minha Marca"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-gray-700">Endereço da Loja (Slug)</Label>
                          <div className="flex">
                            <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-gray-200 bg-gray-50 text-gray-500 text-sm">
                              alraerp.com/
                            </span>
                            <Input
                              value={slug}
                              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                              className="h-11 rounded-l-none rounded-r-xl border-gray-200"
                              placeholder="minhaloja"
                            />
                          </div>
                          <p className="text-[11px] text-gray-500 italic">Este será o link para seus clientes verem pontos de cashback e histórico.</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Dados da Empresa */}
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
                        <Input value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} className="h-11 rounded-xl border-gray-200" placeholder="Rua, Número, Bairro" />
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
              </div>
            )}

            {activeCategory === 'financial' && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <Card className="shadow-sm border-gray-100 rounded-3xl overflow-hidden">
                  <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                      <Wallet className="w-5 h-5 text-emerald-600" /> Cashback e Pagamentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-8">
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-gray-700 font-semibold flex items-center gap-2">
                            % Cashback <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase">Padrão</span>
                          </Label>
                          <Input
                            type="number"
                            value={cashbackPercentage}
                            onChange={(e) => setCashbackPercentage(e.target.value)}
                            className="h-11 rounded-xl border-gray-200"
                            placeholder="5"
                          />
                          <p className="text-xs text-gray-500">Valor padrão que os clientes acumulam em cada compra.</p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-gray-700 font-semibold">Expiração (Dias)</Label>
                          <Input
                            type="number"
                            value={cashbackExpirationDays}
                            onChange={(e) => setCashbackExpirationDays(e.target.value)}
                            className="h-11 rounded-xl border-gray-200"
                            placeholder="30"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-gray-700 font-semibold flex items-center gap-2">
                          Chave PIX <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">Copia e Cola</span>
                        </Label>
                        <Input
                          value={pixKey}
                          onChange={(e) => setPixKey(e.target.value)}
                          className="h-11 rounded-xl border-gray-200"
                          placeholder="CNPJ, E-mail ou Celular"
                        />
                        <p className="text-xs text-gray-500 italic leading-snug">Seu cliente verá essa chave na tela de checkout para pagamentos rápidos.</p>
                      </div>
                    </div>

                    <div className="space-y-4 pt-6 border-t border-gray-50">
                      <Label className="text-gray-700 font-semibold">Outros Meios de Pagamento</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newPaymentMethod}
                          onChange={(e) => setNewPaymentMethod(e.target.value)}
                          placeholder="Ex: Dinheiro, Link de Pagamento..."
                          className="h-11 rounded-xl border-gray-200"
                          onKeyDown={(e) => e.key === 'Enter' && addPaymentMethod()}
                        />
                        <Button onClick={addPaymentMethod} variant="secondary" className="rounded-xl h-11">Adicionar</Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {paymentMethods.map((m) => (
                          <div key={m} className="pl-4 pr-2 py-2 bg-gray-50 rounded-xl flex items-center gap-2 border border-gray-200 shadow-sm animate-in zoom-in-95">
                            <span className="text-sm font-medium text-gray-700">{m}</span>
                            <button onClick={() => { setMethodToRemove(m); setShowConfirmRemovePaymentMethod(true); }} className="p-1.5 hover:bg-gray-200/50 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-6 border-t border-gray-100 space-y-4">
                      <Label className="text-gray-900 font-semibold">Nível de Acesso Financeiro (Staff)</Label>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div onClick={() => setBlockPayables(false)} className={`cursor-pointer border-2 rounded-2xl p-4 transition-all hover:bg-gray-50 ${!blockPayables ? 'border-blue-500 bg-blue-50/10' : 'border-gray-100'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${!blockPayables ? 'border-blue-600' : 'border-gray-300'}`}>
                              {!blockPayables && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                            </div>
                            <span className="font-semibold text-gray-900">Completo</span>
                          </div>
                          <p className="text-xs text-gray-500 italic">Acesso a Receber, Pagar e Balanço.</p>
                        </div>
                        <div onClick={() => setBlockPayables(true)} className={`cursor-pointer border-2 rounded-2xl p-4 transition-all hover:bg-gray-50 ${blockPayables ? 'border-amber-500 bg-amber-50/20' : 'border-gray-100'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${blockPayables ? 'border-amber-600' : 'border-gray-300'}`}>
                              {blockPayables && <div className="w-2 h-2 rounded-full bg-amber-600" />}
                            </div>
                            <span className="font-semibold text-gray-900">Apenas Recebíveis</span>
                          </div>
                          <p className="text-xs text-gray-500 italic">Oculta o "A Pagar" para funcionários.</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeCategory === 'whatsapp' && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <WhatsappSettings />
              </div>
            )}

            {activeCategory === 'marketing' && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <Card className="shadow-sm border-gray-100 rounded-3xl overflow-hidden">
                  <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                      <Megaphone className="w-5 h-5 text-pink-500" /> Branding e Marketing IA
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-gray-700 font-medium">Instagram</Label>
                        <Input value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} className="h-11 rounded-xl border-gray-200" placeholder="@sualoja" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-700 font-medium">Site / E-commerce (URL)</Label>
                        <Input
                          value={websiteUrl}
                          onChange={(e) => setWebsiteUrl(e.target.value)}
                          className="h-11 rounded-xl border-gray-200"
                          placeholder="https://www.minhaloja.com.br"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-700 font-medium">Tom de Voz</Label>
                        <select value={brandVoice} onChange={(e) => setBrandVoice(e.target.value)} className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all">
                          <option value="">Selecione um tom...</option>
                          <option value="Jovem e Urbano">Jovem e Urbano</option>
                          <option value="Profissional e Sereno">Profissional e Sereno</option>
                          <option value="Premium e Luxo">Premium e Luxo</option>
                          <option value="Amigável e Próximo">Amigável e Próximo</option>
                          <option value="Engraçado e Irônico">Engraçado e Irônico</option>
                          <option value="Minimalista">Minimalista</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-700 font-medium">Público-Alvo</Label>
                      <textarea value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="w-full min-h-[100px] p-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Ex: Homens entre 18-35 anos que buscam estilo premium e conforto..." />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-700 font-medium">Principais Produtos/Nichos</Label>
                      <textarea value={mainProducts} onChange={(e) => setMainProducts(e.target.value)} className="w-full min-h-[100px] p-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Ex: Calças cargo de sarja, camisetas oversized em algodão egípcio, acessórios de prata..." />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeCategory === 'wholesale' && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <Card className="shadow-sm border-gray-100 rounded-3xl overflow-hidden">
                  <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                      <Package className="w-5 h-5 text-amber-600" /> Regras de Atacado
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id="wholesaleEnabledSide" checked={wholesaleEnabled} onChange={(e) => setWholesaleEnabled(e.target.checked)} className="w-6 h-6 rounded-lg border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <Label htmlFor="wholesaleEnabledSide" className="text-lg font-medium cursor-pointer">Habilitar Preço de Atacado?</Label>
                    </div>
                    {wholesaleEnabled && (
                      <div className="pl-9 space-y-6 animate-in slide-in-from-top-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div onClick={() => setWholesaleType('global')} className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${wholesaleType === 'global' ? 'border-amber-500 bg-amber-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                            <p className="font-bold">Misto (Global)</p>
                            <p className="text-xs text-gray-500">Qualquer produto soma para bater a meta.</p>
                          </div>
                          <div onClick={() => setWholesaleType('item')} className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${wholesaleType === 'item' ? 'border-amber-500 bg-amber-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                            <p className="font-bold">Por Item</p>
                            <p className="text-xs text-gray-500">X unidades do mesmo produto para desconto.</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Quantidade Mínima</Label>
                          <Input type="number" value={wholesaleMinCount} onChange={(e) => setWholesaleMinCount(e.target.value)} className="h-11 rounded-xl w-32" />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {activeCategory === 'fiscal' && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <FiscalSettings />
              </div>
            )}

            {activeCategory === 'team' && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <Card className="shadow-sm border-gray-100 rounded-3xl overflow-hidden">
                  <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                      <Users className="w-5 h-5 text-slate-600" /> Equipe e Permissões
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-sm text-gray-500">Membros com acesso ao sistema.</p>
                      <Button onClick={() => openStaffDialog()} className="rounded-xl shadow-sm">Adicionar Membro</Button>
                    </div>
                    <div className="grid gap-3">
                      {staffList.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:shadow-md transition-all">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white ${member.role === 'admin' ? 'bg-indigo-500 shadow-indigo-100' : 'bg-slate-400 shadow-slate-100'} shadow-lg`}>
                              {member.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">{member.name}</p>
                              <span className={`text-[10px] font-bold uppercase tracking-widest ${member.role === 'admin' ? 'text-indigo-600' : 'text-slate-500'}`}>{member.role}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" className="rounded-lg h-9" onClick={() => openStaffDialog(member)}>Editar</Button>
                            {staffList.length > 1 && (
                              <Button size="sm" variant="ghost" className="rounded-lg h-9 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deleteStaff(member.id)}>Remover</Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeCategory === 'subscription' && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <Card className="shadow-lg border-0 bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-3xl overflow-hidden">
                  <CardContent className="p-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Crown className="w-6 h-6 text-amber-400 fill-amber-400" />
                          <h3 className="text-2xl font-bold">Plano {settings?.plan_name || 'Alra ERP+'}</h3>
                        </div>
                        <p className="text-indigo-100">Status: <span className="font-bold uppercase tracking-widest text-xs ml-1 bg-white/20 px-2 py-0.5 rounded-full">{settings?.subscription_status || 'Trial'}</span></p>
                      </div>
                      <Button onClick={() => setShowUpgradeModal(true)} className="bg-white text-indigo-700 hover:bg-indigo-50 rounded-2xl px-8 h-14 font-extrabold text-lg shadow-xl shadow-black/20 ring-4 ring-white/10 transition-all active:scale-95">
                        TURBINAR PLANO
                      </Button>
                    </div>
                    <div className="mt-8 grid md:grid-cols-2 gap-4">
                      <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                        <p className="text-xs text-indigo-200 mb-1">Próxima Renovação</p>
                        <p className="text-lg font-bold">{settings?.subscription_end_date ? new Date(settings.subscription_end_date).toLocaleDateString('pt-BR') : 'Sem data'}</p>
                      </div>
                      <button onClick={manageSubscription} disabled={portalBusy} className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 hover:bg-white/20 transition-all text-left">
                        <p className="text-xs text-indigo-200 mb-1">Gerenciamento</p>
                        <div className="flex items-center justify-between">
                          <p className="text-lg font-bold">Abrir Portal Billing</p>
                          <ExternalLink className="w-5 h-5 text-indigo-200" />
                        </div>
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Bottom Actions for all categorical tabs */}
            <div className="flex justify-end pt-8 sticky bottom-8 z-20 pointer-events-none">
              <Button onClick={save} className="h-14 px-10 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-2xl shadow-blue-500/40 pointer-events-auto active:scale-95 transition-all">
                Salvar Alterações
              </Button>
            </div>
          </div>
        </div>

        {/* Modal for Upgrade */}
        <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
          <DialogContent className="max-w-4xl p-0 bg-transparent border-0 shadow-none">
            <DialogHeader className="sr-only">
              <DialogTitle>Plano & Assinatura</DialogTitle>
            </DialogHeader>
            <SubscriptionLockOverlay />
          </DialogContent>
        </Dialog>

        {/* Modals from Staff and Payment Methods */}
        <ConfirmDialog
          open={showConfirmRemovePaymentMethod}
          onOpenChange={setShowConfirmRemovePaymentMethod}
          title="Remover método"
          description={`Tem certeza que deseja remover "${methodToRemove}"?`}
          confirmText="Remover"
          cancelText="Voltar"
          destructive
          onConfirm={() => { if (methodToRemove) removePaymentMethod(methodToRemove) }}
        />

        <Dialog open={showStaffDialog} onOpenChange={setShowStaffDialog}>
          <DialogContent className="rounded-3xl border-0 shadow-2xl max-w-lg p-0 overflow-hidden">
            <div className="p-8 space-y-6">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-gray-900">{editingStaff ? 'Editar Membro' : 'Novo Membro'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-gray-700 font-medium">Nome Completo</Label>
                  <Input value={staffForm.name} onChange={e => setStaffForm({ ...staffForm, name: e.target.value })} className="h-12 rounded-xl border-gray-200 shadow-sm" placeholder="Ex: João da Silva" />
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
                        { key: 'inventory', label: 'Estoque' },
                        { key: 'reports', label: 'Relatórios' },
                        { key: 'settings', label: 'Configurações' },
                      ].map(perm => (
                        <div key={perm.key} className="space-y-2 p-3 border rounded-xl bg-gray-50/50">
                          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!staffForm.permissions[perm.key]}
                              onChange={(e) => setStaffForm({
                                ...staffForm,
                                permissions: { ...staffForm.permissions, [perm.key]: e.target.checked }
                              })}
                              className="w-4 h-4 rounded text-blue-600"
                            />
                            <span>{perm.label}</span>
                          </label>

                          {perm.key === 'financial' && staffForm.permissions.financial && (
                            <div className="pl-6 space-y-2 mt-2 border-l-2 border-blue-200">
                              <label className="flex items-center gap-2 text-xs cursor-pointer">
                                <input
                                  type="radio"
                                  name="fin_type"
                                  checked={!staffForm.permissions.financial_receivables_only}
                                  onChange={() => setStaffForm({
                                    ...staffForm,
                                    permissions: { ...staffForm.permissions, financial_receivables_only: false }
                                  })}
                                />
                                <span className={!staffForm.permissions.financial_receivables_only ? 'text-blue-700 font-bold' : 'text-gray-500'}>Completo</span>
                              </label>
                              <label className="flex items-center gap-2 text-xs cursor-pointer">
                                <input
                                  type="radio"
                                  name="fin_type"
                                  checked={!!staffForm.permissions.financial_receivables_only}
                                  onChange={() => setStaffForm({
                                    ...staffForm,
                                    permissions: { ...staffForm.permissions, financial_receivables_only: true }
                                  })}
                                />
                                <span className={staffForm.permissions.financial_receivables_only ? 'text-amber-700 font-bold' : 'text-gray-500'}>Apenas Receber</span>
                              </label>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setShowStaffDialog(false)}>Cancelar</Button>
                  <Button onClick={saveStaff}>Salvar</Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RequirePermission>
  )
}
