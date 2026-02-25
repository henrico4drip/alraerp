import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import CRMLayout from "@/components/CRMLayout";
import { useEvolution } from "@/contexts/EvolutionContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Search, MessageSquare, Send, Loader2, RefreshCw, FileText, Download,
  StickyNote, Ghost, Unlock, X, User, Briefcase, Tag, Phone, ChevronRight,
  Plus, MoreVertical, ArrowLeft, EyeOff, Eye, Check, Hash, Star, Clock,
  UserPlus, Filter as FilterIcon, Bell
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatPhoneNumber, isSameJid, extractMessageContent } from "@/lib/evolution";
import { memo } from "react";
import { useCrm } from "@/contexts/CrmContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useLocation, useSearchParams } from "react-router-dom";
import { useProfile } from "@/context/ProfileContext";

// --- Media Message Component ---
const MediaMessage = memo(({ message, type, mimeType, fileName, api }: { message: any, type: string, mimeType?: string, fileName?: string, api: any }) => {
  const [base64, setBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchMedia = async () => {
      if (!message || !api) return;
      setLoading(true);
      try {
        const data = await api.getBase64Media(message);
        if (isMounted && data?.base64) setBase64(data.base64);
        else if (isMounted) setError(true);
      } catch (e) {
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchMedia();
    return () => { isMounted = false; };
  }, [message.key?.id, api]);

  if (loading) return <div className="flex items-center justify-center gap-2 text-xs text-gray-500 p-3 bg-gray-50/80 rounded-xl min-h-[120px] w-[250px] border border-gray-200/50 animate-pulse"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>;
  if (error || !base64) return <div className="text-xs text-red-400 p-3 bg-red-50/50 rounded-xl border border-red-200/50 w-[250px]">Erro ao carregar mídia</div>;

  const src = `data:${mimeType || 'application/octet-stream'};base64,${base64}`;

  if (type === 'image') return <div className="min-h-[120px] bg-gray-50 rounded-xl overflow-hidden"><img src={src} className="max-w-[250px] max-h-[350px] w-auto h-auto object-cover" alt="Imagem" /></div>;
  if (type === 'video') return <div className="min-h-[120px] bg-gray-50 rounded-xl overflow-hidden"><video src={src} controls className="max-w-[250px] max-h-[350px] w-auto h-auto" /></div>;
  if (type === 'audio') return (
    <div className="w-[260px] flex items-center justify-center p-2 rounded-xl bg-gray-100/50">
      <audio src={src} controls className="w-full h-8" />
    </div>
  );
  if (type === 'sticker') return <img src={src} className="h-24 w-24 object-contain" alt="Sticker" />;
  if (type === 'document') {
    return (
      <a href={src} download={fileName || 'document'} className="flex items-center gap-3 p-3 bg-white/80 backdrop-blur border border-gray-200/50 rounded-xl hover:bg-gray-50 transition-all w-full max-w-[280px] text-left group">
        <div className="bg-blue-50 p-2 rounded-lg text-blue-600 group-hover:bg-blue-100 transition-colors">
          <FileText className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-gray-700">{fileName || 'Documento'}</p>
          <p className="text-[10px] text-gray-400 uppercase">{mimeType?.split('/')[1] || 'FILE'}</p>
        </div>
        <Download className="h-4 w-4 text-gray-400 opacity-50 group-hover:opacity-100" />
      </a>
    );
  }
  return null;
});

// --- Message Bubble ---
const MessageBubble = memo(({ item, isMe, type, content, mimeType, fileName, api }: { item: any, isMe: boolean, type: string, content: string, mimeType?: string, fileName?: string, api: any }) => {
  if (item.type === 'message') {
    return (
      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
        <div className={`max-w-[75%] px-4 py-2.5 shadow-sm ${isMe
          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-tr-md'
          : 'bg-white text-gray-800 rounded-2xl rounded-tl-md border border-gray-100'
          }`}>
          {!isMe && item.data.pushName && <p className="text-[10px] font-semibold mb-1 text-blue-500">{item.data.pushName}</p>}
          {type === 'text' ? (
            <p className="text-[13px] whitespace-pre-wrap break-words leading-relaxed">{content}</p>
          ) : (
            <MediaMessage message={item.data} type={type} mimeType={mimeType} fileName={fileName} api={api} />
          )}
          <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
            <p className={`text-[9px] font-medium ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>{format(new Date(item.timestamp * 1000), "HH:mm")}</p>
            {isMe && <Check className={`h-3 w-3 ${isMe ? 'text-blue-200' : 'text-gray-400'}`} />}
          </div>
        </div>
      </div>
    );
  } else {
    const w = item.data;
    return (
      <div className="flex justify-center my-3">
        <div className="bg-amber-50/80 backdrop-blur border border-amber-200/50 text-amber-800 px-4 py-2.5 rounded-xl max-w-lg w-full flex gap-3 shadow-sm">
          <Ghost className="h-4 w-4 shrink-0 mt-0.5 opacity-50" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold uppercase tracking-wider">Sussurro de {w.senderName}</span>
              <span className="text-[9px] opacity-60">{format(new Date(w.timestamp * 1000), "HH:mm")}</span>
            </div>
            <p className="text-xs italic font-medium">"{w.text}"</p>
          </div>
        </div>
      </div>
    );
  }
});

// --- Chat List Item ---
const ChatListItem = memo(({ chat, isSelected, name, phone, unread, assigneeName, onSelect }: {
  chat: any, isSelected: boolean, name: string, phone: string, unread: number, assigneeName?: string, onSelect: (chat: any) => void
}) => (
  <button
    onClick={() => onSelect(chat)}
    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all relative group ${isSelected
      ? "bg-gradient-to-r from-indigo-50 to-blue-50/50 border-l-[3px] border-l-indigo-500"
      : "bg-white hover:bg-gray-50/80 border-l-[3px] border-l-transparent"
      }`}
  >
    <div className="relative">
      <Avatar className="h-11 w-11 shrink-0 ring-2 ring-white shadow-sm">
        <AvatarFallback className={`text-xs font-bold ${isSelected ? 'bg-gradient-to-br from-indigo-100 to-blue-100 text-indigo-700' : unread > 0 ? 'bg-gradient-to-br from-green-50 to-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
          {name.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] px-1 rounded-full bg-gradient-to-r from-emerald-400 to-green-500 flex items-center justify-center text-[10px] font-bold text-white shadow-sm animate-in zoom-in duration-200">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-center mb-0.5">
        <p className={`text-[13px] truncate ${isSelected ? 'font-bold text-indigo-900' : unread > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>
          {name}
        </p>
        {chat.messageTimestamp && (
          <span className={`text-[10px] font-medium shrink-0 ml-2 ${unread > 0 ? 'text-emerald-600 font-bold' : 'text-gray-400'}`}>
            {format(new Date(Number(chat.messageTimestamp) * 1000), "HH:mm")}
          </span>
        )}
      </div>
      <p className={`text-[11px] truncate ${unread > 0 ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
        {chat.lastMessage || "Nova conversa"}
      </p>
      {assigneeName && (
        <div className="flex items-center gap-1 mt-0.5">
          <User className="h-2.5 w-2.5 text-indigo-400" />
          <span className="text-[9px] text-indigo-500 font-medium">{assigneeName}</span>
        </div>
      )}
    </div>
  </button>
));

// --- Chat Input ---
const ChatInputView = memo(({ value, onChange, onSend, isWhisperMode, toggleWhisper, isSending }: {
  value: string, onChange: (v: string) => void, onSend: () => void, isWhisperMode: boolean, toggleWhisper: () => void, isSending: boolean
}) => (
  <div className="p-3 bg-white/80 backdrop-blur-xl border-t border-gray-100">
    <div className="max-w-4xl mx-auto flex items-end gap-2">
      <div className="flex-1 relative">
        {isWhisperMode && (
          <div className="absolute -top-7 left-0 text-[9px] font-bold text-amber-600 flex items-center gap-1 animate-pulse bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
            <Ghost className="h-3 w-3" /> SUSSURRO (Privado)
          </div>
        )}
        <Textarea
          placeholder={isWhisperMode ? "Escrever nota interna..." : "Digite sua mensagem..."}
          className={`min-h-[44px] max-h-28 resize-none py-2.5 px-4 text-sm rounded-2xl border-0 shadow-inner transition-all ${isWhisperMode
            ? 'bg-amber-50 focus:ring-amber-500/20'
            : 'bg-gray-100 focus:ring-blue-500/10 focus:bg-white'
            }`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={isSending}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
      </div>
      <div className="flex gap-1.5 pb-0.5">
        <Button
          variant={isWhisperMode ? "default" : "ghost"}
          size="icon"
          className={`h-10 w-10 rounded-2xl transition-all ${isWhisperMode
            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md'
            : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'
            }`}
          onClick={toggleWhisper}
          disabled={isSending}
          title="Modo Sussurro (Interno)"
        >
          <Ghost className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          className="h-10 w-10 rounded-2xl shadow-lg bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          onClick={onSend}
          disabled={isSending || !value.trim()}
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  </div>
));

// --- Contact Details Side Panel ---
const ContactPanel = memo(({
  chat, resolveName, phone, deal, assignee, agents, onAssign, onStageChange,
  stages, notes, tags, onSaveNote, onSaveTags, onHide, isHidden, onUnhide,
  editName, setEditName, onSaveName
}: any) => {
  const [noteInput, setNoteInput] = useState(notes || "");
  const [tagInput, setTagInput] = useState("");
  const [activeSection, setActiveSection] = useState<'info' | 'notes' | 'deal'>('info');
  const name = resolveName(chat.id || chat.remoteJid);

  useEffect(() => { setNoteInput(notes || ""); }, [notes]);

  return (
    <div className="w-80 border-l border-gray-100 bg-white flex flex-col h-full overflow-hidden">
      {/* Contact Header */}
      <div className="p-5 border-b border-gray-100 text-center">
        <Avatar className="h-16 w-16 mx-auto mb-3 ring-4 ring-gray-50 shadow-md">
          <AvatarImage src={chat.profilePicUrl} />
          <AvatarFallback className="bg-gradient-to-br from-blue-400 to-blue-600 text-white text-lg font-bold shadow-inner">
            {name.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h3 className="font-bold text-gray-900 text-sm">{name}</h3>
        <p className="text-xs text-gray-500 flex items-center justify-center gap-1 mt-1">
          <Phone className="h-3 w-3" /> {phone}
        </p>
        {assignee && (
          <div className="mt-2 inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-[10px] font-semibold px-2.5 py-1 rounded-full">
            <User className="h-3 w-3" /> {assignee.name}
          </div>
        )}
      </div>

      {/* Section Tabs */}
      <div className="flex border-b border-gray-100">
        {[
          { key: 'info', label: 'Dados', icon: User },
          { key: 'notes', label: 'Notas', icon: StickyNote },
          { key: 'deal', label: 'Negócio', icon: Briefcase },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key as any)}
            className={`flex-1 py-2.5 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all border-b-2 ${activeSection === tab.key
              ? 'text-blue-600 border-blue-500 bg-blue-50/50'
              : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
              }`}
          >
            <tab.icon className="h-3.5 w-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeSection === 'info' && (
          <>
            {/* Custom Name */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Nome</Label>
              <div className="flex gap-1.5">
                <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-8 text-xs" />
                <Button size="sm" className="h-8 px-2 text-xs" onClick={onSaveName}>
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Assign Agent */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Responsável</Label>
              <Select value={assignee?.id || ""} onValueChange={(v) => onAssign(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Sem responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {agents.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tags</Label>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {(tags || []).map((tag: string, idx: number) => (
                  <Badge key={idx} variant="secondary" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 gap-1 pr-1">
                    #{tag}
                    <button onClick={() => {
                      const newTags = tags.filter((_: any, i: number) => i !== idx);
                      onSaveTags(newTags);
                    }} className="hover:text-red-500 transition-colors">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-1">
                <Input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  placeholder="Nova tag..."
                  className="h-7 text-[11px]"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      onSaveTags([...(tags || []), tagInput.trim()]);
                      setTagInput("");
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => {
                    if (tagInput.trim()) {
                      onSaveTags([...(tags || []), tagInput.trim()]);
                      setTagInput("");
                    }
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-1.5 pt-2 border-t border-gray-100">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs h-8 text-gray-600"
                onClick={isHidden ? onUnhide : onHide}
              >
                {isHidden ? <Eye className="h-3.5 w-3.5 mr-2" /> : <EyeOff className="h-3.5 w-3.5 mr-2" />}
                {isHidden ? "Mostrar conversa" : "Ocultar conversa"}
              </Button>
            </div>
          </>
        )}

        {activeSection === 'notes' && (
          <div className="space-y-3">
            <Textarea
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              className="min-h-[200px] text-xs bg-gray-50 border-0 rounded-xl"
              placeholder="Anotações sobre este contato..."
            />
            <Button size="sm" className="w-full text-xs" onClick={() => { onSaveNote(noteInput); toast.success("Notas salvas!"); }}>
              Salvar Notas
            </Button>
          </div>
        )}

        {activeSection === 'deal' && (
          <div className="space-y-4">
            {deal ? (
              <>
                {/* Deal Card */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/60 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-emerald-800">{deal.title}</h4>
                    {deal.priority && deal.priority !== 'medium' && (
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${deal.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                        deal.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                        {deal.priority === 'urgent' ? '⚡ Urgente' : deal.priority === 'high' ? '🟠 Alta' : '🟢 Baixa'}
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-black text-emerald-600">{deal.value}</p>
                  {deal.company && deal.company !== 'WhatsApp' && (
                    <p className="text-[10px] text-emerald-600/70 mt-1">{deal.company}</p>
                  )}
                </div>

                {/* Pipeline Visual - Kanban Stages */}
                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Pipeline</Label>
                  <div className="space-y-1">
                    {stages.map((s: any, idx: number) => {
                      const isCurrentStage = deal.stageId === s.id;
                      const currentStageIdx = stages.findIndex((st: any) => st.id === deal.stageId);
                      const isPast = idx < currentStageIdx;
                      const isFuture = idx > currentStageIdx;

                      return (
                        <button
                          key={s.id}
                          onClick={() => onStageChange(deal.id, s.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${isCurrentStage
                            ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-200'
                            : isPast
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : 'bg-gray-50 text-gray-400 border border-gray-100 hover:bg-gray-100 hover:text-gray-600'
                            }`}
                        >
                          <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${isCurrentStage ? 'bg-white/20 text-white' :
                            isPast ? 'bg-emerald-200 text-emerald-700' :
                              'bg-gray-200 text-gray-400'
                            }`}>
                            {isPast ? '✓' : idx + 1}
                          </div>
                          <span className="truncate">{s.title}</span>
                          <div className={`h-2 w-2 rounded-full ml-auto shrink-0 ${s.color}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Stage Selector (alternative) */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Mover para</Label>
                  <Select value={deal.stageId} onValueChange={v => onStageChange(deal.id, v)}>
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${s.color}`} />
                            {s.title}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="h-14 w-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                  <Briefcase className="h-7 w-7 text-amber-500" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-1">Nenhum negócio vinculado</p>
                <p className="text-[11px] text-gray-400 mb-4">Crie um negócio para acompanhar este contato no funil de vendas</p>
                <Button
                  size="sm"
                  className="text-xs bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-md rounded-xl px-4"
                  onClick={() => {
                    const chatId = chat.id || chat.remoteJid;
                    const contactName = resolveName(chatId);
                    // This will be handled by the parent - uses addDeal from CrmContext
                    if ((window as any).__crmAddDeal) {
                      (window as any).__crmAddDeal({
                        id: chatId,
                        chatId: chatId,
                        title: contactName || "Novo Negócio",
                        company: "WhatsApp",
                        value: "R$ 0,00",
                        stageId: stages[0]?.id || 'leads',
                        tags: [],
                        createdAt: Date.now()
                      });
                      toast.success("Negócio criado no funil!");
                    }
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Criar Negócio
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// --- Main Inbox Component ---
export default function Inbox() {
  const {
    api,
    isConnected,
    contacts,
    discoveredNames,
    setDiscoveredNames,
    customNames,
    setCustomName,
    messageCache,
    updateMessageCache,
    resolveName,
  } = useEvolution();
  const location = useLocation();
  const { currentProfile } = useProfile();

  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showContactPanel, setShowContactPanel] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const sendingLock = useRef(false);
  const [isWhisperMode, setIsWhisperMode] = useState(false);
  const [editName, setEditName] = useState("");
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const lidMap = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('lid_mappings') || '{}');
    } catch (e) { return {}; }
  }, [chats]);

  const [chatFilter, setChatFilter] = useState<'all' | 'mine' | 'unread' | 'hidden'>('all');
  const [showHiddenInput, setShowHiddenInput] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [isHiddenUnlocked, setIsHiddenUnlocked] = useState(false);


  // CRM Context
  const {
    agents,
    currentAgent,
    assignments,
    assignChat,
    getChatAssignee,
    getDealByChatId,
    addDeal,
    stages,
    contactNotes,
    saveContactNote,
    contactTags,
    saveContactTags,
    hiddenContacts,
    hideContact,
    unhideContact,
    hiddenChatPassword,
    updateDealStage,
    unreadCounts,
    markAsRead,
    updateUnreadFromChats,
    totalUnread,
  } = useCrm();

  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("");
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    Object.values(contactTags).forEach(tags => {
      tags.forEach(t => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }, [contactTags]);


  // Expose addDeal for ContactPanel
  useEffect(() => {
    (window as any).__crmAddDeal = addDeal;
    return () => { delete (window as any).__crmAddDeal; };
  }, [addDeal]);

  // Resolution Dialog
  const [resolutionDialogOpen, setResolutionDialogOpen] = useState(false);
  const [failedLid, setFailedLid] = useState<string | null>(null);
  const [failedText, setFailedText] = useState<string | null>(null);
  const [manualPhoneInput, setManualPhoneInput] = useState("");

  // Scroll Helpers
  const handleScroll = (e: any) => {
    const viewport = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = viewport;
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const contactIdParam = searchParams.get('contactId');

  // Handle contactId from URL
  useEffect(() => {
    if (contactIdParam && chats.length > 0) {
      const existingChat = chats.find(c => isSameJid(c.id || c.remoteJid, contactIdParam));
      if (existingChat) {
        handleSelectChat(existingChat);
      } else {
        // Look in contacts if not in recent chats
        const contact = contacts.find(c => isSameJid(c.id, contactIdParam));
        if (contact) {
          handleSelectChat({
            id: contact.id,
            name: contact.name,
            pushName: contact.pushName,
            status: 'chat'
          });
        }
      }
      // Clear param after handling to avoid re-triggering
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('contactId');
      setSearchParams(newParams, { replace: true });
    }
  }, [contactIdParam, chats, contacts]);

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTo({
        top: scrollViewportRef.current.scrollHeight,
        behavior
      });
    }
  };

  // Sync scroll on bottom
  useEffect(() => {
    if (!scrollViewportRef.current) return;
    const resizeObserver = new ResizeObserver(() => {
      if (isAtBottomRef.current) scrollToBottom("auto");
    });
    const currentViewport = scrollViewportRef.current;
    const innerContainer = currentViewport.firstElementChild;
    if (innerContainer) resizeObserver.observe(innerContainer);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (selectedChat) {
      const jid = selectedChat.id || selectedChat.remoteJid;
      const resolved = resolveName(jid);
      setEditName(resolved);
      // Mark as read when opening a conversation
      markAsRead(jid);
      isAtBottomRef.current = true;
      if (messages.length > 0) setTimeout(() => scrollToBottom("auto"), 50);
    }
  }, [selectedChat]);

  useEffect(() => {
    if (!loadingMessages && messages.length > 0) {
      if (isAtBottomRef.current) setTimeout(() => scrollToBottom("auto"), 50);
    }
  }, [messages.length]);

  // Load Chats
  const loadChats = async (silent: boolean = false) => {
    if (!api || !isConnected) return;
    if (!silent) setLoading(true);
    try {
      const response = await api.fetchChats();
      setChats(prev => {
        if (JSON.stringify(prev) === JSON.stringify(response)) return prev;
        return response;
      });
      // Update unread counts from chat data
      if (response && response.length > 0) {
        updateUnreadFromChats(response);
      }
    } catch (error: any) {
      console.error('[Inbox] Error loading chats:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Load Messages
  const loadMessages = async (chat: any, silent: boolean = false) => {
    if (!api || !isConnected) return;
    const jid = chat.id || chat.remoteJid || chat.key?.remoteJid;
    if (!jid) return;

    if (!silent && messageCache[jid]) setMessages(messageCache[jid]);

    try {
      const response = await api.fetchMessages(jid, 200);
      const newMessages = response.map((m: any) => ({
        type: 'message',
        data: m,
        timestamp: m.messageTimestamp
      }));
      setMessages(prev => {
        if (JSON.stringify(prev) === JSON.stringify(newMessages)) return prev;
        updateMessageCache(jid, newMessages);
        return newMessages;
      });
    } catch (error: any) {
      console.error(error);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  // Send Message
  const handleSendMessage = async () => {
    if (!api || !isConnected || !selectedChat || !messageInput.trim() || isSending || sendingLock.current) return;
    const jid = selectedChat.id || selectedChat.remoteJid || selectedChat.key?.remoteJid;

    sendingLock.current = true;
    setIsSending(true);
    try {
      if (isWhisperMode) {
        const whisperMsg = {
          key: { remoteJid: jid, id: 'whisper-' + Date.now(), fromMe: true },
          messageTimestamp: Math.floor(Date.now() / 1000),
          pushName: currentProfile?.name || "Você",
          type: 'whisper',
          data: {
            text: messageInput,
            senderName: currentProfile?.name || "Você",
            timestamp: Math.floor(Date.now() / 1000)
          }
        };
        const newMsgs = [...messages, whisperMsg];
        setMessages(newMsgs);
        updateMessageCache(jid, newMsgs);
      } else {
        await api.sendTextMessage(jid, messageInput);
        setTimeout(() => loadMessages(selectedChat, true), 1000);
      }
      setMessageInput("");
    } catch (error: any) {
      if (error?.message?.includes('400') && jid.includes('@lid')) {
        setFailedLid(jid);
        setFailedText(messageInput);
        setResolutionDialogOpen(true);
      } else {
        toast.error("Erro ao enviar: " + error.message);
      }
    } finally {
      sendingLock.current = false;
      setIsSending(false);
    }
  };

  const handleManualResolution = () => {
    if (!failedLid || !manualPhoneInput.trim()) return;
    let phone = manualPhoneInput.replace(/\D/g, '');
    if (!phone.includes('@s.whatsapp.net')) phone += '@s.whatsapp.net';

    const savedMap = JSON.parse(localStorage.getItem('lid_mappings') || '{}');
    savedMap[failedLid] = phone;
    localStorage.setItem('lid_mappings', JSON.stringify(savedMap));
    setDiscoveredNames(prev => ({ ...prev, [failedLid]: phone }));
    toast.success("Vínculo salvo! Reenviando mensagem...");
    setResolutionDialogOpen(false);

    if (failedText && api) {
      api.sendTextMessage(phone, failedText)
        .then(() => {
          loadMessages(selectedChat, true);
          setFailedLid(null);
          setFailedText(null);
          setManualPhoneInput("");
        })
        .catch(() => toast.error("Falha ao reenviar."));
    }
  };

  const handleSelectChat = useCallback((chat: any) => {
    setSelectedChat(chat);
    setSearchQuery(""); // Clear search to show recent chats again
    const jid = chat.id || chat.remoteJid;
    markAsRead(jid);
    // Also tell the server to mark as read so polling doesn't bring it back
    if (api && jid) {
      api.markRead(jid).catch(() => { });
    }
    loadMessages(chat);
  }, [api, isConnected]);

  // Auto-load chats
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isConnected) {
      loadChats();
      interval = setInterval(() => loadChats(true), 15000);
    }
    return () => clearInterval(interval);
  }, [isConnected, api]);

  // Auto-select chat from query param
  useEffect(() => {
    if (contactIdParam && chats.length > 0 && !selectedChat) {
      const chat = chats.find(c => isSameJid(c.id || c.remoteJid, contactIdParam));
      if (chat) {
        setSelectedChat(chat);
        setChatFilter('all'); // Reset filter to find the chat
      }
    }
  }, [contactIdParam, chats, selectedChat]);

  // Auto-refresh messages
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (selectedChat) {
      loadMessages(selectedChat, false);
      interval = setInterval(() => loadMessages(selectedChat, true), 5000);
    }
    return () => clearInterval(interval);
  }, [selectedChat]);

  // Filtered Chats
  const filteredChats = useMemo(() => {
    let filtered = chats;

    if (chatFilter === 'hidden') {
      filtered = filtered.filter(c => hiddenContacts.includes(c.id || c.remoteJid));
      if (!isHiddenUnlocked) return [];
    } else {
      filtered = filtered.filter(c => !hiddenContacts.includes(c.id || c.remoteJid));
      if (chatFilter === 'mine' && currentAgent) {
        filtered = filtered.filter(c => assignments[c.id || c.remoteJid] === currentAgent.id);
      }
      if (chatFilter === 'unread') {
        filtered = filtered.filter(c => {
          const jid = c.id || c.remoteJid;
          return (unreadCounts[jid] || 0) > 0;
        });
      }
      if (selectedTagFilter) {
        filtered = filtered.filter(c => {
          const jid = c.id || c.remoteJid;
          return contactTags[jid]?.includes(selectedTagFilter);
        });
      }
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      // Filter existing chats
      let results = filtered.filter(c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.pushName && c.pushName.toLowerCase().includes(q)) ||
        ((c.id || c.remoteJid) && (c.id || c.remoteJid).includes(q))
      );

      // Add contacts that aren't in chats yet
      const contactMatches = contacts.filter(c => {
        const jid = c.id || c.remoteJid;
        const name = c.name || c.pushName || c.pushname || c.profileName;
        const alreadyInChats = results.some(rc => isSameJid(rc.id || rc.remoteJid, jid));
        return !alreadyInChats && (
          (name && name.toLowerCase().includes(q)) ||
          (jid && jid.includes(q))
        );
      }).map(c => ({
        id: c.id || c.remoteJid,
        name: c.name || c.pushName || c.pushname || c.profileName,
        status: 'contact'
      }));

      filtered = [...results, ...contactMatches];
    }

    return filtered.map(chat => {
      const jid = chat.id || chat.remoteJid;
      const name = resolveName(jid, chat.name || chat.pushName);
      const phone = isSameJid(jid, jid, lidMap) ? formatPhoneNumber(jid) : "LID (Oculto)";
      const unread = unreadCounts[jid] || 0;
      const assigneeAgent = getChatAssignee(jid);

      return { ...chat, computedName: name, computedPhone: phone, computedUnread: unread, assigneeAgent };
    });
  }, [chats, searchQuery, chatFilter, isHiddenUnlocked, customNames, discoveredNames, contacts, lidMap, hiddenContacts, assignments, unreadCounts, currentAgent]);

  const handleInputChange = useCallback((v: string) => setMessageInput(v), []);
  const handleMainAction = useCallback(() => handleSendMessage(), [handleSendMessage]);

  const selectedJid = useMemo(() => {
    if (!selectedChat) return null;
    // Primary: id or remoteJid
    const primary = selectedChat.id || selectedChat.remoteJid;
    if (primary) return primary;
    // Fallback: try to construct from phone or normalized_phone
    const phone = selectedChat.phone || selectedChat.normalized_phone || selectedChat.key?.remoteJid;
    if (phone) {
      const cleaned = String(phone).replace(/\D/g, '');
      return cleaned.includes('@') ? cleaned : `${cleaned}@s.whatsapp.net`;
    }
    // Last resort: use name if it looks like a phone number
    if (selectedChat.name && /^\d+$/.test(selectedChat.name.replace(/\D/g, ''))) {
      return `${selectedChat.name.replace(/\D/g, '')}@s.whatsapp.net`;
    }
    return null;
  }, [selectedChat]);

  return (
    <CRMLayout>
      <div className="flex h-[calc(100vh-theme(spacing.4))] bg-[#f8fafc] rounded-2xl shadow-sm border border-gray-200/60 overflow-hidden m-2">
        {/* Sidebar List */}
        <div className="w-[340px] flex flex-col bg-white z-10 relative shadow-[6px_0_20px_-6px_rgba(0,0,0,0.08)] rounded-r-2xl overflow-hidden">
          {/* Header */}
          <div className="border-b border-gray-100 flex flex-col">
            {/* Top Bar with Gradient */}
            <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 p-4 text-white rounded-tr-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h2 className="font-bold text-lg tracking-tight">Inbox</h2>
                  {totalUnread > 0 && (
                    <span className="px-2.5 py-0.5 bg-white/20 backdrop-blur text-white text-[11px] font-bold rounded-full animate-in zoom-in border border-white/30">
                      {totalUnread} novas
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-white/80 hover:text-white hover:bg-white/10" onClick={() => toast.info("Em breve: Nova conversa")}>
                    <UserPlus className="h-4 w-4" />
                  </Button>
                  <button onClick={() => loadChats()} className="p-2 hover:bg-white/10 rounded-xl text-white/70 hover:text-white transition-colors" title="Atualizar">
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 space-y-2.5">
              {/* Filter Tabs */}
              <div className="flex gap-1 p-1 bg-gray-100/80 rounded-xl">
                {[
                  { key: 'all', label: 'Todos', icon: MessageSquare },
                  { key: 'unread', label: 'Não Lidos', count: totalUnread, icon: Bell },
                  { key: 'mine', label: 'Meus', icon: User },
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setChatFilter(tab.key as any)}
                      className={`flex-1 py-2 text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${chatFilter === tab.key
                        ? 'bg-white text-indigo-700 shadow-md shadow-indigo-100/50'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      <Icon className="h-3 w-3" />
                      {tab.label}
                      {tab.count && tab.count > 0 ? (
                        <span className="bg-gradient-to-r from-emerald-400 to-green-500 text-white text-[8px] font-bold px-1.5 py-px rounded-full shadow-sm">{tab.count}</span>
                      ) : null}
                    </button>
                  );
                })}
                {isHiddenUnlocked && (
                  <button
                    onClick={() => setChatFilter('hidden')}
                    className={`flex-1 py-2 text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${chatFilter === 'hidden'
                      ? 'bg-white text-indigo-700 shadow-md'
                      : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    <EyeOff className="h-3 w-3" />
                    Ocultos
                  </button>
                )}
              </div>

              {chatFilter === 'hidden' && !isHiddenUnlocked && (
                <div className="flex gap-1.5">
                  <Input type="password" placeholder="Senha..." className="h-8 text-xs rounded-lg" value={unlockPassword} onChange={e => setUnlockPassword(e.target.value)} />
                  <Button size="sm" className="h-8 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-700" onClick={() => {
                    if (unlockPassword === hiddenChatPassword) { setIsHiddenUnlocked(true); toast.success("Desbloqueado"); } else toast.error("Senha errada");
                  }}>
                    <Unlock className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {/* Search */}
              <div className="relative">
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 z-10">
                  <Search className="h-3.5 w-3.5 text-gray-400" />
                </div>
                <Input
                  placeholder="Buscar conversa..."
                  className="pr-11 h-9 bg-gray-50 border-0 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Tags Filter Bar - Colorful */}
              {allTags.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
                  <button
                    onClick={() => setSelectedTagFilter("")}
                    className={`text-[10px] px-2.5 py-1 rounded-full font-semibold flex-shrink-0 transition-all border ${!selectedTagFilter
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                  >
                    Todas
                  </button>
                  {allTags.map((tag, idx) => {
                    const colors = [
                      { bg: 'bg-violet-500', border: 'border-violet-500', hover: 'hover:border-violet-400 hover:text-violet-600', shadow: 'shadow-violet-200' },
                      { bg: 'bg-rose-500', border: 'border-rose-500', hover: 'hover:border-rose-400 hover:text-rose-600', shadow: 'shadow-rose-200' },
                      { bg: 'bg-amber-500', border: 'border-amber-500', hover: 'hover:border-amber-400 hover:text-amber-600', shadow: 'shadow-amber-200' },
                      { bg: 'bg-emerald-500', border: 'border-emerald-500', hover: 'hover:border-emerald-400 hover:text-emerald-600', shadow: 'shadow-emerald-200' },
                      { bg: 'bg-cyan-500', border: 'border-cyan-500', hover: 'hover:border-cyan-400 hover:text-cyan-600', shadow: 'shadow-cyan-200' },
                      { bg: 'bg-pink-500', border: 'border-pink-500', hover: 'hover:border-pink-400 hover:text-pink-600', shadow: 'shadow-pink-200' },
                      { bg: 'bg-orange-500', border: 'border-orange-500', hover: 'hover:border-orange-400 hover:text-orange-600', shadow: 'shadow-orange-200' },
                      { bg: 'bg-teal-500', border: 'border-teal-500', hover: 'hover:border-teal-400 hover:text-teal-600', shadow: 'shadow-teal-200' },
                    ];
                    const c = colors[idx % colors.length];
                    const active = selectedTagFilter === tag;
                    return (
                      <button
                        key={tag}
                        onClick={() => setSelectedTagFilter(tag)}
                        className={`text-[10px] px-2.5 py-1 rounded-full font-semibold flex-shrink-0 transition-all whitespace-nowrap border ${active
                          ? `${c.bg} text-white ${c.border} shadow-md ${c.shadow}`
                          : `bg-white text-gray-500 border-gray-200 ${c.hover}`}`}
                      >
                        #{tag}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Chat List */}
          <ScrollArea className="flex-1">
            <div className="flex flex-col divide-y divide-gray-50">
              {filteredChats.map((chat) => (
                <ChatListItem
                  key={chat.id || chat.remoteJid}
                  chat={chat}
                  isSelected={selectedChat && isSameJid(chat.id || chat.remoteJid, selectedChat.id || selectedChat.remoteJid, lidMap)}
                  name={chat.computedName}
                  phone={chat.computedPhone}
                  unread={chat.computedUnread}
                  assigneeName={chat.assigneeAgent?.name}
                  onSelect={handleSelectChat}
                />
              ))}
              {filteredChats.length === 0 && !loading && (
                <div className="p-8 text-center text-gray-400 text-xs font-medium">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Nenhuma conversa encontrada.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-transparent relative">
          {selectedChat && selectedJid ? (
            <>
              {/* Chat Header */}
              <div className="h-14 px-4 border-b border-gray-100 bg-white/80 backdrop-blur-md flex items-center justify-between shadow-[0_4px_12px_-6px_rgba(0,0,0,0.05)] relative z-20">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9 ring-2 ring-white shadow-sm">
                    <AvatarImage src={selectedChat.profilePicUrl} />
                    <AvatarFallback className="bg-blue-50 text-blue-600 font-bold text-xs">
                      {resolveName(selectedJid).substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="font-bold text-gray-900 text-sm leading-tight">
                      {resolveName(selectedJid)}
                    </h2>
                    <p className="text-[11px] text-gray-500">
                      {formatPhoneNumber(selectedJid)}
                      {getChatAssignee(selectedJid) && (
                        <span className="ml-2 text-blue-500">• {getChatAssignee(selectedJid)?.name}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-gray-600 rounded-lg"
                    onClick={() => setShowContactPanel(!showContactPanel)}
                    title={showContactPanel ? "Fechar painel" : "Abrir painel"}
                  >
                    <User className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedChat(null)} className="h-8 w-8 text-gray-400 hover:text-gray-600 rounded-lg">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Messages */}
                <div className="flex-1 flex flex-col">
                  <div ref={scrollViewportRef} className="flex-1 overflow-y-auto p-4 space-y-1 bg-gradient-to-b from-gray-50/50 to-white/30" onScroll={handleScroll}>
                    {messages.map((item, idx) => {
                      const msg = item.data;
                      const isMe = msg.key?.fromMe;
                      const { type, content } = extractMessageContent(msg);
                      const mimeType = (msg.message?.imageMessage?.mimetype || msg.message?.videoMessage?.mimetype || msg.message?.audioMessage?.mimetype || msg.message?.documentMessage?.mimetype);
                      const fileName = msg.message?.documentMessage?.fileName;

                      return (
                        <MessageBubble
                          key={idx}
                          item={item}
                          isMe={isMe}
                          type={type}
                          content={content}
                          mimeType={mimeType}
                          fileName={fileName}
                          api={api}
                        />
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                  <ChatInputView
                    value={messageInput}
                    onChange={handleInputChange}
                    onSend={handleMainAction}
                    isWhisperMode={isWhisperMode}
                    toggleWhisper={() => setIsWhisperMode(!isWhisperMode)}
                    isSending={isSending}
                  />
                </div>

                {/* Contact Panel */}
                {showContactPanel && selectedChat && (
                  <ContactPanel
                    chat={selectedChat}
                    resolveName={(jid: string) => resolveName(jid)}
                    phone={formatPhoneNumber(selectedJid)}
                    deal={getDealByChatId(selectedJid)}
                    assignee={getChatAssignee(selectedJid)}
                    agents={agents}
                    onAssign={(agentId: string) => {
                      if (agentId === 'none') {
                        assignChat(selectedJid, '');
                      } else {
                        assignChat(selectedJid, agentId);
                      }
                      toast.success("Responsável atualizado!");
                    }}
                    onStageChange={(dealId: string, stageId: string) => {
                      updateDealStage(dealId, stageId);
                      toast.success("Etapa atualizada!");
                    }}
                    stages={stages}
                    notes={contactNotes[selectedJid]}
                    tags={contactTags[selectedJid] || []}
                    onSaveNote={(note: string) => saveContactNote(selectedJid, note)}
                    onSaveTags={(tags: string[]) => saveContactTags(selectedJid, tags)}
                    onHide={() => { hideContact(selectedJid); setSelectedChat(null); toast.success("Conversa ocultada"); }}
                    isHidden={hiddenContacts.includes(selectedJid)}
                    onUnhide={() => { unhideContact(selectedJid); toast.success("Conversa restaurada"); }}
                    editName={editName}
                    setEditName={setEditName}
                    onSaveName={() => { setCustomName(selectedJid, editName); toast.success("Nome salvo!"); }}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
              <div className="bg-gray-100 rounded-3xl p-6 mb-4">
                <MessageSquare className="h-12 w-12 opacity-40" />
              </div>
              <p className="text-sm font-medium text-gray-400">Selecione uma conversa</p>
              <p className="text-xs text-gray-300 mt-1">
                {totalUnread > 0 ? `Você tem ${totalUnread} mensage${totalUnread > 1 ? 'ns' : 'm'} não lida${totalUnread > 1 ? 's' : ''}` : 'Todas as conversas lidas'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Manual Resolution Dialog */}
      {resolutionDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-lg">Resolver Contato</h3>
            <p className="text-sm text-gray-500">Informe o número para este LID:</p>
            <Input value={manualPhoneInput} onChange={e => setManualPhoneInput(e.target.value)} placeholder="5511999999999" className="rounded-xl" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setResolutionDialogOpen(false)} className="rounded-xl">Cancelar</Button>
              <Button onClick={handleManualResolution} className="rounded-xl">Salvar</Button>
            </div>
          </div>
        </div>
      )}
    </CRMLayout>
  );
}
