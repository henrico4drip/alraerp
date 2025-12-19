import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, AlertTriangle, FileUp } from 'lucide-react'
import { supabase } from '@/api/supabaseClient'
import { useEffectiveSettings } from '@/hooks/useEffectiveSettings'

export default function FiscalSettings() {
    const effectiveDetails = useEffectiveSettings()
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState({ type: '', text: '' })

    // Fiscal State
    const [enabled, setEnabled] = useState(false)
    const [environment, setEnvironment] = useState('homologacao') // 'homologacao' | 'producao'
    const [cscId, setCscId] = useState('')
    const [cscToken, setCscToken] = useState('')
    const [series, setSeries] = useState('1')
    const [nextNumber, setNextNumber] = useState('')
    const [regime, setRegime] = useState('1') // 1=Simples, 3=Normal

    // Certificate Upload State
    const [certFile, setCertFile] = useState(null)
    const [certPassword, setCertPassword] = useState('')
    const [showCertDialog, setShowCertDialog] = useState(false)

    // Read existing settings
    useEffect(() => {
        if (effectiveDetails) {
            setEnvironment(effectiveDetails.focus_environment || 'homologacao')
            setCscId(effectiveDetails.fiscal_csc_id || '')
            setCscToken(effectiveDetails.fiscal_csc_token || '')
            setSeries(effectiveDetails.fiscal_series || '1')
            setNextNumber(effectiveDetails.fiscal_next_number || '')
            setRegime(effectiveDetails.fiscal_regime || '1')
            // If we have a focus_company_id, it means it's "enabled" / registered
            setEnabled(!!effectiveDetails.focus_company_id)
        }
    }, [effectiveDetails])

    const handleSaveSettings = async () => {
        setLoading(true)
        setMessage('')
        try {
            const { user } = (await supabase.auth.getUser()).data
            if (!user) throw new Error('Não autenticado')

            // 1. Save Basic Settings to DB directly
            const payload = {
                focus_environment: environment,
                fiscal_csc_id: cscId,
                fiscal_csc_token: cscToken,
                fiscal_series: parseInt(series),
                fiscal_next_number: nextNumber ? parseInt(nextNumber) : null,
                fiscal_regime: regime
            }

            const { error } = await supabase
                .from('settings')
                .update(payload)
                .eq('user_id', user.id)

            if (error) throw error

            // 2. If Certificate is provided, Register Company via Edge Function
            if (certFile && certPassword) {
                await registerCompany()
            }

            setMessage({ type: 'success', text: 'Configurações fiscais salvas com sucesso!' })
        } catch (e) {
            console.error(e)
            setMessage({ type: 'error', text: 'Erro ao salvar: ' + e.message })
        } finally {
            setLoading(false)
        }
    }

    const registerCompany = async () => {
        // Read file as base64
        const reader = new FileReader()
        const filePromise = new Promise((resolve, reject) => {
            reader.onload = () => {
                // Remove data URL prefix (e.g. "data:application/x-pkcs12;base64,")
                const b64 = reader.result.split(',')[1]
                resolve(b64)
            }
            reader.onerror = reject
        })
        reader.readAsDataURL(certFile)
        const certB64 = await filePromise

        // Call Edge Function
        const { data: { session } } = await supabase.auth.getSession()

        // Using simple fetch to local edge function for now (or deployed url)
        // In production we should use supabase.functions.invoke but that requires setup
        // We will assume the user has to deploy it. For dev we can use direct URL if serving locally?
        // Let's us functions.invoke which is the standard way.

        const { data, error } = await supabase.functions.invoke('focus-nfe-proxy', {
            body: {
                action: 'register_company',
                payload: {
                    environment, // Use selected environment
                    cnpj: effectiveDetails.company_cnpj?.replace(/\D/g, ''),
                    razao_social: effectiveDetails.erp_name,
                    nome_fantasia: effectiveDetails.erp_name,
                    // We need to ensure we have address fields in settings or use defaults/validate
                    logradouro: effectiveDetails.company_address || 'Endereço não informado', // Demo fallback
                    numero: '0', // Demo fallback
                    bairro: 'Centro',
                    municipio: effectiveDetails.company_city || 'Cidade',
                    uf: effectiveDetails.company_state || 'UF',
                    cep: effectiveDetails.company_zip || '00000000',
                    inscricao_estadual: 'ISENTO', // We need to add IE to settings if not there
                    regime_tributario: regime,
                    certificado_b64: certB64,
                    senha_certificado: certPassword
                }
            }
        })

        if (error) throw error
        if (data?.error) throw new Error(data.error)

        // Update settings with the returned ID
        if (data.id) {
            const { user } = (await supabase.auth.getUser()).data
            await supabase.from('settings').update({ focus_company_id: String(data.id) }).eq('user_id', user.id)
            setEnabled(true)
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-none shadow-none bg-white/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <span className="text-xl">🏛️</span> Emissão Fiscal (NFCe)
                        {enabled && <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Ativo</Badge>}
                        {!enabled && <Badge variant="outline" className="text-gray-500">Inativo</Badge>}
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                        Configure a emissão de Nota Fiscal de Consumidor Eletrônica.
                        Utilizamos a API da Focus NFe.
                    </p>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Environment Switch */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="space-y-1">
                            <Label className="text-base font-semibold">Ambiente</Label>
                            <p className="text-xs text-gray-500">
                                Homologação para testes (sem valor fiscal) ou Produção para valer.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-sm ${environment === 'homologacao' ? 'font-bold text-blue-600' : 'text-gray-400'}`}>Teste</span>
                            <Switch
                                checked={environment === 'producao'}
                                onCheckedChange={(c) => setEnvironment(c ? 'producao' : 'homologacao')}
                            />
                            <span className={`text-sm ${environment === 'producao' ? 'font-bold text-red-600' : 'text-gray-400'}`}>Produção</span>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Certificate Section */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-900 border-b pb-2">Certificado Digital (A1)</h3>
                            <div className="p-4 border-2 border-dashed border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-center cursor-pointer relative">
                                <input
                                    type="file"
                                    accept=".pfx,.p12"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={(e) => setCertFile(e.target.files[0])}
                                />
                                <div className="flex flex-col items-center gap-2 text-gray-500">
                                    <FileUp className="w-8 h-8 text-blue-400" />
                                    {certFile ? (
                                        <span className="font-medium text-blue-600">{certFile.name}</span>
                                    ) : (
                                        <span>Clique para selecionar o arquivo .pfx ou .p12</span>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Senha do Certificado</Label>
                                <Input
                                    type="password"
                                    value={certPassword}
                                    onChange={(e) => setCertPassword(e.target.value)}
                                    placeholder="••••"
                                    className="rounded-xl"
                                />
                            </div>
                            <div className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded-lg flex gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <p>O certificado é enviado diretamente para a Focus NFe para registro da empresa. Não armazenamos sua senha.</p>
                            </div>
                        </div>

                        {/* CSC & Configuration */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-900 border-b pb-2">Configuração SEFAZ</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>CSC ID (Token ID)</Label>
                                    <Input
                                        value={cscId}
                                        onChange={(e) => setCscId(e.target.value)}
                                        placeholder="Ex: 000001"
                                        className="rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>CSC Token (Código)</Label>
                                    <Input
                                        value={cscToken}
                                        onChange={(e) => setCscToken(e.target.value)}
                                        placeholder="Ex: 34AS...23"
                                        className="rounded-xl"
                                        type="password"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Série NFCe</Label>
                                    <Input
                                        value={series}
                                        onChange={(e) => setSeries(e.target.value)}
                                        placeholder="1"
                                        className="rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Regime Tributário</Label>
                                    <Select value={regime} onValueChange={setRegime}>
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">Simples Nacional</SelectItem>
                                            <SelectItem value="3">Regime Normal</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {message.text && (
                        <div className={`p-4 rounded-xl flex items-center gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                            {message.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                            {message.text}
                        </div>
                    )}

                    <div className="flex justify-end pt-4">
                        <Button
                            onClick={handleSaveSettings}
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 h-12 text-base shadow-lg shadow-blue-200"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                            {loading ? 'Processando...' : 'Salvar e Ativar'}
                        </Button>
                    </div>

                </CardContent>
            </Card>
        </div>
    )
}
