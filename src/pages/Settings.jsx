import React, { useEffect, useState } from 'react'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/ConfirmDialog'

export default function Settings() {
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
  const [showConfirmRemovePaymentMethod, setShowConfirmRemovePaymentMethod] = useState(false)
  const [confirmRemovePaymentMethod, setConfirmRemovePaymentMethod] = useState('')

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
      try { localStorage.setItem('logo_url', file_url) } catch {}
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
          </div>
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