import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, QrCode, Smartphone, RefreshCw, LogOut, CheckCircle2, Send } from 'lucide-react'
import { supabase } from '@/api/supabaseClient'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useEffectiveSettings } from '@/hooks/useEffectiveSettings'
import QRCode from 'qrcode'

export default function WhatsappSettings() {
    const [status, setStatus] = useState('disconnected') // 'connected', 'disconnected', 'connecting', 'error'
    const [qrCode, setQrCode] = useState(null)
    const [pairingCode, setPairingCode] = useState(null)
    const [loading, setLoading] = useState(false)
    const [instanceData, setInstanceData] = useState(null)
    const [errorDetails, setErrorDetails] = useState(null)
    const [proxyLogs, setProxyLogs] = useState([])
    const [autoSendCashback, setAutoSendCashback] = useState(false)
    const effectiveDetails = useEffectiveSettings()
    const [lastQrHash, setLastQrHash] = useState(null)
    const [staleCount, setStaleCount] = useState(0)
    const [diagEnabled, setDiagEnabled] = useState(false)
    const [qrType, setQrType] = useState(null)
    const [qrGeneratedAt, setQrGeneratedAt] = useState(null)
    const [lastStatusAt, setLastStatusAt] = useState(null)

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

    const checkStatus = async (isPolling = false) => {
        if (!isPolling) setLoading(true)
        setErrorDetails(null)
        try {
            const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: { action: 'get_status' }
            })
            if (error) throw error

            if (data?.error) {
                // Se for polling e der erro de rede, não mudamos o status para erro imediatamente
                // para não assustar o usuário com mensagens vermelhas enquanto ele escaneia
                if (!isPolling) {
                    setStatus('error')
                    setErrorDetails(data.message + (data.details ? `: ${data.details}` : ''))
                }
                return
            }

            // Detecção robusta para Evolution v2
            const instance = data?.instance || data
            const connectionStatus = (instance?.connectionStatus || instance?.state || instance?.status || '').toUpperCase()
            setLastStatusAt(new Date())

            if (connectionStatus === 'OPEN' || connectionStatus === 'CONNECTED') {
                setStatus('connected')
                setQrCode(null)
                setPairingCode(null)
                setLastQrHash(null)
                setStaleCount(0)
            } else if (connectionStatus === 'CONNECTING') {
                setStatus('connecting')
                const qrBase64 = instance?.qrcode?.base64 || data?.qrcode?.base64 || data?.base64
                const pairing = instance?.qrcode?.pairingCode || data?.qrcode?.pairingCode || data?.pairingCode
                const qrCodeValue = instance?.qrcode?.code || data?.qrcode?.code || data?.code
                if (qrBase64) {
                    const img = String(qrBase64).startsWith('data:image') ? qrBase64 : `data:image/png;base64,${qrBase64}`
                    setQrCode(img)
                    setPairingCode(null)
                    setQrType('base64')
                    setQrGeneratedAt(new Date())
                    setLastQrHash(img?.slice(0, 64) || null)
                    setStaleCount(0)
                } else if (pairing) {
                    setPairingCode(String(pairing))
                    setQrCode(null)
                    setQrType('pairing')
                    setQrGeneratedAt(new Date())
                } else if (qrCodeValue) {
                    try {
                        const img = await QRCode.toDataURL(String(qrCodeValue))
                        setQrCode(img)
                        setPairingCode(null)
                        setQrType('code')
                        setQrGeneratedAt(new Date())
                    } catch {}
                } /* Se não veio nada, mantenha o QR atual visível */
            } else if (connectionStatus === 'DISCONNECTED' || connectionStatus === 'CLOSE') {
                // Enquanto usuário está tentando conectar, mantenha o último QR visível
                setStatus(prev => prev === 'connecting' ? 'connecting' : 'disconnected')
                if (instance?.qrcode?.base64) {
                    const img = String(instance.qrcode.base64).startsWith('data:image') ? instance.qrcode.base64 : `data:image/png;base64,${instance.qrcode.base64}`
                    setQrCode(img)
                    setPairingCode(null)
                    setQrType('base64')
                    setQrGeneratedAt(new Date())
                }
            }
            setInstanceData(data)
            setProxyLogs(prev => [...prev.slice(-99), { msg: 'Status', data: { connectionStatus, qrType: qrType || (pairingCode ? 'pairing' : (qrCode ? 'base64/code' : 'none')) } }])
        } catch (e) {
            console.error('Failed to check status:', e)
            if (!isPolling) {
                setStatus('error')
                setErrorDetails(`Erro: ${e.message}`)
            }
        } finally {
            if (!isPolling) setLoading(false)
        }
    }

    const handleConnect = async (silent = false) => {
        if (!silent) setLoading(true)
        // NÃO limpar o QR Code aqui - manter visível
        setErrorDetails(null)
        setProxyLogs([])
        try {
            const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: { action: 'connect' }
            })
            if (error) throw error

            if (data?.log) setProxyLogs(data.log)

            if (data?.error) {
                setStatus('error')
                setErrorDetails(data.message + (data.details ? `: ${data.details}` : ''))
                return
            }

            const qrBase64 = data?.instance?.qrcode?.base64 || data?.qrcode?.base64 || data?.base64
            const pairing = data?.instance?.qrcode?.pairingCode || data?.qrcode?.pairingCode || data?.pairingCode
            const qrCodeValue = data?.instance?.qrcode?.code || data?.qrcode?.code || data?.code

            if (qrBase64) {
                const img = String(qrBase64).startsWith('data:image') ? qrBase64 : `data:image/png;base64,${qrBase64}`
                setQrCode(img)
                setPairingCode(null)
                setQrType('base64')
                setQrGeneratedAt(new Date())
                setStatus('connecting')
            } else if (pairing) {
                setPairingCode(String(pairing))
                setQrCode(null)
                setQrType('pairing')
                setQrGeneratedAt(new Date())
            } else if (qrCodeValue) {
                try {
                    const img = await QRCode.toDataURL(String(qrCodeValue))
                    setQrCode(img)
                    setPairingCode(null)
                    setQrType('code')
                    setQrGeneratedAt(new Date())
                } catch {}
                setStatus('connecting')
            } else if (data?.status === 'connected') {
                setStatus('connected')
                setQrCode(null) // Só limpa quando conectou
            } else {
                setStatus('error')
                setErrorDetails(data.message || "O servidor não retornou um QR Code. Tente novamente em instantes.")
            }
        } catch (e) {
            console.error('Failed to connect:', e)
            setStatus('error')
            setErrorDetails(e.message)
        } finally {
            if (!silent) setLoading(false)
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
        setErrorDetails(null) // Clear previous errors
        try {
            await supabase.functions.invoke('whatsapp-proxy', { body: { action: 'logout' } })
            alert('Instância limpa com sucesso. Agora clique em "Gerar QR Code" novamente.')
            setStatus('disconnected')
            setQrCode(null)
        } catch (e) {
            setStatus('error')
            setErrorDetails(`Erro ao limpar a instância: ${e.message}.`)
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        if (!confirm('Tem certeza que deseja desconectar?')) return
        setLoading(true)
        setErrorDetails(null) // Clear previous errors
        try {
            await supabase.functions.invoke('whatsapp-proxy', {
                body: { action: 'logout' }
            })
            setStatus('disconnected')
            setQrCode(null)
        } catch (e) {
            console.error('Failed to logout:', e)
            setStatus('error')
            setErrorDetails(`Erro ao desconectar: ${e.message}.`)
        } finally {
            setLoading(false)
        }
    }

    // Auto start: checa e tenta conectar ao montar
    useEffect(() => {
        checkStatus()
        handleConnect(true)
    }, [])

    // Polling effect while connecting - USANDO WEBSOCKET
    useEffect(() => {
        let statusInterval = null
        let ws = null

        // Polling rápido para detectar conexão e obter QR atualizado sem reiniciar a sessão
        if (status === 'connecting') {
            statusInterval = setInterval(() => {
                checkStatus(true)
                // Se o QR não mudou por ~1min, força reconectar uma única vez
                setStaleCount(prev => {
                    const next = prev + 1
                    if (next >= 20) { // 20 * 3s ≈ 60s
                        supabase.functions.invoke('whatsapp-proxy', { body: { action: 'logout' } })
                            .catch(() => {}).finally(() => handleConnect(true))
                        return 0
                    }
                    return next
                })
            }, 3000) // Verifica status a cada 3s

            return () => {
                if (statusInterval) clearInterval(statusInterval)
            }
        }

        return () => {
            if (statusInterval) clearInterval(statusInterval)
        }
    }, [status])

    useEffect(() => {
        if (!diagEnabled) return
        const interval = setInterval(() => {
            checkStatus(true)
        }, 2000)
        return () => clearInterval(interval)
    }, [diagEnabled])

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-none shadow-none bg-white/50 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-green-50/50 to-blue-50/50 border-b border-gray-100 pb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                                <span className="text-2xl">💬</span> Conectar WhatsApp
                            </CardTitle>
                            <p className="text-sm text-gray-500 mt-1">
                                Ative mensagens automáticas e melhore a experiência dos seus clientes.
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            {status === 'connected' && <Badge className="bg-green-500 text-white border-none px-3 py-1 text-sm font-semibold shadow-sm">CONECTADO</Badge>}
                            {status === 'connecting' && <Badge className="bg-yellow-400 text-white border-none px-3 py-1 text-sm font-semibold shadow-sm">AGUARDANDO...</Badge>}
                            {status === 'disconnected' && <Badge variant="outline" className="text-gray-400 border-gray-200 px-3 py-1 text-sm font-semibold">DESCONECTADO</Badge>}
                            {status === 'error' && <Badge variant="destructive" className="px-3 py-1 text-sm font-semibold">ERRO NO SERVIDOR</Badge>}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-8 space-y-8">

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

                            <div className="flex items-center justify-center w-[280px] h-[280px] bg-white rounded-3xl border-2 border-dashed border-gray-200 relative group transition-all hover:border-green-300 overflow-hidden shadow-inner">
                                {loading && !qrCode && (
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
                                        <span className="text-xs text-gray-400 font-medium">Iniciando sessão...</span>
                                    </div>
                                )}
                                {!loading && !qrCode && (
                                    <div className="flex flex-col items-center gap-2">
                                        {pairingCode ? (
                                            <div className="text-center">
                                                <div className="text-2xl font-black tracking-widest text-gray-900">{pairingCode}</div>
                                                <div className="text-xs text-gray-400 mt-1">Digite este código no WhatsApp para parear</div>
                                            </div>
                                        ) : (
                                            <>
                                                <Smartphone className="w-12 h-12 text-gray-200 group-hover:scale-110 transition-transform" />
                                                <span className="text-xs text-gray-400">Pronto para gerar</span>
                                            </>
                                        )}
                                    </div>
                                )}
                                {qrCode && (
                                    <div className="relative w-full h-full p-4 animate-in fade-in zoom-in duration-300">
                                        <img src={qrCode} alt="QR Code" className="w-full h-full object-contain" />
                                        {loading && (
                                            <div className="absolute top-2 right-2 bg-white/80 rounded-full p-1 shadow">
                                                <Loader2 className="w-4 h-4 text-green-600 animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="mt-3 text-center md:text-left">
                                <div className="text-xs text-gray-500">
                                    <span className="font-semibold text-gray-700">QR tipo:</span> {qrType || (pairingCode ? 'pairing' : (qrCode ? 'imagem' : 'N/A'))}
                                    {' • '}
                                    <span className="font-semibold text-gray-700">Gerado há:</span> {qrGeneratedAt ? `${Math.floor((Date.now() - qrGeneratedAt.getTime()) / 1000)}s` : 'N/A'}
                                    {' • '}
                                    <span className="font-semibold text-gray-700">Último status:</span> {lastStatusAt ? lastStatusAt.toLocaleTimeString() : 'N/A'}
                                </div>
                            </div>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="p-6 bg-red-50 rounded-2xl border border-red-100 flex flex-col items-center gap-4 animate-in fade-in zoom-in">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                <span className="text-xl">❌</span>
                            </div>
                            <div className="text-center">
                                <h3 className="text-red-900 font-bold">Falha na Conexão</h3>
                                <p className="text-red-700 text-sm mt-1 max-w-[400px]">
                                    {errorDetails || "Não foi possível falar com o servidor Evolution."}
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                className="rounded-xl border-red-200 text-red-700 hover:bg-red-100"
                                onClick={checkStatus}
                            >
                                Tentar Novamente
                            </Button>
                        </div>
                    )}

                    {proxyLogs && proxyLogs.length > 0 && (
                        <div className="mt-8 p-4 bg-gray-900 rounded-xl font-mono text-[10px] text-gray-400 overflow-auto max-h-[200px]">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-green-500">CONDIAG_LOG v1.0</span>
                                <Button variant="ghost" className="h-4 text-[8px] text-gray-500 hover:text-white" onClick={() => setProxyLogs([])}>Limpar</Button>
                            </div>
                            {proxyLogs.map((log, i) => (
                                <div key={i} className="mb-1">
                                    <span className="text-gray-600">[{new Date().toLocaleTimeString()}]</span> {log.msg}
                                    {log.data && <span className="text-blue-400"> - {JSON.stringify(log.data)}</span>}
                                </div>
                            ))}
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
                <div className="flex items-center gap-2">
                    <Switch id="diag-switch" checked={diagEnabled} onCheckedChange={setDiagEnabled} />
                    <label htmlFor="diag-switch" className="text-xs text-gray-500">Diagnóstico em tempo real</label>
                </div>
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
