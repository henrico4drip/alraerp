import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, QrCode, Smartphone, RefreshCw, LogOut, CheckCircle2, Send } from 'lucide-react'
import { supabase } from '@/api/supabaseClient'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useEffectiveSettings } from '@/hooks/useEffectiveSettings'

export default function WhatsappSettings() {
    const [status, setStatus] = useState('disconnected') // 'disconnected' | 'connecting' | 'connected'
    const [qrCode, setQrCode] = useState(null)
    const [loading, setLoading] = useState(false)
    const [instanceData, setInstanceData] = useState(null)
    const [autoSendCashback, setAutoSendCashback] = useState(false)
    const effectiveDetails = useEffectiveSettings()

    useEffect(() => {
        if (effectiveDetails) {
            setAutoSendCashback(!!effectiveDetails.whatsapp_auto_send_cashback)
        }
    }, [effectiveDetails])

    const updateAutoSend = async (enabled) => {
        setAutoSendCashback(enabled)
        try {
            const { user } = (await supabase.auth.getUser()).data
            if (!user) return
            await supabase.from('settings').update({ whatsapp_auto_send_cashback: enabled }).eq('user_id', user.id)
        } catch (e) {
            console.error('Failed to update whatsapp settings:', e)
        }
    }

    const checkStatus = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: { action: 'get_status' }
            })
            if (error) throw error

            // Map Evolution status to connection state
            // Evolution v2 connectionState: 'open', 'close', 'connecting'
            const evoState = data?.instance?.state || 'close'

            if (evoState === 'open') {
                setStatus('connected')
                setQrCode(null)
            } else if (evoState === 'connecting') {
                setStatus('connecting')
            } else {
                setStatus('disconnected')
            }
            setInstanceData(data)
        } catch (e) {
            console.error('Failed to check status:', e)
            setStatus('error')
        } finally {
            setLoading(false)
        }
    }

    const handleConnect = async () => {
        setLoading(true)
        setQrCode(null)
        try {
            const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: { action: 'connect' }
            })
            if (error) throw error

            if (data?.error) {
                const msg = data.message || 'Erro no servidor'
                const details = data.details || ''
                alert(`Erro do Servidor: ${msg}\n${details}`)
                return
            }

            console.log('Connect Data (Full):', data)

            const qrBase64 = data?.instance?.qrcode?.base64 || data?.qrcode?.base64 || data?.base64
            const qrCodeValue = data?.instance?.qrcode?.code || data?.qrcode?.code || data?.code

            if (qrBase64) {
                console.log('QR Code Base64 found!')
                setQrCode(qrBase64)
                setStatus('connecting')
            } else if (qrCodeValue) {
                console.log('Pairing Code found:', qrCodeValue)
                setQrCode(qrCodeValue)
                setStatus('connecting')
            } else {
                console.log('No QR or Code found in data structure.')
                alert(`O servidor respondeu, mas não enviou um QR Code ainda.\n\nResposta do Servidor:\n${JSON.stringify(data, null, 2)}\n\nTente clicar mais uma vez em "Gerar QR Code".`)
            }
        } catch (e) {
            console.error('Failed to connect:', e)
            alert(`Erro na conexão: ${e.message}`)
        } finally {
            setLoading(false)
        }
    }

    const handleDebugList = async () => {
        setLoading(true)
        try {
            const { data } = await supabase.functions.invoke('whatsapp-proxy', { body: { action: 'debug_list' } })
            alert('Instâncias no Servidor:\n' + JSON.stringify(data, null, 2))
        } catch (e) {
            alert('Erro no Diagnóstico: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    const handleForceReset = async () => {
        if (!confirm('Isso vai apagar a instância atual no servidor e tentar criar uma nova. Deseja continuar?')) return
        setLoading(true)
        try {
            await supabase.functions.invoke('whatsapp-proxy', { body: { action: 'logout' } })
            alert('Instância limpa com sucesso. Agora clique em "Gerar QR Code" novamente.')
            setStatus('disconnected')
            setQrCode(null)
        } catch (e) {
            alert('Erro ao limpar: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        if (!confirm('Tem certeza que deseja desconectar?')) return
        setLoading(true)
        try {
            await supabase.functions.invoke('whatsapp-proxy', {
                body: { action: 'logout' }
            })
            setStatus('disconnected')
            setQrCode(null)
        } catch (e) {
            console.error('Failed to logout:', e)
        } finally {
            setLoading(false)
        }
    }

    // Checking status on mount
    useEffect(() => {
        checkStatus()
    }, [])

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-none shadow-none bg-white/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <span className="text-xl">💬</span> Integração WhatsApp
                        {status === 'connected' && <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Conectado</Badge>}
                        {status === 'connecting' && <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-none">Aguardando Leitura</Badge>}
                        {status === 'disconnected' && <Badge variant="outline" className="text-gray-500">Desconectado</Badge>}
                        {status === 'error' && <Badge variant="destructive">Servidor Offline</Badge>}
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                        Conecte seu WhatsApp para enviar mensagens automáticas de Cashback e Comprovantes.
                    </p>
                </CardHeader>
                <CardContent className="space-y-6">

                    {status === 'connected' ? (
                        <div className="flex flex-col items-center justify-center p-8 bg-green-50 rounded-2xl border border-green-100 space-y-4">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-8 h-8 text-green-600" />
                            </div>
                            <div className="text-center">
                                <h3 className="font-bold text-green-900 text-lg">WhatsApp Conectado!</h3>
                                <p className="text-green-700">O sistema está pronto para enviar mensagens.</p>
                            </div>
                            <Button variant="outline" onClick={handleLogout} className="mt-4 border-red-200 text-red-600 hover:bg-red-50">
                                <LogOut className="w-4 h-4 mr-2" /> Desconectar
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col md:flex-row gap-8 items-center justify-center">
                            <div className="space-y-4 max-w-sm text-center md:text-left">
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-gray-900">Como conectar?</h3>
                                    <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                                        <li>Abra o WhatsApp no seu celular</li>
                                        <li>Toque em <span className="font-bold">Aparelhos conectados</span> &gt; <span className="font-bold">Conectar aparelho</span></li>
                                        <li>Aponte a câmera para o QR Code ao lado</li>
                                    </ol>
                                </div>
                                {!qrCode && (
                                    <Button onClick={handleConnect} disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl">
                                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <QrCode className="w-4 h-4 mr-2" />}
                                        {loading ? 'Carregando...' : 'Gerar QR Code'}
                                    </Button>
                                )}
                                <Button variant="ghost" onClick={checkStatus} disabled={loading} size="sm" className="text-xs text-gray-400">
                                    <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} /> Atualizar Status
                                </Button>
                            </div>

                            <div className="flex items-center justify-center w-[280px] h-[280px] bg-white rounded-2xl border-2 border-dashed border-gray-200 relative">
                                {loading && !qrCode && <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />}
                                {!loading && !qrCode && <Smartphone className="w-12 h-12 text-gray-200" />}
                                {qrCode && (
                                    <img src={qrCode} alt="QR Code" className="w-full h-full object-contain p-2" />
                                )}
                            </div>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm text-center">
                            Falha ao comunicar com o servidor de WhatsApp. Verifique se a variável de ambiente <code>EVOLUTION_API_URL</code> está configurada.
                        </div>
                    )}

                    {status === 'connected' && (
                        <div className="pt-6 border-t border-gray-100 space-y-4">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <Send className="w-4 h-4 text-blue-500" /> Automação de Mensagens
                            </h3>
                            <div className="flex items-center justify-between p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Enviar Cashback Automaticamente</Label>
                                    <p className="text-sm text-gray-500">Envia o saldo de cashback para o cliente logo após a venda.</p>
                                </div>
                                <Switch
                                    checked={autoSendCashback}
                                    onCheckedChange={updateAutoSend}
                                />
                            </div>
                        </div>
                    )}

                </CardContent>
            </Card>

            <div className="flex flex-col items-center gap-2">
                <button
                    onClick={handleForceReset}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors underline bg-transparent border-none cursor-pointer"
                >
                    Problemas com o QR Code? Clique aqui para Reset Total da Instância
                </button>
                <button
                    onClick={handleDebugList}
                    className="text-xs text-gray-400 hover:text-blue-500 transition-colors underline bg-transparent border-none cursor-pointer"
                >
                    Diagnosticar Servidor (Ver instâncias ativas)
                </button>
            </div>
        </div>
    )
}
