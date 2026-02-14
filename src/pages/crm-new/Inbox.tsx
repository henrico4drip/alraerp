import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import CRMLayout from "@/components/CRMLayout";
import { useEvolution } from "@/contexts/EvolutionContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, MessageSquare, Clock, Send, Loader2, RefreshCw, FileText, Download, User, StickyNote, Briefcase, MessageCircle, Save, Plus, Phone, Check, EyeOff, X, Eye, Ghost, Lock, Unlock } from "lucide-react";
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
import { useLocation } from "react-router-dom";

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
        if (isMounted && data?.base64) {
          setBase64(data.base64);
        } else if (isMounted) {
          setError(true);
        }
      } catch (e) {
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchMedia();
    return () => { isMounted = false; };
  }, [message.key?.id, api]);

  if (loading) return <div className="flex items-center justify-center gap-2 text-xs text-gray-500 p-2 bg-gray-50 rounded min-h-[150px] w-[250px] border border-gray-200 animate-pulse"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>;
  if (error || !base64) return <div className="text-xs text-red-500 p-2 bg-red-50 rounded border border-red-100 w-[250px]">Erro ao carregar mídia</div>;

  const src = `data:${mimeType || 'application/octet-stream'};base64,${base64}`;

  if (type === 'image') return <div className="min-h-[150px] bg-gray-50 rounded-lg overflow-hidden border border-gray-100"><img src={src} className="max-w-[250px] max-h-[350px] w-auto h-auto object-cover" alt="Imagem" /></div>;
  if (type === 'video') return <div className="min-h-[150px] bg-gray-50 rounded-lg overflow-hidden border border-gray-100"><video src={src} controls className="max-w-[250px] max-h-[350px] w-auto h-auto" /></div>;
  if (type === 'audio') return (
    <div className="w-[260px] flex items-center justify-center p-2 rounded-md bg-gray-100">
      <audio src={src} controls className="w-full h-8" />
    </div>
  );
  if (type === 'sticker') return <img src={src} className="h-24 w-24 object-contain" alt="Sticker" />;
  if (type === 'document') {
    return (
      <a href={src} download={fileName || 'document'} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors w-full max-w-[280px] text-left group">
        <div className="bg-blue-50 p-2 rounded-md text-blue-600 group-hover:bg-blue-100 transition-colors">
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

const MessageBubble = memo(({ item, isMe, type, content, mimeType, fileName, api }: { item: any, isMe: boolean, type: string, content: string, mimeType?: string, fileName?: string, api: any }) => {
  if (item.type === 'message') {
    return (
      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[80%] px-4 py-3 rounded-2xl shadow-sm border ${isMe ? 'bg-blue-600 text-white border-blue-600 rounded-tr-none' : 'bg-white border-gray-200 text-gray-800 rounded-tl-none'}`}>
          {!isMe && item.data.pushName && <p className="text-[10px] font-bold mb-1 text-blue-600">{item.data.pushName}</p>}
          {type === 'text' ? (
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{content}</p>
          ) : (
            <MediaMessage message={item.data} type={type} mimeType={mimeType} fileName={fileName} api={api} />
          )}
          <p className={`text-[9px] mt-1.5 text-right font-medium ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>{format(new Date(item.timestamp * 1000), "HH:mm")}</p>
        </div>
      </div>
    );
  } else {
    const w = item.data;
    return (
      <div className="flex justify-center my-4">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl max-w-lg w-full flex gap-3 shadow-sm">
          <Ghost className="h-5 w-5 shrink-0 mt-0.5 opacity-50" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Sussurro de {w.senderName}</span>
              <span className="text-[10px] opacity-60">{format(new Date(w.timestamp * 1000), "HH:mm")}</span>
            </div>
            <p className="text-sm italic font-medium">"{w.text}"</p>
          </div>
        </div>
      </div>
    );
  }
});

// --- Memoized Sub-Components for Performance ---

const ChatListItem = memo(({ chat, isSelected, name, phone, onSelect }: { chat: any, isSelected: any, name: string, phone: string, onSelect: (chat: any) => void }) => (
  <button onClick={() => onSelect(chat)} className={`w-full flex items-center gap-3 p-4 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${isSelected ? "bg-blue-50 border-l-4 border-l-blue-600" : "bg-white"}`}>
    <Avatar className="h-10 w-10 shrink-0 border border-gray-100">
      <AvatarFallback className="bg-gray-100 text-gray-600 font-bold text-xs">{name.substring(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-baseline mb-1">
        <p className={`text-sm truncate ${isSelected ? 'font-bold text-blue-900' : 'font-semibold text-gray-800'}`}>{name}</p>
        {chat.messageTimestamp && <span className="text-[10px] text-gray-400 font-medium">{format(new Date(Number(chat.messageTimestamp) * 1000), "HH:mm")}</span>}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-[10px] text-gray-400 font-medium">{phone}</p>
        <p className="text-xs text-gray-500 truncate">{chat.lastMessage || "Nova conversa"}</p>
      </div>
    </div>
    {chat.unreadCount > 0 && <span className="h-5 min-w-[1.25rem] px-1 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm">{chat.unreadCount}</span>}
  </button>
));

const ChatInputView = memo(({ value, onChange, onSend, isWhisperMode, toggleWhisper }: { value: string, onChange: (v: string) => void, onSend: () => void, isWhisperMode: boolean, toggleWhisper: () => void }) => (
  <div className="p-4 bg-white border-t border-gray-200">
    <div className="max-w-4xl mx-auto flex items-end gap-3">
      <div className="flex-1 relative">
        {isWhisperMode && (
          <div className="absolute -top-8 left-0 text-[10px] font-bold text-amber-600 flex items-center gap-1 animate-pulse bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
            <Ghost className="h-3 w-3" /> MODO SUSSURRO (Privado)
          </div>
        )}
        <Textarea
          placeholder={isWhisperMode ? "Escrever nota interna..." : "Digite sua mensagem..."}
          className={`min-h-[48px] max-h-32 bg-gray-50 border-gray-200 resize-none py-3 text-sm focus:ring-2 transition-all rounded-xl ${isWhisperMode ? 'bg-amber-50 border-amber-200 focus:ring-amber-500/20' : 'focus:ring-blue-500/10 focus:border-blue-500'}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
      </div>
      <div className="flex flex-col gap-2 pb-0.5">
        <Button
          variant={isWhisperMode ? "default" : "ghost"}
          size="icon"
          className={`h-10 w-10 rounded-xl transition-all ${isWhisperMode ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'}`}
          onClick={toggleWhisper}
          title="Modo Sussurro (Interno)"
        >
          <Ghost className="h-5 w-5" />
        </Button>
        <Button size="icon" className="h-10 w-10 rounded-xl shadow-md bg-blue-600 hover:bg-blue-700 text-white transition-all hover:scale-105 active:scale-95" onClick={onSend}>
          <Send className="h-4 w-4 ml-0.5" />
        </Button>
      </div>
    </div>
  </div>
));

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
  } = useEvolution();
  const location = useLocation();
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'details' | 'notes' | 'sales'>('chat');

  const lidMap = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('lid_mappings') || '{}');
    } catch (e) { return {}; }
  }, [chats]);

  const [chatFilter, setChatFilter] = useState<'mine' | 'all' | 'hidden'>('all');
  const [showHiddenInput, setShowHiddenInput] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [isHiddenUnlocked, setIsHiddenUnlocked] = useState(false);

  // CRM Context
  const {
    agents,
    assignments,
    assignChat,
    getDealByChatId,
    stages,
    contactNotes,
    saveContactNote,
    contactTags,
    hiddenContacts,
    hideContact,
    unhideContact,
    hiddenChatPassword,
  } = useCrm();

  const [isWhisperMode, setIsWhisperMode] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [editName, setEditName] = useState("");
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const handleScroll = (e: any) => {
    const viewport = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = viewport;
    const atBottom = scrollHeight - scrollTop - clientHeight < 100;
    isAtBottomRef.current = atBottom;
  };

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    if (scrollViewportRef.current) {
      const viewport = scrollViewportRef.current;
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior
      });
    }
  };

  const [resolutionDialogOpen, setResolutionDialogOpen] = useState(false);
  const [failedLid, setFailedLid] = useState<string | null>(null);
  const [failedText, setFailedText] = useState<string | null>(null);
  const [manualPhoneInput, setManualPhoneInput] = useState("");

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

  // Sync scroll on bottom
  useEffect(() => {
    if (!scrollViewportRef.current) return;
    const resizeObserver = new ResizeObserver(() => {
      if (isAtBottomRef.current) {
        scrollToBottom("auto");
      }
    });
    const currentViewport = scrollViewportRef.current;
    const innerContainer = currentViewport.firstElementChild;
    if (innerContainer) resizeObserver.observe(innerContainer);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (selectedChat) {
      const jid = selectedChat.id || selectedChat.remoteJid;
      // Resolve name safely
      const resolved = customNames[jid] || discoveredNames[jid] || contacts.find((c: any) => c.id === jid)?.name || selectedChat.name || selectedChat.pushName || selectedChat.verifiedName || jid.split('@')[0];
      setEditName(resolved);
      setNoteInput(contactNotes[jid] || "");

      isAtBottomRef.current = true;
      if (messages.length > 0) setTimeout(() => scrollToBottom("auto"), 50);
    }
  }, [selectedChat]);

  useEffect(() => {
    if (!loadingMessages && messages.length > 0) {
      if (isAtBottomRef.current) setTimeout(() => scrollToBottom("auto"), 50);
    }
  }, [messages.length]);

  const loadChats = async (silent: boolean = false) => {
    if (!api || !isConnected) return;
    if (!silent) setLoading(true);
    try {
      const response = await api.fetchChats();
      setChats(prev => {
        if (JSON.stringify(prev) === JSON.stringify(response)) return prev;
        return response;
      });
    } catch (error: any) {
      console.error(error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadMessages = async (chat: any, silent: boolean = false) => {
    if (!api || !isConnected) return;
    const jid = chat.id || chat.remoteJid || chat.key?.remoteJid;
    if (!jid) return;

    if (!silent && messageCache[jid]) {
      setMessages(messageCache[jid]);
    }

    if (!silent) setLoadingMessages(true);
    try {
      const response = await api.fetchMessages(jid, 50);
      const newMessages = response.reverse().map((m: any) => ({
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

  const handleSendMessage = async () => {
    if (!api || !isConnected || !selectedChat || !messageInput.trim()) return;
    const jid = selectedChat.id || selectedChat.remoteJid || selectedChat.key?.remoteJid;

    try {
      if (isWhisperMode) {
        // Mock Whisper
        const whisperMsg = {
          key: { remoteJid: jid, id: 'whisper-' + Date.now(), fromMe: true },
          messageTimestamp: Math.floor(Date.now() / 1000),
          pushName: "Você (Sussurro)",
          type: 'whisper',
          data: {
            text: messageInput,
            senderName: "Você",
            timestamp: Math.floor(Date.now() / 1000)
          }
        };
        const newMsgs = [...messages, whisperMsg];
        setMessages(newMsgs);
        updateMessageCache(jid, newMsgs);
      } else {
        await api.sendTextMessage(jid, messageInput);
        setTimeout(() => loadMessages(selectedChat, true), 500);
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
    }
  };

  const handleSelectChat = useCallback((chat: any) => {
    setSelectedChat(chat);
    loadMessages(chat);
  }, [api, isConnected]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isConnected) {
      loadChats();
      interval = setInterval(() => loadChats(true), 15000);
    }
    return () => clearInterval(interval);
  }, [isConnected, api]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (selectedChat) {
      loadMessages(selectedChat, true);
      interval = setInterval(() => loadMessages(selectedChat, true), 5000);
    }
    return () => clearInterval(interval);
  }, [selectedChat]);

  const filteredChats = useMemo(() => {
    let filtered = chats;

    // Filter by type
    if (chatFilter === 'hidden') {
      filtered = filtered.filter(c => hiddenContacts.includes(c.id || c.remoteJid));
      if (!isHiddenUnlocked) return [];
    } else {
      filtered = filtered.filter(c => !hiddenContacts.includes(c.id || c.remoteJid));
      if (chatFilter === 'mine') {
        filtered = filtered.filter(c => assignments[c.id || c.remoteJid] === agents.find(a => a.email === 'me')?.id); // Mock logic for 'me'
      }
    }

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.pushName && c.pushName.toLowerCase().includes(q)) ||
        ((c.id || c.remoteJid) && (c.id || c.remoteJid).includes(q))
      );
    }

    return filtered.map(chat => {
      const jid = chat.id || chat.remoteJid;
      const name = customNames[jid] || discoveredNames[jid] || contacts.find((c: any) => c.id === jid)?.name || chat.name || chat.pushName || chat.verifiedName || jid.split('@')[0];
      const phone = isSameJid(jid, jid, lidMap) ? formatPhoneNumber(jid) : "LID (Oculto)";

      return { ...chat, computedName: name, computedPhone: phone };
    });
  }, [chats, searchQuery, chatFilter, isHiddenUnlocked, customNames, discoveredNames, contacts, lidMap, hiddenContacts, assignments]);

  const handleInputChange = useCallback((v: string) => setMessageInput(v), []);
  const handleMainAction = useCallback(() => handleSendMessage(), [handleSendMessage]);

  const handleSaveNote = () => {
    if (!selectedChat) return;
    saveContactNote(selectedChat.id || selectedChat.remoteJid, noteInput);
    toast.success("Nota salva!");
  };

  const handleStageChange = (val: string) => {
    if (!selectedChat) return;
    // Mock logic for deal update
    toast.success("Estágio atualizado (Mock)");
  };

  // Safe resolve name helper
  const safeResolveName = (id: string) => customNames[id] || discoveredNames[id] || contacts.find((c: any) => c.id === id)?.name || id.split('@')[0];

  return (
    <CRMLayout>
      <div className="flex h-[calc(100vh-theme(spacing.4))] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden m-2">
        {/* Sidebar List */}
        <div className="w-96 border-r border-gray-200 flex flex-col bg-white">
          <div className="p-4 border-b border-gray-100 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-gray-900 tracking-tight">Inbox</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => loadChats()} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors" title="Atualizar">
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
              <button onClick={() => setChatFilter('all')} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${chatFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>Tudo</button>
              <button onClick={() => setChatFilter('mine')} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${chatFilter === 'mine' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>Meus</button>
              {isHiddenUnlocked && <button onClick={() => setChatFilter('hidden')} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${chatFilter === 'hidden' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>Ocultos</button>}
            </div>

            {chatFilter === 'hidden' && !isHiddenUnlocked && (
              <div className="flex gap-2">
                <Input type="password" placeholder="Senha..." className="h-9 text-xs" value={unlockPassword} onChange={e => setUnlockPassword(e.target.value)} />
                <Button size="sm" onClick={() => { if (unlockPassword === hiddenChatPassword) { setIsHiddenUnlocked(true); toast.success("Desbloqueado"); } else toast.error("Senha errada"); }}>
                  <Unlock className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar..."
                className="pl-9 h-9 bg-gray-50 border-transparent focus:bg-white focus:border-blue-500 transition-all font-medium text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <ScrollArea className="flex-1 bg-white">
            <div className="flex flex-col">
              {filteredChats.map((chat) => (
                <ChatListItem
                  key={chat.id || chat.remoteJid}
                  chat={chat}
                  isSelected={selectedChat && isSameJid(chat.id || chat.remoteJid, selectedChat.id || selectedChat.remoteJid, lidMap)}
                  name={chat.computedName}
                  phone={chat.computedPhone}
                  onSelect={handleSelectChat}
                />
              ))}
              {filteredChats.length === 0 && !loading && (
                <div className="p-8 text-center text-gray-400 text-sm font-medium">Nenhuma conversa encontrada.</div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-gray-50/50">
          {selectedChat ? (
            <>
              {/* Header */}
              <div className="h-16 px-6 border-b border-gray-200 bg-white flex items-center justify-between shadow-sm sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10 border border-gray-100">
                    <AvatarImage src={selectedChat.profilePicUrl} />
                    <AvatarFallback className="bg-blue-50 text-blue-600 font-bold">
                      {safeResolveName(selectedChat.id || selectedChat.remoteJid).substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="font-bold text-gray-900 text-sm leading-tight">
                      {safeResolveName(selectedChat.id || selectedChat.remoteJid)}
                    </h2>
                    <p className="text-xs text-gray-500 font-medium">
                      {formatPhoneNumber(selectedChat.id || selectedChat.remoteJid)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Simplified Tabs for Header */}
                  <div className="flex bg-gray-100 p-0.5 rounded-lg mr-4">
                    <button onClick={() => setActiveTab('chat')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'chat' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>Chat</button>
                    <button onClick={() => setActiveTab('details')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'details' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>Dados</button>
                    <button onClick={() => setActiveTab('notes')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'notes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>Notas</button>
                  </div>

                  <Button variant="ghost" size="icon" onClick={() => setSelectedChat(null)} className="h-8 w-8 text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              {activeTab === 'chat' ? (
                <>
                  <div ref={scrollViewportRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30" onScroll={handleScroll}>
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
                  />
                </>
              ) : activeTab === 'details' ? (
                <div className="p-8 max-w-lg mx-auto w-full space-y-6">
                  <div className="space-y-4">
                    <Label>Nome Personalizado</Label>
                    <div className="flex gap-2">
                      <Input value={editName} onChange={e => setEditName(e.target.value)} />
                      <Button onClick={() => { setCustomName(selectedChat.id || selectedChat.remoteJid, editName); toast.success("Salvo"); }}>Salvar</Button>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'notes' ? (
                <div className="p-8 max-w-lg mx-auto w-full space-y-4">
                  <Label>Bloco de Notas</Label>
                  <Textarea value={noteInput} onChange={e => setNoteInput(e.target.value)} className="min-h-[300px]" placeholder="Escreva observações sobre este cliente..." />
                  <Button onClick={handleSaveNote} className="w-full">Salvar Notas</Button>
                </div>
              ) : null}

            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
              <MessageSquare className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-sm font-medium">Selecione uma conversa</p>
            </div>
          )}
        </div>
      </div>

      {/* Manual Resolution Dialog */}
      {resolutionDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-lg">Resolver Contato</h3>
            <p className="text-sm text-gray-500">Informe o número para este LID:</p>
            <Input value={manualPhoneInput} onChange={e => setManualPhoneInput(e.target.value)} placeholder="5511999999999" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setResolutionDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleManualResolution}>Salvar</Button>
            </div>
          </div>
        </div>
      )}
    </CRMLayout>
  );
}
