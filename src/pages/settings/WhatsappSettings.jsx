import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, QrCode, Smartphone, RefreshCw, LogOut, CheckCircle2, Send, AlertCircle, Settings, Terminal, Eye, X, Power, Users, Lock, EyeOff, UserPlus, Pencil, Save, Trash2 } from 'lucide-react'
import { supabase } from '@/api/supabaseClient'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useEffectiveSettings } from '@/hooks/useEffectiveSettings'
import { useEvolution } from '@/contexts/EvolutionContext'
import { useCrm } from '@/contexts/CrmContext'
import { toast } from 'sonner'

export default function WhatsappSettings() {
    const { isConnected, qrCode, pairingCode, loading, error, connect, disconnect, checkStatus, instanceName } = useEvolution()
    const { agents, addAgent, updateAgent, removeAgent, hiddenChatPassword, setHiddenChatPassword, currentUser, setCurrentUser } = useCrm()

    const [proxyLogs, setProxyLogs] = useState([])
    const [autoSendCashback, setAutoSendCashback] = useState(false)
    const effectiveDetails = useEffectiveSettings()
    const [diagEnabled, setDiagEnabled] = useState(false)
    const [syncing, setSyncing] = useState(false)

    // Agent Form State
    const [newAgentName, setNewAgentName] = useState("");
    const [newAgentEmail, setNewAgentEmail] = useState("");
    const [editingAgentId, setEditingAgentId] = useState(null);
    const [editAgentName, setEditAgentName] = useState("");
    const [editAgentEmail, setEditAgentEmail] = useState("");
    const [editAgentRole, setEditAgentRole] = useState("agent");

    // Password state
    const [newPassword, setNewPassword] = useState(hiddenChatPassword);
    const [showPassword, setShowPassword] = useState(false);

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
            toast.success('Configuração de cashback atualizada')
        } catch (e) {
            console.error('Failed to update whatsapp settings:', e)
            toast.error('Erro ao atualizar configuração')
        }
    }

    const removeHiddenPhone = async (phone) => {
        try {
            const { user } = (await supabase.auth.getUser()).data
            if (!user) return
            const currentHidden = effectiveDetails.whatsapp_hidden_phones || []
            const next = currentHidden.filter(p => p !== phone)
            await supabase.from('settings').update({ whatsapp_hidden_phones: next }).eq('user_id', user.id)
            toast.success('Contato restaurado!')
            setTimeout(() => window.location.reload(), 500)
        } catch (e) {
            toast.error('Erro ao remover: ' + e.message)
        }
    }

    const handleForceReset = async () => {
        if (!confirm('Isso vai apagar a instância atual no servidor e tentar criar uma nova. Deseja continuar?')) return
        try {
            await supabase.functions.invoke('whatsapp-proxy', { body: { action: 'delete_instance' } })
            toast.success('Instância limpa! Aguarde um momento e clique em Conectar.')
            checkStatus()
        } catch (e) {
            toast.error('Erro ao limpar: ' + e.message)
        }
    }

    // Agent Handlers
    const handleAddAgent = () => {
        if (!newAgentName.trim() || !newAgentEmail.trim()) return;
        addAgent({
            id: Math.random().toString(36).substr(2, 9),
            name: newAgentName.trim(),
            email: newAgentEmail.trim(),
            avatar: `https://i.pravatar.cc/150?u=${newAgentEmail}`,
            role: "agent"
        });
        setNewAgentName("");
        setNewAgentEmail("");
        toast.success("Agente adicionado");
    };

    const handleSaveAgentEdit = (id) => {
        updateAgent(id, { name: editAgentName, email: editAgentEmail, role: editAgentRole });
        setEditingAgentId(null);
        toast.success("Agente atualizado");
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* 1. WhatsApp Connection */}
            <Card className="border-none shadow-none bg-white/50 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-green-50/50 to-blue-50/50 border-b border-gray-100 pb-6 rounded-t-3xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                                <Smartphone className="w-6 h-6 text-green-600" /> Conectar WhatsApp
                            </CardTitle>
                            <p className="text-sm text-gray-500 mt-1">
                                Instância: <code className="bg-white/50 px-1.5 py-0.5 rounded border">{instanceName}</code>
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            {isConnected ? (
                                <Badge className="bg-green-500 text-white border-none px-3 py-1 text-sm font-semibold shadow-sm">CONECTADO</Badge>
                            ) : qrCode ? (
                                <Badge className="bg-yellow-400 text-white border-none px-3 py-1 text-sm font-semibold shadow-sm">AGUARDANDO LEITURA</Badge>
                            ) : (
                                <Badge variant="outline" className="text-gray-400 border-gray-200 px-3 py-1 text-sm font-semibold">DESCONECTADO</Badge>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-8 space-y-8">
                    {isConnected ? (
                        <div className="flex flex-col items-center justify-center p-8 bg-green-50 rounded-2xl border border-green-100 space-y-4">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-8 h-8 text-green-600" />
                            </div>
                            <div className="text-center">
                                <h3 className="font-bold text-green-900 text-lg">WhatsApp Conectado!</h3>
                                <p className="text-green-700">Tudo pronto para gerenciar suas conversas no CRM.</p>
                            </div>
                            <Button variant="outline" onClick={disconnect} disabled={loading} className="mt-4 border-red-200 text-red-600 hover:bg-red-50">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogOut className="w-4 h-4 mr-2" />}
                                Desconectar Dispositivo
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col md:flex-row gap-8 items-center justify-center">
                            <div className="space-y-4 max-w-sm text-center md:text-left">
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-gray-900">Como conectar?</h3>
                                    <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                                        <li>No celular, abra o <span className="font-bold">WhatsApp</span></li>
                                        <li>Vá em <span className="font-bold">Aparelhos conectados</span></li>
                                        <li>Toque em <span className="font-bold">Conectar aparelho</span></li>
                                        <li>Aponte para o QR Code ao lado</li>
                                    </ol>
                                </div>
                                {!qrCode && !pairingCode && (
                                    <Button onClick={connect} disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl h-12">
                                        {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <QrCode className="w-4 h-4 mr-2" />}
                                        {loading ? 'Preparando Sessão...' : 'Gerar QR Code'}
                                    </Button>
                                )}
                                {(qrCode || pairingCode) && (
                                    <Button variant="ghost" onClick={connect} disabled={loading} size="sm" className="w-full text-xs text-blue-600 hover:bg-blue-50">
                                        <RefreshCw className={`w-3 h-3 mr-2 ${loading ? 'animate-spin' : ''}`} /> Atualizar Código
                                    </Button>
                                )}
                                {error && <p className="text-[10px] text-red-500 bg-red-50 p-2 rounded border border-red-100">{error}</p>}
                                <p className="text-[10px] text-gray-400 text-center">Note: A primeira conexão pode levar até 30 segundos para carregar o QR.</p>
                            </div>

                            <div className="flex items-center justify-center w-[280px] h-[280px] bg-white rounded-3xl border-2 border-dashed border-gray-200 relative group transition-all hover:border-green-300 overflow-hidden shadow-inner">
                                {loading && !qrCode && !pairingCode && (
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
                                        <span className="text-xs text-gray-400 font-medium">Iniciando...</span>
                                    </div>
                                )}
                                {!loading && !qrCode && !pairingCode && (
                                    <div className="flex flex-col items-center gap-2">
                                        <Smartphone className="w-12 h-12 text-gray-200 group-hover:scale-110 transition-transform" />
                                        <span className="text-xs text-gray-400">Pronto para gerar</span>
                                    </div>
                                )}
                                {qrCode && (
                                    <div className="relative w-full h-full p-4 animate-in fade-in zoom-in duration-300">
                                        <img
                                            src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                                            alt="QR Code"
                                            className="w-full h-full object-contain image-rendering-pixelated"
                                        />
                                        {loading && (
                                            <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                                                <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                )}
                                {pairingCode && !qrCode && (
                                    <div className="flex flex-col items-center gap-4 animate-in zoom-in">
                                        <div className="text-3xl font-black tracking-widest text-primary p-4 bg-muted rounded-xl border-2 border-primary/20 font-mono">
                                            {pairingCode}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground text-center px-4">
                                            Digite este código no seu WhatsApp após escolher "Conectar com número de telefone"
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 2. Automation & Sync (Connected Only) */}
            {isConnected && (
                <Card className="border-none shadow-sm bg-white overflow-hidden rounded-3xl">
                    <CardHeader className="border-b bg-gray-50/30">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Send className="w-5 h-5 text-blue-500" /> Automação e Sincronização
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="flex items-center justify-between p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                            <div className="space-y-0.5">
                                <Label className="text-base">Enviar Cashback Automático</Label>
                                <p className="text-sm text-gray-500">Notifica o cliente via WhatsApp logo após a venda.</p>
                            </div>
                            <Switch checked={autoSendCashback} onCheckedChange={updateAutoSend} />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="space-y-0.5">
                                <Label className="text-base">Sincronizar Histórico do Celular</Label>
                                <p className="text-sm text-gray-500">Importa as últimas conversas ativas para o CRM.</p>
                            </div>
                            <Button
                                variant="outline"
                                onClick={async () => {
                                    setSyncing(true)
                                    try {
                                        const { data } = await supabase.functions.invoke('whatsapp-proxy', { body: { action: 'sync_history' } })
                                        toast.success(`${data.count || 0} novas mensagens importadas!`)
                                    } catch (e) { toast.error('Falha na sincronização') }
                                    finally { setSyncing(false) }
                                }}
                                disabled={syncing}
                            >
                                {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                Sincronizar Agora
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 3. CRM Team Management (Agents) */}
            <Card className="border-none shadow-sm bg-white overflow-hidden rounded-3xl">
                <CardHeader className="border-b bg-gray-50/30">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-500" /> Agentes de Atendimento (CRM)
                    </CardTitle>
                    <CardDescription>Gerencie quem pode responder clientes no CRM</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <div className="space-y-4 p-4 bg-muted/20 rounded-2xl border border-dashed">
                        <h4 className="text-sm font-semibold flex items-center gap-2"><UserPlus className="w-4 h-4" /> Adicionar Novo Agente</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input placeholder="Nome" value={newAgentName} onChange={e => setNewAgentName(e.target.value)} />
                            <Input placeholder="Email" value={newAgentEmail} onChange={e => setNewAgentEmail(e.target.value)} />
                        </div>
                        <Button onClick={handleAddAgent} className="w-full bg-indigo-600 hover:bg-indigo-700">Adicionar Agente</Button>
                    </div>

                    <div className="space-y-3">
                        {agents.map(agent => (
                            <div key={agent.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <img src={agent.avatar} className="w-10 h-10 rounded-full border shadow-sm" alt={agent.name} />
                                    <div>
                                        <p className="font-medium text-sm">{agent.name}</p>
                                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{agent.role}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600" onClick={() => removeAgent(agent.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* 4. Privacy & Hidden Chats */}
            <Card className="border-none shadow-sm bg-white overflow-hidden rounded-3xl">
                <CardHeader className="border-b bg-amber-50/30">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Lock className="w-5 h-5 text-amber-500" /> Privacidade: Conversas Ocultas
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                    <div className="space-y-2">
                        <Label>Senha de Desbloqueio (CRM)</Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    className="pr-10"
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-gray-400">
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            <Button variant="secondary" onClick={() => { setHiddenChatPassword(newPassword); toast.success('Senha atualizada'); }}>Salvar Senha</Button>
                        </div>
                    </div>

                    {effectiveDetails?.whatsapp_hidden_phones?.length > 0 && (
                        <div className="pt-4 space-y-3">
                            <Label className="text-xs text-gray-400 uppercase font-bold">Contatos Atualmente Ocultos</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {effectiveDetails.whatsapp_hidden_phones.map(phone => (
                                    <div key={phone} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border group">
                                        <span className="text-sm font-medium text-gray-600">{phone}</span>
                                        <Button variant="ghost" size="sm" onClick={() => removeHiddenPhone(phone)} className="h-7 w-7 p-0 text-gray-400 hover:text-red-500">
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 5. Emergency & Diagnostics */}
            <div className="flex flex-col items-center gap-4 py-8">
                <button onClick={handleForceReset} className="text-xs text-gray-400 hover:text-red-500 transition-colors underline">
                    Problemas com o QR Code? Clique para Reset Total da Instância
                </button>
                <div className="flex items-center gap-4 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1"><Smartphone className="w-3 h-3" /> Instance: {instanceName}</span>
                    <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Manual check needed?</span>
                    <button onClick={() => checkStatus()} className="underline hover:text-blue-500">Verificar Status Agora</button>
                </div>
            </div>
        </div>
    )
}
