import React, { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/ConfirmDialog'
import LoadingSpinner from '@/components/LoadingSpinner'
import {
  Palette, Wallet, Building2, Crown, ExternalLink, QrCode,
  Mail, MapPin, Upload, ImageIcon, X, Users, Package,
  Instagram, Megaphone, Target, Brain, Shield, ChevronRight,
  Zap, Settings as SettingsIcon, Globe, FileText, Smartphone,
  Save, Bell, CreditCard, Key
} from 'lucide-react'
import { useEffectiveSettings } from '@/hooks/useEffectiveSettings'
import { useTutorial } from '@/hooks/useTutorial'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import SubscriptionLockOverlay from '@/components/SubscriptionLockOverlay'
import RequirePermission from '@/components/RequirePermission'
import FiscalSettings from '@/pages/settings/FiscalSettings'
import WhatsappSettings from '@/pages/settings/WhatsappSettings'
import { toast } from 'sonner'

export default function Settings() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('general')
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
  const [wholesaleType, setWholesaleType] = useState('global')
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
    if (!staffForm.name || !staffForm.pin) return toast.error('Nome e PIN são obrigatórios')
    try {
      if (editingStaff) {
        await base44.entities.Staff.update(editingStaff.id, staffForm)
      } else {
        await base44.entities.Staff.create(staffForm)
      }
      setShowStaffDialog(false)
      loadStaff()
      toast.success('Funcionário salvo com sucesso!')
    } catch (err) { toast.error('Erro ao salvar funcionário') }
  }

  const deleteStaff = async (id) => {
    if (!confirm('Deseja realmente remover este membro da equipe?')) return
    try {
      await base44.entities.Staff.delete(id)
      loadStaff()
      toast.success('Membro removido!')
    } catch (err) { toast.error('Erro ao remover membro') }
  }

  const effective = useEffectiveSettings()
  const { restartTutorial, startTutorial } = useTutorial()

  const handleRestartTutorial = () => {
    try { localStorage.removeItem('tutorial_completed') } catch { }
    if (typeof restartTutorial === 'function') restartTutorial()
    else if (typeof startTutorial === 'function') startTutorial()
    toast.success('O tutorial começará na próxima vez que você visitar o Dashboard!')
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

  const saveBatch = async () => {
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
      } else {
        const created = await base44.entities.Settings.create(payload)
        setSettings(created)
      }
      toast.success('Todas as alterações foram salvas!')
    } catch (err) {
      toast.error(`Erro ao salvar: ${err?.message || 'erro desconhecido'}`)
    }
  }

  const manageSubscription = async () => {
    try {
      setPortalBusy(true)
      const effectiveEmail = (user?.email || companyEmail || '').trim()
      if (!effectiveEmail) {
        toast.error('Informe o e-mail da empresa para acessar o portal.')
        return
      }
      const API = import.meta.env.VITE_API_URL || 'http://localhost:4242'
      const returnUrl = `${window.location.origin}/settings`
      const res = await fetch(`${API}/create-portal-session-by-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: effectiveEmail, returnUrl }),
      })
      const json = await res.json()
      if (json?.url) window.location.href = json.url
      else toast.error('Não foi possível gerar a sessão do portal.')
    } catch (err) {
      toast.error('Erro de conexão com o portal financeiro.')
    } finally {
      setPortalBusy(false)
    }
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const promise = async () => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file })
      if (settings) {
        await base44.entities.Settings.update(settings.id, { logo_url: file_url })
        setSettings({ ...settings, logo_url: file_url })
      } else {
        const created = await base44.entities.Settings.create({ logo_url: file_url })
        setSettings(created)
      }
      return 'Logotipo atualizado com sucesso!'
    }
    toast.promise(promise, {
      loading: 'Enviando imagem...',
      success: (data) => data,
      error: 'Falha ao enviar logotipo'
    })
  }

  const tabs = [
    { id: 'general', label: 'Painel Geral', icon: SettingsIcon },
    { id: 'company', label: 'Dados da Empresa', icon: Building2 },
    { id: 'finance', label: 'Config. Financeiras', icon: Wallet },
    { id: 'wholesale', label: 'Modulo Atacado', icon: Package },
    { id: 'marketing', label: 'Branding & IA', icon: Brain },
    { id: 'team', label: 'Equipe e Acessos', icon: Users },
    { id: 'integrations', label: 'Integrações Externas', icon: Zap },
    { id: 'plan', label: 'Plano e Assinatura', icon: Crown },
  ]

  return (
    <RequirePermission permission="settings">
      <div className="flex flex-col md:flex-row min-h-screen bg-slate-50/50">

        {/* Sidebar de Navegação */}
        <aside className="w-full md:w-80 bg-white border-r border-slate-200 flex flex-col pt-8 shadow-sm">
          <div className="px-8 mb-8">
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <SettingsIcon className="w-6 h-6 text-indigo-600" /> Configurações
            </h1>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">Painel de Controle Central</p>
          </div>

          <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full group flex items-center gap-3 px-4 py-3.5 transition-all rounded-xl relative ${activeTab === tab.id
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                <tab.icon className={`w-5 h-5 transition-colors ${activeTab === tab.id ? 'text-indigo-600' : 'group-hover:text-slate-700'}`} />
                <span className={`text-sm font-semibold ${activeTab === tab.id ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`}>
                  {tab.label}
                </span>
                {activeTab === tab.id && <ChevronRight className="ml-auto w-4 h-4 text-indigo-400" />}
              </button>
            ))}
          </nav>

          <footer className="p-6 border-t border-slate-100">
            <Button
              onClick={saveBatch}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-6 rounded-2xl shadow-lg shadow-indigo-200/50 flex gap-2"
            >
              <Save className="w-5 h-5" /> Salvar Alterações
            </Button>
          </footer>
        </aside>

        {/* Área de Conteúdo Principal */}
        <main className="flex-1 overflow-y-auto px-6 py-10 md:px-12 md:py-16">
          <div className="max-w-4xl mx-auto">

            {isLoading ? (
              <div className="flex items-center justify-center h-[60vh]"><LoadingSpinner /></div>
            ) : (
              <div className="animate-in fade-in duration-500 slide-in-from-bottom-4">

                {/* 🏠 GERAL */}
                {activeTab === 'general' && (
                  <div className="space-y-10">
                    <section className="space-y-6">
                      <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <SettingsIcon className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-widest">Painel Administrativo / Geral</span>
                      </div>
                      <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Identidade Visual</h2>

                      <Card className="rounded-3xl border-slate-200 overflow-hidden shadow-sm">
                        <CardContent className="p-8 space-y-8">
                          <div className="flex flex-col md:flex-row gap-12 items-start">
                            <div className="space-y-3 shrink-0">
                              <Label className="text-sm font-bold text-slate-700">Logotipo do Sistema</Label>
                              <div className="w-44 h-44 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl relative group transition-all hover:bg-slate-100 hover:border-indigo-300 overflow-hidden flex items-center justify-center cursor-pointer" onClick={() => document.getElementById('logoInput').click()}>
                                {settings?.logo_url ? (
                                  <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain p-4" />
                                ) : (
                                  <div className="flex flex-col items-center justify-center text-slate-300 group-hover:text-indigo-400 transition-colors">
                                    <ImageIcon className="w-10 h-10 mb-2" />
                                    <span className="text-[11px] font-bold uppercase tracking-wider">Upload PNG</span>
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                  <Upload className="w-8 h-8 text-indigo-600" />
                                </div>
                              </div>
                              <input id="logoInput" type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                            </div>

                            <div className="flex-1 space-y-6 w-full">
                              <div className="space-y-2">
                                <Label className="text-sm font-bold text-slate-700">Nome Fantasia (Exibido no ERP)</Label>
                                <Input
                                  value={erpName}
                                  onChange={(e) => setErpName(e.target.value)}
                                  className="h-12 rounded-xl text-lg border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                />
                                <p className="text-xs text-slate-400">Este nome aparecerá no menu lateral e nos documentos oficiais.</p>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-bold text-slate-700">Identificador da URL (Slug)</Label>
                                <div className="flex items-center gap-2 bg-slate-50 px-4 h-12 rounded-xl border border-slate-200">
                                  <Globe className="w-4 h-4 text-slate-400" />
                                  <span className="text-sm text-slate-500 font-medium">alraerp.com.br/</span>
                                  <input
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                                    className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-indigo-600"
                                  />
                                  <span className="text-sm text-slate-500 font-medium">/cashback</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </section>

                    <section className="bg-amber-50 rounded-3xl p-8 border border-amber-100">
                      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="space-y-1">
                          <h3 className="text-lg font-bold text-amber-900">Treinamento Interativo</h3>
                          <p className="text-sm text-amber-700 flex items-center gap-1.5 font-medium">Resetar os balões de ajuda e tutoriais guiados por todos os módulos.</p>
                        </div>
                        <Button onClick={handleRestartTutorial} variant="outline" className="rounded-xl border-amber-200 bg-white text-amber-700 hover:bg-amber-100 min-w-[200px] h-12 font-bold uppercase text-xs tracking-widest">
                          Reiniciar Tutorial
                        </Button>
                      </div>
                    </section>
                  </div>
                )}

                {/* 🏢 EMPRESA */}
                {activeTab === 'company' && (
                  <div className="space-y-8">
                    <header className="space-y-2">
                      <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dados Cadastrais</h2>
                      <p className="text-slate-400 text-sm font-medium">Informações legais e de localização da sua base operacional.</p>
                    </header>
                    <Card className="rounded-3xl border-slate-200 overflow-hidden shadow-sm">
                      <CardContent className="p-8">
                        <div className="grid md:grid-cols-2 gap-8">
                          <div className="space-y-6">
                            <div className="space-y-2">
                              <Label className="text-sm font-bold text-slate-700">CNPJ</Label>
                              <Input value={companyCnpj} onChange={(e) => setCompanyCnpj(e.target.value)} className="rounded-xl h-11" placeholder="00.000.000/0000-00" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-bold text-slate-700">WhatsApp / Telefone</Label>
                              <Input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} className="rounded-xl h-11" placeholder="(00) 00000-0000" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-bold text-slate-700">E-mail Corporativo</Label>
                              <Input value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} className="rounded-xl h-11" placeholder="contato@empresa.com" />
                            </div>
                          </div>
                          <div className="space-y-6">
                            <div className="space-y-2">
                              <Label className="text-sm font-bold text-slate-700">CEP</Label>
                              <Input value={companyZip} onChange={(e) => setCompanyZip(e.target.value)} className="rounded-xl h-11" placeholder="00000-000" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-bold text-slate-700">Endereço Completo</Label>
                              <Input value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} className="rounded-xl h-11" placeholder="Rua, Número, Bairro" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-sm font-bold text-slate-700">Cidade</Label>
                                <Input value={companyCity} onChange={(e) => setCompanyCity(e.target.value)} className="rounded-xl h-11" />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm font-bold text-slate-700">Estado (UF)</Label>
                                <Input value={companyState} onChange={(e) => setCompanyState(e.target.value)} className="rounded-xl h-11" maxLength={2} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* 💰 FINANCEIRO */}
                {activeTab === 'finance' && (
                  <div className="space-y-8">
                    <header className="space-y-2">
                      <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Regras Financeiras</h2>
                      <p className="text-slate-400 text-sm font-medium">Gestão de fidelização, cashback e protocolos de acesso para equipe.</p>
                    </header>
                    <div className="grid md:grid-cols-2 gap-8">
                      <Card className="rounded-3xl border-slate-200 overflow-hidden shadow-sm">
                        <CardHeader className="p-6 border-b border-slate-50">
                          <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-500" /> Fidelidade & Cashback
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-600">Porcentagem de Retorno (%)</Label>
                            <div className="relative">
                              <Input
                                type="number"
                                value={cashbackPercentage}
                                onChange={(e) => setCashbackPercentage(e.target.value)}
                                className="h-14 rounded-2xl text-2xl font-bold text-indigo-600 pl-4 border-slate-200"
                              />
                              <span className="absolute right-4 top-4 text-slate-300 font-bold">%</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-600">Dias de Validade</Label>
                            <Input
                              type="number"
                              value={cashbackExpirationDays}
                              onChange={(e) => setCashbackExpirationDays(e.target.value)}
                              className="h-12 rounded-xl text-lg font-bold border-slate-200"
                            />
                            <p className="text-[10px] text-slate-400 italic">O saldo expira automaticamente após este período.</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="rounded-3xl border-slate-200 overflow-hidden shadow-sm">
                        <CardHeader className="p-6 border-b border-slate-50">
                          <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                            <QrCode className="w-4 h-4 text-green-600" /> Terminal PIX
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-600">Chave PIX (Email, CPF ou Telefone)</Label>
                            <Input
                              value={pixKey}
                              onChange={(e) => setPixKey(e.target.value)}
                              placeholder="Insira a chave para recebimentos"
                              className="h-12 rounded-xl text-sm font-medium border-slate-200"
                            />
                          </div>
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">Esta chave será usada para gerar QRCodes rápidos no checkout do caixa.</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="rounded-3xl border-slate-200 overflow-hidden shadow-sm">
                      <CardHeader className="p-6 border-b border-slate-50 bg-slate-50/30">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                          <Shield className="w-4 h-4 text-indigo-600" /> Controle de Permissões Financeiras
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-8">
                        <div className="grid md:grid-cols-2 gap-6">
                          <button
                            onClick={() => setBlockPayables(false)}
                            className={`flex flex-col gap-3 p-6 rounded-3xl border-2 transition-all text-left group ${!blockPayables ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                          >
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${!blockPayables ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                              <Zap className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 uppercase text-xs tracking-wider mb-1">Acesso Irrestrito</h4>
                              <p className="text-xs text-slate-500 font-medium">Equipe visualiza fluxo de caixa completo (Entradas e Saídas).</p>
                            </div>
                          </button>

                          <button
                            onClick={() => setBlockPayables(true)}
                            className={`flex flex-col gap-3 p-6 rounded-3xl border-2 transition-all text-left group ${blockPayables ? 'border-amber-500 bg-amber-50/50' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                          >
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${blockPayables ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                              <Shield className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 uppercase text-xs tracking-wider mb-1">Travar A Pagar</h4>
                              <p className="text-xs text-slate-500 font-medium">Oculta boletos e despesas para quem não for Administrador.</p>
                            </div>
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* 📦 ATACADO */}
                {activeTab === 'wholesale' && (
                  <div className="space-y-8">
                    <header className="space-y-2">
                      <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Política de Atacado</h2>
                      <p className="text-slate-400 text-sm font-medium">Reconhecimento automático de compras em volume para descontos dinâmicos.</p>
                    </header>

                    <Card className="rounded-3xl border-slate-200 overflow-hidden shadow-sm">
                      <CardContent className="p-10 space-y-10">
                        <div className="flex items-center gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                          <div className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              id="wholesaleEnabled"
                              checked={wholesaleEnabled}
                              onChange={(e) => setWholesaleEnabled(e.target.checked)}
                              className="w-6 h-6 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-600"
                            />
                          </div>
                          <Label htmlFor="wholesaleEnabled" className="text-lg font-bold text-slate-800 cursor-pointer">Habilitar Preço de Atacado no Caixa</Label>
                        </div>

                        {wholesaleEnabled && (
                          <div className="grid md:grid-cols-2 gap-10 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="space-y-4">
                              <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Regra de Transição</Label>
                              <div className="grid gap-4">
                                <button
                                  onClick={() => setWholesaleType('global')}
                                  className={`p-5 rounded-2xl border-2 transition-all text-left ${wholesaleType === 'global' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'}`}
                                >
                                  <span className="text-xs font-bold text-slate-900 block mb-1 uppercase tracking-tight">Somatório Global</span>
                                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">Considera o volume total do carrinho somando todos os modelos diferentes.</p>
                                </button>
                                <button
                                  onClick={() => setWholesaleType('item')}
                                  className={`p-5 rounded-2xl border-2 transition-all text-left ${wholesaleType === 'item' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'}`}
                                >
                                  <span className="text-xs font-bold text-slate-900 block mb-1 uppercase tracking-tight">Por Referência</span>
                                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">O preço de atacado só ativa para itens que individualmente baterem a meta.</p>
                                </button>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Gatilho de Unidades</Label>
                              <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-3">
                                <Input
                                  type="number"
                                  value={wholesaleMinCount}
                                  onChange={(e) => setWholesaleMinCount(e.target.value)}
                                  className="h-16 text-3xl font-black text-indigo-600 border-none bg-slate-50 text-center rounded-xl"
                                />
                                <p className="text-[10px] text-slate-400 uppercase font-bold text-center tracking-widest">A partir de X peças</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* 📢 MARKETING/IA */}
                {activeTab === 'marketing' && (
                  <div className="space-y-8">
                    <header className="space-y-2">
                      <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">IA & Marketing</h2>
                      <p className="text-slate-400 text-sm font-medium">Treine o motor cognitivo do AlraERP para criar abordagens alinhadas à sua marca.</p>
                    </header>
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <section className="space-y-2">
                          <Label className="text-sm font-bold text-slate-800">E-commerce / Catálogo (URL)</Label>
                          <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className="rounded-xl h-11" placeholder="https://www.sualoja.com.br" />
                          <p className="text-[10px] text-slate-400 italic">Mapeamos seus links para sugestões inteligentes no chat.</p>
                        </section>
                        <section className="space-y-2">
                          <Label className="text-sm font-bold text-slate-800">Perfil no Instagram</Label>
                          <Input value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} className="rounded-xl h-11" placeholder="@nomedaloja" />
                        </section>
                        <section className="space-y-2">
                          <Label className="text-sm font-bold text-slate-800">Linguagem do Negócio (Tone of Voice)</Label>
                          <select
                            value={brandVoice}
                            onChange={(e) => setBrandVoice(e.target.value)}
                            className="w-full bg-white border border-slate-200 h-11 px-4 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                          >
                            <option value="">Selecione um estilo...</option>
                            <option value="Jovem e Urbano">Jovem e Urbano (Streetwear)</option>
                            <option value="Profissional e Sereno">Profissional e Minimalista</option>
                            <option value="Premium e Luxo">Premium, Sofisticado e Exclusivo</option>
                            <option value="Amigável e Próximo">Amigável e Atencioso</option>
                            <option value="Engraçado e Irônico">Engraçado e Comedido</option>
                          </select>
                        </section>
                      </div>

                      <div className="space-y-6">
                        <section className="space-y-2">
                          <Label className="text-sm font-bold text-slate-800">Perfil do Público-Alvo</Label>
                          <textarea
                            value={targetAudience}
                            onChange={(e) => setTargetAudience(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-2xl min-h-[120px] p-4 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                            placeholder="Ex: Mulheres de 25-40 anos que apreciam joias minimalistas..."
                          />
                        </section>
                        <section className="space-y-2">
                          <Label className="text-sm font-bold text-slate-800">Fichamento de Produtos (Nichos)</Label>
                          <textarea
                            value={mainProducts}
                            onChange={(e) => setMainProducts(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-2xl min-h-[120px] p-4 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                            placeholder="Responda: O que a sua loja resolve? Quais produtos são o carro-chefe?"
                          />
                        </section>
                      </div>
                    </div>
                  </div>
                )}

                {/* 👥 EQUIPE */}
                {activeTab === 'team' && (
                  <div className="space-y-8">
                    <header className="space-y-2 flex justify-between items-end">
                      <div>
                        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Equipe & Staff</h2>
                        <p className="text-slate-400 text-sm font-medium">Controle de acessos, pins individuais e auditoria de perfis.</p>
                      </div>
                      <Button onClick={() => openStaffDialog()} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold uppercase text-[10px] tracking-widest px-6 h-11 flex gap-2">
                        <Users className="w-4 h-4" /> Novo Membro
                      </Button>
                    </header>

                    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="divide-y divide-slate-100">
                        {staffList.map(member => (
                          <div key={member.id} className="flex items-center justify-between p-6 hover:bg-slate-50 transition-colors group">
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg border-2 ${member.role === 'admin' ? 'border-indigo-100 bg-indigo-50 text-indigo-600' : 'border-slate-100 bg-slate-50 text-slate-400'}`}>
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-900">{member.name}</h4>
                                <div className="flex items-center gap-3 mt-0.5">
                                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg ${member.role === 'admin' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {member.role.toUpperCase()}
                                  </span>
                                  <span className="text-[10px] text-slate-300 font-mono italic">Staff #ID:{member.id.substring(0, 8)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="ghost" className="rounded-xl text-xs font-bold text-slate-400 hover:text-indigo-600" onClick={() => openStaffDialog(member)}>Configurar</Button>
                              <Button variant="ghost" className="rounded-xl text-xs font-bold text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => deleteStaff(member.id)}>Remover</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 🔌 INTEGRAÇÕES */}
                {activeTab === 'integrations' && (
                  <div className="space-y-12">
                    <header className="space-y-2">
                      <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Hub de Conexões</h2>
                      <p className="text-slate-400 text-sm font-medium">Sincronize o AlraERP com servidores de WhatsApp e plataformas fiscais.</p>
                    </header>
                    <div className="grid gap-12 pt-4">
                      <section className="space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center">
                            <Smartphone className="w-5 h-5 text-green-600" />
                          </div>
                          <h3 className="text-xl font-bold text-slate-800">Comunicação WhatsApp (Evolution)</h3>
                        </div>
                        <Card className="rounded-3xl border-slate-200 overflow-hidden shadow-sm">
                          <CardContent className="p-8">
                            <WhatsappSettings />
                          </CardContent>
                        </Card>
                      </section>

                      <section className="space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600" />
                          </div>
                          <h3 className="text-xl font-bold text-slate-800">Emissão de Notas Fiscais (Monitor)</h3>
                        </div>
                        <Card className="rounded-3xl border-slate-200 overflow-hidden shadow-sm">
                          <CardContent className="p-8">
                            <FiscalSettings />
                          </CardContent>
                        </Card>
                      </section>
                    </div>
                  </div>
                )}

                {/* 👑 PLANO/ASSINATURA */}
                {activeTab === 'plan' && (activeTab === 'plan' && (
                  <div className="space-y-8">
                    <header className="space-y-2">
                      <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Software e Licenciamento</h2>
                      <p className="text-slate-400 text-sm font-medium">Controle de planos, renovações e escalabilidade do seu negócio.</p>
                    </header>

                    <div className="grid md:grid-cols-3 gap-8 pt-4">
                      <Card className="rounded-3xl border-slate-200 overflow-hidden shadow-sm p-8 flex flex-col justify-between h-72">
                        <div className="space-y-3">
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">Sua Edição</span>
                          <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{settings?.plan_name || 'ERP Basic'}</h3>
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${settings?.subscription_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            <div className={`w-2 h-2 rounded-full ${settings?.subscription_status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{settings?.subscription_status || 'ATIVO'}</span>
                          </div>
                        </div>
                        <div className="border-t border-slate-100 pt-6">
                          <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider mb-1">Próxima Cobrança:</p>
                          <p className="text-sm font-mono font-bold text-slate-700">{settings?.subscription_end_date ? new Date(settings.subscription_end_date).toLocaleDateString() : 'Não disponível'}</p>
                        </div>
                      </Card>

                      <div className="md:col-span-2 space-y-6">
                        <section className="bg-white p-8 rounded-3xl border-2 border-slate-100 shadow-sm relative overflow-hidden group">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 transition-all group-hover:scale-110" />
                          <div className="relative space-y-4">
                            <h4 className="text-xl font-bold text-slate-900">Portal de Faturamento (Stripe)</h4>
                            <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-md">Gerencie faturas antigas, altere o cartão de crédito padrão ou atualize seus dados de cobrança com segurança.</p>
                            <Button
                              onClick={manageSubscription}
                              disabled={portalBusy}
                              className="bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-xl font-bold py-6 px-8 shadow-sm group"
                            >
                              {portalBusy ? 'Conectando...' : 'Abrir Portal do Cliente'} <ExternalLink className="w-4 h-4 ml-3 opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                            </Button>
                          </div>
                        </section>

                        <section className="p-10 bg-indigo-600 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl shadow-indigo-200">
                          <div className="space-y-1 text-center md:text-left">
                            <h4 className="text-2xl font-black text-white tracking-tight">Precisa de escala?</h4>
                            <p className="text-sm text-indigo-100 font-medium">Consulte nossos planos Enterprise para múltiplos usuários e franquias.</p>
                          </div>
                          <Button onClick={() => setShowUpgradeModal(true)} className="bg-white text-indigo-600 hover:bg-slate-50 rounded-2xl font-black uppercase text-xs tracking-[0.1em] h-14 px-10 shadow-lg">Upgrade Já</Button>
                        </section>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Upgrade Modal */}
        <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
          <DialogContent className="max-w-4xl p-0 bg-transparent border-0 shadow-none overflow-hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>Mudar Plano</DialogTitle>
            </DialogHeader>
            <SubscriptionLockOverlay />
          </DialogContent>
        </Dialog>

        {/* Staff Dialgo */}
        <Dialog open={showStaffDialog} onOpenChange={setShowStaffDialog}>
          <DialogContent className="bg-white border-none rounded-3xl p-10 overflow-hidden">
            <DialogHeader className="mb-8">
              <DialogTitle className="text-3xl font-black text-slate-900 tracking-tighter">
                {editingStaff ? 'Configurar Membro' : 'Adicionar Operador'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-sm font-bold text-slate-600">Apelido ou Nome Completo</Label>
                <Input value={staffForm.name} onChange={e => setStaffForm({ ...staffForm, name: e.target.value })} className="h-12 rounded-xl border-slate-200" placeholder="Ex: João Vendedor" />
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-600">PIN de Venda (4 Digitos)</Label>
                  <Input value={staffForm.pin} onChange={e => setStaffForm({ ...staffForm, pin: e.target.value })} className="h-12 rounded-xl border-slate-200 font-mono text-center text-xl tracking-widest" maxLength={4} placeholder="0000" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-600">Nível de Sistema</Label>
                  <select
                    value={staffForm.role}
                    onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}
                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-600/10"
                  >
                    <option value="staff">Vendedor (Staff)</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Permissões de Acesso aos Módulos</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'dashboard', label: 'Dashboard' },
                    { id: 'cashier', label: 'Caixa' },
                    { id: 'inventory', label: 'Estoque' },
                    { id: 'sales', label: 'Vendas' },
                    { id: 'customers', label: 'Clientes' },
                    { id: 'financial', label: 'Financeiro' },
                    { id: 'reports', label: 'Relatórios' },
                    { id: 'crm', label: 'CRM' },
                    { id: 'marketing', label: 'Marketing' },
                    { id: 'settings', label: 'Configurações' },
                  ].map((perm) => (
                    <div key={perm.id} className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <input
                        type="checkbox"
                        id={`perm-${perm.id}`}
                        checked={staffForm.role === 'admin' || !!staffForm.permissions?.[perm.id]}
                        disabled={staffForm.role === 'admin'}
                        onChange={(e) => {
                          const newPerms = { ...staffForm.permissions, [perm.id]: e.target.checked }
                          setStaffForm({ ...staffForm, permissions: newPerms })
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                      />
                      <label htmlFor={`perm-${perm.id}`} className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                        {perm.label}
                      </label>
                    </div>
                  ))}
                </div>
                {staffForm.role === 'admin' && (
                  <p className="text-[10px] text-indigo-500 font-bold italic">* Administradores possuem acesso total por padrão.</p>
                )}
              </div>
              <div className="flex gap-4 pt-8">
                <Button onClick={() => setShowStaffDialog(false)} variant="ghost" className="flex-1 rounded-2xl h-12 uppercase font-bold tracking-widest text-[10px]">Cancelar</Button>
                <Button onClick={saveStaff} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-12 uppercase font-bold tracking-widest text-[10px] shadow-lg shadow-indigo-100">Confirmar Cadastro</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Remove Confirmation */}
        <ConfirmDialog
          open={showConfirmRemovePaymentMethod}
          onOpenChange={setShowConfirmRemovePaymentMethod}
          title="Remover Método de Pagamento"
          description={`Tem certeza que deseja excluir "${methodToRemove}" da sua lista? Esta ação é irreversível.`}
          confirmText="Sim, Remover"
          cancelText="Não, Manter"
          destructive={true}
          onConfirm={() => {
            if (methodToRemove) removePaymentMethod(methodToRemove)
          }}
        />
      </div>
    </RequirePermission>
  )
}
