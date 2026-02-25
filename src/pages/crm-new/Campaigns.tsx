import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import CRMLayout from "@/components/CRMLayout";
import { useEvolution } from "@/contexts/EvolutionContext";
import { useCrm } from "@/contexts/CrmContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    Search, Send, Loader2, RefreshCw, Tag, Phone, Plus, X, Users, CheckCircle2,
    Clock, AlertCircle, Megaphone, Zap, Filter, ChevronRight, Trash2, Play,
    PauseCircle, BarChart3, MessageSquare, Eye, Calendar, ArrowLeft, Check,
    Copy, Timer, UserPlus, Hash, Pause, Paperclip
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPhoneNumber, isSameJid } from "@/lib/evolution";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Campaign = {
    id: string;
    name: string;
    message: string;
    audience: 'all' | 'tag' | 'manual';
    audienceTag?: string;
    audienceManual?: string[]; // list of JIDs
    status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'paused' | 'failed';
    scheduledAt?: string; // ISO date
    createdAt: number;
    completedAt?: number;
    stats: {
        total: number;
        sent: number;
        delivered: number;
        failed: number;
    };
    delayMin: number; // seconds between messages
    delayMax: number;
    mediaUrl?: string;
    mediaType?: 'image' | 'video' | 'audio' | 'document';
    mediaFileName?: string;
};

const STORAGE_KEY = 'crm_campaigns';

function loadCampaigns(): Campaign[] {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { return []; }
}

function saveCampaigns(campaigns: Campaign[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns));
}

// Variable replacement helper
function replaceVariables(text: string, contact: any): string {
    const name = contact.name || contact.pushName || 'Cliente';
    const phone = formatPhoneNumber(contact.id || contact.remoteJid || '');
    const firstName = name.split(' ')[0];
    return text
        .replace(/\{\{nome\}\}/gi, name)
        .replace(/\{\{primeiro_nome\}\}/gi, firstName)
        .replace(/\{\{telefone\}\}/gi, phone)
        .replace(/\{\{name\}\}/gi, name)
        .replace(/\{\{first_name\}\}/gi, firstName)
        .replace(/\{\{phone\}\}/gi, phone);
}

// Status badge component
const StatusBadge = ({ status }: { status: Campaign['status'] }) => {
    const config: Record<string, { bg: string, text: string, icon: any, label: string }> = {
        draft: { bg: 'bg-gray-100', text: 'text-gray-600', icon: Clock, label: 'Rascunho' },
        scheduled: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Calendar, label: 'Agendada' },
        sending: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Send, label: 'Enviando...' },
        completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2, label: 'Concluída' },
        paused: { bg: 'bg-orange-100', text: 'text-orange-700', icon: PauseCircle, label: 'Pausada' },
        failed: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertCircle, label: 'Falha' },
    };
    const c = config[status] || config.draft;
    const Icon = c.icon;
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
            <Icon className="h-3 w-3" /> {c.label}
        </span>
    );
};

export default function Campaigns() {
    const { api, isConnected, resolveName } = useEvolution();
    const { contactTags, hiddenContacts, agents } = useCrm();

    const [campaigns, setCampaigns] = useState<Campaign[]>(loadCampaigns);
    const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
    const [chats, setChats] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const activeCampaignsRef = useRef<{ [key: string]: 'sending' | 'paused' | 'cancelled' }>({});

    // Form state
    const [formName, setFormName] = useState('');
    const [formMessage, setFormMessage] = useState('');
    const [formAudience, setFormAudience] = useState<'all' | 'tag' | 'manual'>('all');
    const [formTag, setFormTag] = useState('');
    const [formManualContacts, setFormManualContacts] = useState<string[]>([]);
    const [formDelayMin, setFormDelayMin] = useState(3);
    const [formDelayMax, setFormDelayMax] = useState(8);
    const [formScheduled, setFormScheduled] = useState(false);
    const [formScheduleDate, setFormScheduleDate] = useState('');
    const [searchContact, setSearchContact] = useState('');
    const [sendingCampaignId, setSendingCampaignId] = useState<string | null>(null);
    const [formMedia, setFormMedia] = useState<{ url: string, type: 'image' | 'video' | 'audio' | 'document', fileName?: string } | null>(null);

    // Save campaigns to localStorage whenever they change
    useEffect(() => {
        saveCampaigns(campaigns);
    }, [campaigns]);

    // Load chats on mount
    useEffect(() => {
        if (api && isConnected) {
            api.fetchChats().then((r: any) => setChats(r || []));
        }
    }, [api, isConnected]);

    // All tags from CRM
    const allTags = useMemo(() => {
        const tagSet = new Set<string>();
        Object.values(contactTags).forEach(tags => {
            tags.forEach(t => tagSet.add(t));
        });
        return Array.from(tagSet).sort();
    }, [contactTags]);

    // Available contacts (filtered, not hidden)
    const availableContacts = useMemo(() => {
        return chats.filter(c => {
            const jid = c.id || c.remoteJid;
            if (!jid || jid.includes('@g.us')) return false;
            if (hiddenContacts.some(hc => isSameJid(hc, jid))) return false;
            return true;
        });
    }, [chats, hiddenContacts]);

    // Get audience for a campaign
    const getAudienceContacts = useCallback((campaign: Campaign) => {
        if (campaign.audience === 'all') return availableContacts;
        if (campaign.audience === 'tag' && campaign.audienceTag) {
            return availableContacts.filter(c => {
                const jid = c.id || c.remoteJid;
                return contactTags[jid]?.includes(campaign.audienceTag!);
            });
        }
        if (campaign.audience === 'manual' && campaign.audienceManual) {
            return availableContacts.filter(c => {
                const jid = c.id || c.remoteJid;
                return campaign.audienceManual!.some(m => isSameJid(m, jid));
            });
        }
        return [];
    }, [availableContacts, contactTags]);

    // Filtered contacts for manual selection
    const filteredManualContacts = useMemo(() => {
        if (!searchContact) return availableContacts.slice(0, 50);
        const q = searchContact.toLowerCase();
        return availableContacts.filter(c => {
            const name = c.name || c.pushName || '';
            const phone = formatPhoneNumber(c.id || c.remoteJid || '');
            return name.toLowerCase().includes(q) || phone.includes(q);
        }).slice(0, 50);
    }, [availableContacts, searchContact]);

    // Create campaign
    const handleCreateCampaign = () => {
        if (!formName.trim()) { toast.error("Nome da campanha é obrigatório"); return; }
        if (!formMessage.trim()) { toast.error("Mensagem é obrigatória"); return; }
        if (formAudience === 'tag' && !formTag) { toast.error("Selecione uma tag"); return; }
        if (formAudience === 'manual' && formManualContacts.length === 0) { toast.error("Selecione ao menos 1 contato"); return; }

        const newCampaign: Campaign = {
            id: 'camp-' + Date.now(),
            name: formName.trim(),
            message: formMessage.trim(),
            audience: formAudience,
            audienceTag: formAudience === 'tag' ? formTag : undefined,
            audienceManual: formAudience === 'manual' ? formManualContacts : undefined,
            status: formScheduled ? 'scheduled' : 'draft',
            scheduledAt: formScheduled ? formScheduleDate : undefined,
            createdAt: Date.now(),
            stats: { total: 0, sent: 0, delivered: 0, failed: 0 },
            delayMin: formDelayMin,
            delayMax: formDelayMax,
            mediaUrl: formMedia?.url,
            mediaType: formMedia?.type,
            mediaFileName: formMedia?.fileName,
        };

        const audience = getAudienceContacts(newCampaign);
        newCampaign.stats.total = audience.length;

        setCampaigns(prev => [newCampaign, ...prev]);
        toast.success(`Campanha "${formName}" criada com ${audience.length} destinatários!`);
        resetForm();
        setView('list');
    };

    const resetForm = () => {
        setFormName('');
        setFormMessage('');
        setFormAudience('all');
        setFormTag('');
        setFormManualContacts([]);
        setFormDelayMin(3);
        setFormDelayMax(8);
        setFormScheduled(false);
        setFormScheduleDate('');
        setSearchContact('');
        setFormMedia(null);
    };

    // Send campaign
    const handleSendCampaign = async (campaign: Campaign) => {
        if (!api || !isConnected) {
            toast.error("WhatsApp não conectado");
            return;
        }

        setSendingCampaignId(campaign.id);
        const audience = getAudienceContacts(campaign);

        setCampaigns(prev => prev.map(c =>
            c.id === campaign.id ? { ...c, status: 'sending', stats: { ...c.stats, total: audience.length } } : c
        ));

        let sent = 0;
        let failed = 0;

        activeCampaignsRef.current[campaign.id] = 'sending';

        for (const contact of audience) {
            if (activeCampaignsRef.current[campaign.id] === 'cancelled') break;

            while (activeCampaignsRef.current[campaign.id] === 'paused') {
                await new Promise(r => setTimeout(r, 1000));
            }

            const jid = contact.id || contact.remoteJid;
            const personalizedMsg = replaceVariables(campaign.message, contact);

            try {
                if (campaign.mediaUrl) {
                    await api.sendMediaMessage(jid, campaign.mediaType || 'document', campaign.mediaUrl, personalizedMsg, campaign.mediaFileName);
                } else {
                    await api.sendTextMessage(jid, personalizedMsg);
                }
                sent++;
            } catch (err) {
                failed++;
                console.error(`[Campaign] Failed to send to ${jid}:`, err);
            }

            // Update progress
            setCampaigns(prev => prev.map(c =>
                c.id === campaign.id ? { ...c, stats: { ...c.stats, sent, delivered: sent, failed } } : c
            ));

            // Random delay between messages
            const delay = (campaign.delayMin + Math.random() * (campaign.delayMax - campaign.delayMin)) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        if (activeCampaignsRef.current[campaign.id] !== 'cancelled') {
            setCampaigns(prev => prev.map(c =>
                c.id === campaign.id ? {
                    ...c,
                    status: failed === audience.length ? 'failed' : 'completed',
                    completedAt: Date.now(),
                    stats: { total: audience.length, sent, delivered: sent, failed }
                } : c
            ));
        }

        delete activeCampaignsRef.current[campaign.id];

        setSendingCampaignId(null);
        toast.success(`Campanha concluída! ${sent} enviadas, ${failed} falhas.`);
    };

    const handleStopAll = () => {
        Object.keys(activeCampaignsRef.current).forEach(id => {
            activeCampaignsRef.current[id] = 'paused';
        });
        setCampaigns(prev => prev.map(c => c.status === 'sending' ? { ...c, status: 'paused' } : c));
        setSendingCampaignId(null);
        toast.info("Todos os envios foram pausados.");
    };

    const handleDeleteCampaign = (id: string) => {
        if (!confirm("Excluir esta campanha?")) return;
        activeCampaignsRef.current[id] = 'cancelled';
        setCampaigns(prev => prev.filter(c => c.id !== id));
        if (selectedCampaign?.id === id) {
            setSelectedCampaign(null);
            setView('list');
        }
        toast.success("Campanha excluída");
    };

    // Duplicate campaign
    const handleDuplicate = (campaign: Campaign) => {
        const dup: Campaign = {
            ...campaign,
            id: 'camp-' + Date.now(),
            name: campaign.name + ' (Cópia)',
            status: 'draft',
            createdAt: Date.now(),
            completedAt: undefined,
            stats: { total: campaign.stats.total, sent: 0, delivered: 0, failed: 0 },
        };
        setCampaigns(prev => [dup, ...prev]);
        toast.success("Campanha duplicada");
    };

    // Stats summary
    const totalSent = campaigns.reduce((sum, c) => sum + c.stats.sent, 0);
    const totalCampaigns = campaigns.length;
    const activeSending = campaigns.filter(c => c.status === 'sending').length;

    return (
        <CRMLayout>
            <div className="flex flex-col h-[calc(100vh-2rem)] m-3 bg-white rounded-2xl shadow-sm border border-gray-200/60 overflow-hidden">

                {/* Header */}
                <div className="border-b border-gray-100">
                    <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 p-5 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2.5">
                                    {view !== 'list' && (
                                        <button onClick={() => { setView('list'); setSelectedCampaign(null); }} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                                            <ArrowLeft className="h-4 w-4" />
                                        </button>
                                    )}
                                    <h1 className="text-xl font-bold tracking-tight">
                                        {view === 'create' ? 'Nova Campanha' : view === 'detail' ? selectedCampaign?.name : 'Campanhas'}
                                    </h1>
                                </div>
                                <div className="flex items-center gap-3 mt-1.5">
                                    <span className="text-white/80 text-xs flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full">
                                        <Megaphone className="h-3 w-3" /> {totalCampaigns} campanhas
                                    </span>
                                    <span className="text-white/80 text-xs flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full">
                                        <Send className="h-3 w-3" /> {totalSent} enviadas
                                    </span>
                                    {activeSending > 0 && (
                                        <span className="text-white text-xs font-medium flex items-center gap-1.5 bg-amber-500/40 px-2.5 py-1 rounded-full animate-pulse">
                                            <Loader2 className="h-3 w-3 animate-spin" /> {activeSending} ativas
                                        </span>
                                    )}
                                </div>
                            </div>
                            {view === 'list' && (
                                <div className="flex gap-2">
                                    {activeSending > 0 && (
                                        <Button
                                            variant="destructive"
                                            onClick={handleStopAll}
                                            className="rounded-xl shadow-lg font-semibold bg-red-600 hover:bg-red-700"
                                        >
                                            <PauseCircle className="mr-2 h-4 w-4" /> Parar Tudo
                                        </Button>
                                    )}
                                    <Button
                                        onClick={() => { resetForm(); setView('create'); }}
                                        className="rounded-xl shadow-lg bg-white text-teal-600 hover:bg-white/90 font-semibold"
                                    >
                                        <Plus className="mr-2 h-4 w-4" /> Nova Campanha
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    {view === 'list' && (
                        <ScrollArea className="h-full">
                            <div className="p-5 space-y-3">
                                {campaigns.length === 0 ? (
                                    <div className="text-center py-16">
                                        <div className="h-16 w-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                                            <Megaphone className="h-8 w-8 text-emerald-500" />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-800 mb-2">Nenhuma campanha criada</h3>
                                        <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">
                                            Crie campanhas de mensagens em massa para enviar para todos os seus contatos ou segmentos específicos por tags.
                                        </p>
                                        <Button
                                            onClick={() => { resetForm(); setView('create'); }}
                                            className="rounded-xl shadow-md bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                                        >
                                            <Plus className="mr-2 h-4 w-4" /> Criar Primeira Campanha
                                        </Button>
                                    </div>
                                ) : (
                                    campaigns.map(campaign => {
                                        const progress = campaign.stats.total > 0
                                            ? Math.round((campaign.stats.sent / campaign.stats.total) * 100)
                                            : 0;

                                        return (
                                            <div
                                                key={campaign.id}
                                                className="border border-gray-200/60 rounded-xl p-4 hover:shadow-md transition-all group cursor-pointer bg-white"
                                                onClick={() => { setSelectedCampaign(campaign); setView('detail'); }}
                                            >
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h3 className="text-sm font-bold text-gray-900 truncate">{campaign.name}</h3>
                                                            <StatusBadge status={campaign.status} />
                                                        </div>
                                                        <p className="text-[11px] text-gray-500 truncate max-w-md">{campaign.message}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-3">
                                                        {campaign.status === 'draft' && (
                                                            <Button
                                                                size="sm"
                                                                className="h-7 px-2 text-[10px] bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg"
                                                                onClick={(e) => { e.stopPropagation(); handleSendCampaign(campaign); }}
                                                            >
                                                                <Play className="h-3 w-3 mr-1" /> Enviar
                                                            </Button>
                                                        )}
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 w-7 p-0 text-gray-400 hover:text-blue-500 rounded-lg"
                                                            onClick={(e) => { e.stopPropagation(); handleDuplicate(campaign); }}
                                                            title="Duplicar"
                                                        >
                                                            <Copy className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 w-7 p-0 text-gray-400 hover:text-red-500 rounded-lg"
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteCampaign(campaign.id); }}
                                                            title="Excluir"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 text-[10px] text-gray-400">
                                                    <span className="flex items-center gap-1">
                                                        <Users className="h-3 w-3" /> {campaign.stats.total} destinatários
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Send className="h-3 w-3" /> {campaign.stats.sent} enviadas
                                                    </span>
                                                    {campaign.stats.failed > 0 && (
                                                        <span className="flex items-center gap-1 text-red-400">
                                                            <AlertCircle className="h-3 w-3" /> {campaign.stats.failed} falhas
                                                        </span>
                                                    )}
                                                    <span className="ml-auto">
                                                        {format(new Date(campaign.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                                    </span>
                                                </div>

                                                {(campaign.status === 'sending' || campaign.status === 'completed') && (
                                                    <div className="mt-2.5">
                                                        <div className="flex items-center justify-between text-[9px] font-semibold mb-1">
                                                            <span className="text-gray-500">Progresso</span>
                                                            <span className={campaign.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'}>{progress}%</span>
                                                        </div>
                                                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-500 ${campaign.status === 'completed' ? 'bg-gradient-to-r from-emerald-400 to-green-500' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`}
                                                                style={{ width: `${progress}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </ScrollArea>
                    )}

                    {view === 'create' && (
                        <ScrollArea className="h-full">
                            <div className="p-6 max-w-2xl mx-auto space-y-6">
                                {/* Campaign Name */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Nome da Campanha</Label>
                                    <Input
                                        value={formName}
                                        onChange={e => setFormName(e.target.value)}
                                        placeholder="Ex: Promoção de Verão, Follow-up Clientes..."
                                        className="h-11 rounded-xl text-sm"
                                        autoFocus
                                    />
                                </div>

                                {/* Message */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Mensagem</Label>
                                        <div className="flex gap-1">
                                            {['{{nome}}', '{{primeiro_nome}}', '{{telefone}}'].map(v => (
                                                <button
                                                    key={v}
                                                    onClick={() => setFormMessage(prev => prev + ' ' + v)}
                                                    className="text-[9px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-semibold hover:bg-indigo-100 transition-colors border border-indigo-200/50"
                                                >
                                                    {v}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <Textarea
                                        value={formMessage}
                                        onChange={e => setFormMessage(e.target.value)}
                                        placeholder="Olá {{primeiro_nome}}! Temos uma oferta especial para você..."
                                        className="min-h-[140px] rounded-xl text-sm bg-gray-50 border-0 focus:ring-2 focus:ring-teal-500/20"
                                    />
                                    <p className="text-[10px] text-gray-400">
                                        Use variáveis: <strong>{`{{nome}}`}</strong> = Nome completo, <strong>{`{{primeiro_nome}}`}</strong> = Primeiro nome, <strong>{`{{telefone}}`}</strong> = Telefone
                                    </p>
                                </div>

                                {/* Media Attachment */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <Paperclip className="h-3.5 w-3.5 text-gray-400" /> Anexo (Mídia)
                                    </Label>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 relative">
                                            <Input
                                                type="file"
                                                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                                                className="hidden"
                                                id="media-upload"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    if (file.size > 5 * 1024 * 1024) {
                                                        toast.error("Limite de 5MB excedido.");
                                                        return;
                                                    }
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => {
                                                        const base64 = ev.target?.result as string;
                                                        let type: any = 'document';
                                                        if (file.type.startsWith('image/')) type = 'image';
                                                        else if (file.type.startsWith('video/')) type = 'video';
                                                        else if (file.type.startsWith('audio/')) type = 'audio';
                                                        setFormMedia({ url: base64, type, fileName: file.name });
                                                    };
                                                    reader.readAsDataURL(file);
                                                }}
                                            />
                                            <Label
                                                htmlFor="media-upload"
                                                className="flex items-center justify-center w-full h-11 px-4 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:border-teal-500 hover:text-teal-600 hover:bg-teal-50 transition-colors cursor-pointer"
                                            >
                                                {formMedia ? formMedia.fileName : 'Selecionar arquivo (Max 5MB)'}
                                            </Label>
                                        </div>
                                        {formMedia && (
                                            <Button
                                                variant="outline"
                                                className="h-11 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => setFormMedia(null)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Audience */}
                                <div className="space-y-3">
                                    <Label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Audiência</Label>

                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { key: 'all' as const, label: 'Todos os Contatos', icon: Users, desc: `${availableContacts.length} contatos`, gradient: 'from-blue-500 to-indigo-600' },
                                            { key: 'tag' as const, label: 'Por Tag', icon: Tag, desc: `${allTags.length} tags`, gradient: 'from-violet-500 to-purple-600' },
                                            { key: 'manual' as const, label: 'Seleção Manual', icon: UserPlus, desc: 'Escolha contatos', gradient: 'from-amber-500 to-orange-500' },
                                        ].map(opt => (
                                            <button
                                                key={opt.key}
                                                onClick={() => setFormAudience(opt.key)}
                                                className={`p-3.5 rounded-xl border-2 transition-all text-left ${formAudience === opt.key
                                                    ? 'border-teal-500 bg-teal-50 shadow-md shadow-teal-100'
                                                    : 'border-gray-200 hover:border-gray-300 bg-white'
                                                    }`}
                                            >
                                                <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${opt.gradient} flex items-center justify-center mb-2`}>
                                                    <opt.icon className="h-4 w-4 text-white" />
                                                </div>
                                                <p className="text-xs font-bold text-gray-800">{opt.label}</p>
                                                <p className="text-[10px] text-gray-400">{opt.desc}</p>
                                            </button>
                                        ))}
                                    </div>

                                    {formAudience === 'tag' && (
                                        <div className="flex flex-wrap gap-1.5 p-3 bg-gray-50 rounded-xl">
                                            {allTags.map((tag, idx) => {
                                                const colors = ['bg-violet-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-cyan-500', 'bg-pink-500', 'bg-orange-500', 'bg-teal-500'];
                                                return (
                                                    <button
                                                        key={tag}
                                                        onClick={() => setFormTag(tag)}
                                                        className={`text-[11px] px-3 py-1.5 rounded-full font-semibold transition-all border ${formTag === tag
                                                            ? `${colors[idx % colors.length]} text-white border-transparent shadow-md`
                                                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                                            }`}
                                                    >
                                                        #{tag}
                                                    </button>
                                                );
                                            })}
                                            {allTags.length === 0 && (
                                                <p className="text-xs text-gray-400 py-2">Nenhuma tag cadastrada. Adicione tags aos contatos pelo Inbox.</p>
                                            )}
                                        </div>
                                    )}

                                    {formAudience === 'manual' && (
                                        <div className="space-y-2">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                                <Input
                                                    placeholder="Buscar contato..."
                                                    className="pl-9 h-9 rounded-xl text-xs"
                                                    value={searchContact}
                                                    onChange={e => setSearchContact(e.target.value)}
                                                />
                                            </div>

                                            {formManualContacts.length > 0 && (
                                                <div className="flex flex-wrap gap-1 p-2 bg-teal-50 rounded-xl border border-teal-200/50">
                                                    {formManualContacts.map(jid => (
                                                        <Badge key={jid} variant="secondary" className="text-[10px] bg-teal-100 text-teal-700 gap-1 pr-1">
                                                            {resolveName(jid) || formatPhoneNumber(jid)}
                                                            <button onClick={() => setFormManualContacts(prev => prev.filter(j => j !== jid))} className="hover:text-red-500">
                                                                <X className="h-2.5 w-2.5" />
                                                            </button>
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-50">
                                                {filteredManualContacts.map(c => {
                                                    const jid = c.id || c.remoteJid;
                                                    const selected = formManualContacts.includes(jid);
                                                    const name = resolveName(jid) || c.name || c.pushName || formatPhoneNumber(jid);
                                                    return (
                                                        <button
                                                            key={jid}
                                                            onClick={() => {
                                                                if (selected) setFormManualContacts(prev => prev.filter(j => j !== jid));
                                                                else setFormManualContacts(prev => [...prev, jid]);
                                                            }}
                                                            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-all ${selected ? 'bg-teal-50' : 'hover:bg-gray-50'}`}
                                                        >
                                                            <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${selected ? 'bg-teal-500 border-teal-500' : 'border-gray-300'}`}>
                                                                {selected && <Check className="h-3 w-3 text-white" />}
                                                            </div>
                                                            <Avatar className="h-7 w-7">
                                                                <AvatarFallback className="text-[8px] font-bold bg-gray-100 text-gray-600">{name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-medium text-gray-800 truncate">{name}</p>
                                                                <p className="text-[10px] text-gray-400">{formatPhoneNumber(jid)}</p>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-[10px] text-gray-400 text-center">{formManualContacts.length} contato(s) selecionado(s)</p>
                                        </div>
                                    )}
                                </div>

                                {/* Delay Settings */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <Timer className="h-3.5 w-3.5 text-gray-400" /> Intervalo entre mensagens
                                    </Label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-gray-500 font-medium">Mínimo (seg)</label>
                                            <Input
                                                type="number"
                                                value={formDelayMin}
                                                onChange={e => setFormDelayMin(Number(e.target.value))}
                                                className="h-9 rounded-xl text-xs"
                                                min={1}
                                                max={60}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-gray-500 font-medium">Máximo (seg)</label>
                                            <Input
                                                type="number"
                                                value={formDelayMax}
                                                onChange={e => setFormDelayMax(Number(e.target.value))}
                                                className="h-9 rounded-xl text-xs"
                                                min={1}
                                                max={120}
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-400">
                                        ⚠️ Intervalos curtos (&lt;3s) podem causar banimento. Recomendado: 5-15 segundos.
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                                    <Button
                                        variant="outline"
                                        onClick={() => { resetForm(); setView('list'); }}
                                        className="rounded-xl"
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={handleCreateCampaign}
                                        className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md hover:from-emerald-600 hover:to-teal-600"
                                    >
                                        <Megaphone className="h-4 w-4 mr-2" /> Criar Campanha
                                    </Button>
                                </div>
                            </div>
                        </ScrollArea>
                    )}

                    {view === 'detail' && selectedCampaign && (() => {
                        const campaign = campaigns.find(c => c.id === selectedCampaign.id) || selectedCampaign;
                        const audience = getAudienceContacts(campaign);
                        const progress = campaign.stats.total > 0 ? Math.round((campaign.stats.sent / campaign.stats.total) * 100) : 0;

                        return (
                            <ScrollArea className="h-full">
                                <div className="p-6 max-w-2xl mx-auto space-y-6">
                                    {/* Status & Stats Cards */}
                                    <div className="grid grid-cols-4 gap-3">
                                        {[
                                            { label: 'Destinatários', value: campaign.stats.total, icon: Users, color: 'from-blue-500 to-indigo-600' },
                                            { label: 'Enviadas', value: campaign.stats.sent, icon: Send, color: 'from-emerald-500 to-green-600' },
                                            { label: 'Entregues', value: campaign.stats.delivered, icon: CheckCircle2, color: 'from-teal-500 to-cyan-600' },
                                            { label: 'Falhas', value: campaign.stats.failed, icon: AlertCircle, color: 'from-red-500 to-rose-600' },
                                        ].map(stat => (
                                            <div key={stat.label} className="bg-white rounded-xl border border-gray-200/60 p-3.5 shadow-sm">
                                                <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center mb-2`}>
                                                    <stat.icon className="h-4 w-4 text-white" />
                                                </div>
                                                <p className="text-xl font-black text-gray-900">{stat.value}</p>
                                                <p className="text-[10px] text-gray-400 font-medium">{stat.label}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Progress Bar */}
                                    {(campaign.status === 'sending' || campaign.status === 'completed') && (
                                        <div className="bg-white rounded-xl border border-gray-200/60 p-4 shadow-sm">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold text-gray-700">Progresso do Envio</span>
                                                <span className={`text-sm font-black ${campaign.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'}`}>{progress}%</span>
                                            </div>
                                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${campaign.status === 'completed' ? 'bg-gradient-to-r from-emerald-400 to-green-500' : 'bg-gradient-to-r from-amber-400 to-orange-500 animate-pulse'}`}
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-1.5">{campaign.stats.sent} de {campaign.stats.total} mensagens enviadas</p>
                                        </div>
                                    )}

                                    {/* Message Preview */}
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Mensagem</Label>
                                        <div className="bg-gradient-to-br from-green-100 to-emerald-50 border border-green-200/50 rounded-2xl p-4 text-sm text-gray-800 whitespace-pre-wrap shadow-sm">
                                            {campaign.message}
                                        </div>
                                    </div>

                                    {/* Media Attached Preview */}
                                    {campaign.mediaUrl && (
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Mídia Anexada</Label>
                                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200/60 shadow-sm">
                                                <Paperclip className="h-4 w-4 text-gray-500" />
                                                <span className="text-sm font-medium text-gray-700">{campaign.mediaFileName || 'Arquivo de Mídia'}</span>
                                                <span className="text-[10px] text-gray-500 font-bold uppercase bg-gray-200/80 px-2 py-1 rounded-md">{campaign.mediaType}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Audience Info */}
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                            Audiência - {campaign.audience === 'all' ? 'Todos os contatos' : campaign.audience === 'tag' ? `Tag: #${campaign.audienceTag}` : 'Seleção manual'}
                                        </Label>
                                        <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-50">
                                            {audience.slice(0, 30).map(c => {
                                                const jid = c.id || c.remoteJid;
                                                const name = resolveName(jid) || c.name || c.pushName || formatPhoneNumber(jid);
                                                return (
                                                    <div key={jid} className="flex items-center gap-3 px-3 py-2">
                                                        <Avatar className="h-7 w-7">
                                                            <AvatarFallback className="text-[8px] font-bold bg-gray-100 text-gray-600">{name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium text-gray-800 truncate">{name}</p>
                                                        </div>
                                                        <span className="text-[10px] text-gray-400">{formatPhoneNumber(jid)}</span>
                                                    </div>
                                                );
                                            })}
                                            {audience.length > 30 && (
                                                <div className="px-3 py-2 text-xs text-gray-400 text-center">
                                                    + {audience.length - 30} outros contatos
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                                        {campaign.status === 'draft' && (
                                            <Button
                                                onClick={() => handleSendCampaign(campaign)}
                                                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md hover:from-emerald-600 hover:to-teal-600"
                                                disabled={sendingCampaignId === campaign.id}
                                            >
                                                {sendingCampaignId === campaign.id ? (
                                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
                                                ) : (
                                                    <><Play className="h-4 w-4 mr-2" /> Iniciar Envio</>
                                                )}
                                            </Button>
                                        )}
                                        {campaign.status === 'sending' && (
                                            <Button
                                                onClick={() => {
                                                    activeCampaignsRef.current[campaign.id] = 'paused';
                                                    setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: 'paused' } : c));
                                                }}
                                                className="flex-1 rounded-xl bg-gradient-to-r from-orange-400 to-orange-500 text-white shadow-md hover:from-orange-500 hover:to-orange-600"
                                            >
                                                <Pause className="h-4 w-4 mr-2" /> Pausar
                                            </Button>
                                        )}
                                        {campaign.status === 'paused' && (
                                            <Button
                                                onClick={() => {
                                                    activeCampaignsRef.current[campaign.id] = 'sending';
                                                    setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: 'sending' } : c));
                                                }}
                                                className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md hover:from-blue-600 hover:to-indigo-600"
                                            >
                                                <Play className="h-4 w-4 mr-2" /> Retomar
                                            </Button>
                                        )}
                                        <Button variant="outline" onClick={() => handleDuplicate(campaign)} className="rounded-xl">
                                            <Copy className="h-4 w-4 mr-2" /> Duplicar
                                        </Button>
                                        <Button variant="outline" className="rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteCampaign(campaign.id)}>
                                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                        </Button>
                                    </div>
                                </div>
                            </ScrollArea>
                        );
                    })()}
                </div>
            </div>
        </CRMLayout>
    );
}
