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

  if (loading) return <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground p-2 bg-muted/20 rounded min-h-[150px] w-[250px] border border-border/30 animate-pulse"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>;
  if (error || !base64) return <div className="text-xs text-red-500 p-2 bg-red-500/10 rounded border border-red-500/20 w-[250px]">Erro ao carregar mídia</div>;

  const src = `data:${mimeType || 'application/octet-stream'};base64,${base64}`;

  if (type === 'image') return <div className="min-h-[150px] bg-muted/20 rounded-lg overflow-hidden"><img src={src} className="rounded-lg max-w-[250px] max-h-[350px] w-auto h-auto shadow-sm object-cover" alt="Imagem" /></div>;
  if (type === 'video') return <div className="min-h-[150px] bg-muted/20 rounded-lg overflow-hidden"><video src={src} controls className="rounded-lg max-w-[250px] max-h-[350px] w-auto h-auto shadow-sm" /></div>;
  if (type === 'audio') return (
    <div className="w-[260px] flex items-center justify-center p-1 rounded-md bg-black/5 dark:bg-white/10">
      <audio src={src} controls className="w-full h-8" />
    </div>
  );
  if (type === 'sticker') return <img src={src} className="h-24 w-24 object-contain" alt="Sticker" />;
  if (type === 'document') {
    return (
      <a href={src} download={fileName || 'document'} className="flex items-center gap-3 p-3 bg-card/50 border border-border/50 rounded-lg hover:bg-muted/50 transition-colors w-full max-w-[280px] text-left group">
        <div className="bg-primary/10 p-2 rounded-md text-primary group-hover:bg-primary/20 transition-colors">
          <FileText className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{fileName || 'Documento'}</p>
          <p className="text-[10px] text-muted-foreground uppercase">{mimeType?.split('/')[1] || 'FILE'}</p>
        </div>
        <Download className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100" />
      </a>
    );
  }
  return null;
});

const MessageBubble = memo(({ item, isMe, type, content, mimeType, fileName, api }: { item: any, isMe: boolean, type: string, content: string, mimeType?: string, fileName?: string, api: any }) => {
  if (item.type === 'message') {
    return (
      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl shadow-sm ${isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-card border border-border/50 rounded-tl-none'}`}>
          {!isMe && item.data.pushName && <p className="text-[10px] font-bold mb-1 text-primary">{item.data.pushName}</p>}
          {type === 'text' ? (
            <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
          ) : (
            <MediaMessage message={item.data} type={type} mimeType={mimeType} fileName={fileName} api={api} />
          )}
          <p className={`text-[10px] mt-1 text-right opacity-70 ${isMe ? 'text-primary-foreground' : 'text-muted-foreground'}`}>{format(new Date(item.timestamp * 1000), "HH:mm")}</p>
        </div>
      </div>
    );
  } else {
    const w = item.data;
    return (
      <div className="flex justify-center my-4">
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 px-4 py-3 rounded-xl max-w-lg w-full flex gap-3 shadow-sm">
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
  <button onClick={() => onSelect(chat)} className={`w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors ${isSelected ? "bg-muted border-l-4 border-primary" : ""}`}>
    <Avatar className="h-10 w-10 shrink-0">
      <AvatarFallback className="bg-primary/10 text-primary">{name.substring(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-baseline">
        <p className="font-semibold text-sm truncate">{name}</p>
        {chat.messageTimestamp && <span className="text-[10px] text-muted-foreground">{format(new Date(Number(chat.messageTimestamp) * 1000), "HH:mm")}</span>}
      </div>
      <div className="flex flex-col">
        <p className="text-[10px] text-muted-foreground mb-0.5">{phone}</p>
        <p className="text-xs text-muted-foreground truncate">{chat.lastMessage || "Sem mensagens"}</p>
      </div>
    </div>
    {chat.unreadCount > 0 && <span className="h-5 min-w-[1.25rem] rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0">{chat.unreadCount}</span>}
  </button>
));

const ChatInputView = memo(({ value, onChange, onSend, isWhisperMode, toggleWhisper }: { value: string, onChange: (v: string) => void, onSend: () => void, isWhisperMode: boolean, toggleWhisper: () => void }) => (
  <div className="p-4 bg-card border-t border-border/50">
    <div className="max-w-4xl mx-auto flex items-end gap-2">
      <div className="flex-1 relative">
        {isWhisperMode && (
          <div className="absolute -top-8 left-0 text-[10px] font-bold text-amber-500 flex items-center gap-1 animate-bounce">
            <Ghost className="h-3 w-3" /> MODO SUSSURRO ATIVADO
          </div>
        )}
        <Textarea
          placeholder={isWhisperMode ? "Digite um sussurro para a equipe..." : "Digite sua mensagem..."}
          className={`min-h-[44px] max-h-32 bg-muted/50 border-none resize-none py-3 transition-colors ${isWhisperMode ? 'bg-amber-500/5 focus-visible:ring-amber-500' : ''}`}
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
      <div className="flex flex-col gap-2">
        <Button
          variant={isWhisperMode ? "default" : "outline"}
          size="icon"
          className={`h-11 w-11 rounded-xl transition-all shadow-md ${isWhisperMode ? 'bg-amber-500 hover:bg-amber-600 text-white border-none' : 'hover:text-amber-500 hover:bg-amber-500/10'}`}
          onClick={toggleWhisper}
          title="Alternar Modo Sussurro"
        >
          <Ghost className="h-5 w-5" />
        </Button>
        <Button size="icon" className="h-11 w-11 rounded-xl shadow-lg" onClick={onSend}>
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  </div>
));

export default function Inbox() {
  const {
    api,
    isConnected,
    instanceName,
    resolveName,
    contacts,
    discoveredNames,
    setDiscoveredNames,
    customNames,
    setCustomName,
    messageCache,
    updateMessageCache,
    syncContacts,
    autoSync,
    isSyncing: contextIsSyncing
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

  // OPTIMIZATION: Memoize the JID Map to avoid thousands of JSON.parse calls per minute
  const lidMap = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('lid_mappings') || '{}');
    } catch (e) { return {}; }
  }, [chats]); // Refresh when chats change
  const [chatFilter, setChatFilter] = useState<'mine' | 'all' | 'hidden'>('all');
  const [showHiddenInput, setShowHiddenInput] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [isHiddenUnlocked, setIsHiddenUnlocked] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatNumber, setNewChatNumber] = useState("");
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [contactLoading, setContactLoading] = useState(false);

  // CRM Context
  const {
    agents,
    currentUser,
    setCurrentUser,
    assignments,
    assignChat,
    getChatAssignee,
    getDealByChatId,
    addDeal,
    updateDealStage,
    stages,
    contactNotes,
    saveContactNote,
    contactTags,
    saveContactTags,
    hiddenContacts,
    hideContact,
    unhideContact,
    hiddenChatPassword,
    whispers,
    addWhisper
  } = useCrm();

  const [isWhisperMode, setIsWhisperMode] = useState(false);

  // Local state for editing details/notes
  const [noteInput, setNoteInput] = useState("");
  const [editName, setEditName] = useState("");
  const [tagInput, setTagInput] = useState("");
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // Monitor scroll position to decide if we should auto-scroll
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

  // Manual LID Resolution State
  const [resolutionDialogOpen, setResolutionDialogOpen] = useState(false);
  const [failedLid, setFailedLid] = useState<string | null>(null);
  const [failedText, setFailedText] = useState<string | null>(null);
  const [manualPhoneInput, setManualPhoneInput] = useState("");

  const handleManualResolution = () => {
    if (!failedLid || !manualPhoneInput.trim()) return;

    // Normalize input to JID
    let phone = manualPhoneInput.replace(/\D/g, '');
    if (!phone.includes('@s.whatsapp.net')) phone += '@s.whatsapp.net';

    // Save to Local Storage and Context
    const savedMap = JSON.parse(localStorage.getItem('lid_mappings') || '{}');
    savedMap[failedLid] = phone;
    localStorage.setItem('lid_mappings', JSON.stringify(savedMap));

    // Update context map
    setDiscoveredNames(prev => ({ ...prev, [failedLid]: phone }));

    toast.success("Vínculo salvo! Reenviando mensagem...");
    setResolutionDialogOpen(false);

    // Retry sending
    if (failedText) {
      api?.sendTextMessage(phone, failedText)
        .then(() => {
          loadMessages(selectedChat, true);
          setFailedLid(null);
          setFailedText(null);
          setManualPhoneInput("");
        })
        .catch(() => toast.error("Falha ao reenviar. Tente novamente."));
    }
  };

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
      setEditName(resolveName(jid, selectedChat.name || selectedChat.pushName));
      setNoteInput(contactNotes[jid] || "");
      setTagInput(contactTags[jid]?.join(", ") || "");

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

      // Update discovered names for future resolution
      const newNames: Record<string, string> = {};
      const invalidNames = ['Você', 'You', 'Eu', 'Me', 'Desconhecido', 'Unknown', 'Null', 'Undefined'];
      const isInvalid = (n: any) => {
        if (!n || typeof n !== 'string') return true;
        const clean = n.trim().toLowerCase();
        return clean.includes('@') || invalidNames.some(inv => clean === inv.toLowerCase() || clean.startsWith(inv.toLowerCase() + " "));
      };

      response.forEach(c => {
        const jid = c.id || c.remoteJid;
        if (jid && c.name && !isInvalid(c.name) && c.name !== jid.split('@')[0]) {
          newNames[jid] = c.name;
        }
      });
      setDiscoveredNames(prev => ({ ...prev, ...newNames }));
    } catch (error: any) {
      if (!silent) toast.error("Erro ao carregar conversas: " + error.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadMessages = async (chat: any, silent: boolean = false) => {
    if (!api || !isConnected) return;
    const jid = chat.id || chat.remoteJid || chat.key?.remoteJid;
    if (!jid) return;

    // Use cache immediately if available
    if (!silent && messageCache[jid]) {
      setMessages(messageCache[jid]);
    }

    if (!silent) setLoadingMessages(true);
    try {
      const response = await api.fetchMessages(jid, 200); // Reduced for better performance
      const newMessages = response.reverse();

      setMessages(prev => {
        // Simple deduplication logic
        if (JSON.stringify(prev) === JSON.stringify(newMessages)) return prev;

        // Update cache
        updateMessageCache(jid, newMessages);
        return newMessages;
      });
    } catch (error: any) {
      if (!silent) toast.error("Erro ao carregar mensagens: " + error.message);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  const handleSendMessage = async () => {
    if (!api || !isConnected || !selectedChat || !messageInput.trim()) return;
    const jid = selectedChat.id || selectedChat.remoteJid || selectedChat.key?.remoteJid;
    const text = messageInput.trim();
    const tempId = 'temp-' + Date.now();
    const tempMsg = {
      key: { remoteJid: jid, fromMe: true, id: tempId },
      message: { conversation: text },
      messageTimestamp: Math.floor(Date.now() / 1000),
      status: 'PENDING'
    };
    setMessages(prev => [...prev, tempMsg]);
    setMessageInput("");
    let targetJid = jid;




    // Find last partner message to quote if needed
    const lastPartnerMsg = [...messages].reverse().find(m => !m.key.fromMe);

    try {
      await api.sendTextMessage(jid, text, lastPartnerMsg);
      loadMessages(selectedChat, true);
      loadChats(true);
    } catch (error: any) {
      toast.error("Erro ao enviar: " + error.message);
      setMessages(prev => prev.filter(m => m.key.id !== tempId));
      setMessageInput(text);
    }
  };

  const handleSendWhisper = () => {
    if (!selectedChat || !messageInput.trim()) return;
    const jid = selectedChat.id || selectedChat.remoteJid;
    addWhisper({
      chatId: jid,
      senderId: currentUser.id,
      senderName: currentUser.name,
      text: messageInput.trim()
    });
    setMessageInput("");
    setIsWhisperMode(false);
    toast.success("Sussurro enviado!");
  };

  const handleMainAction = () => {
    if (isWhisperMode) handleSendWhisper();
    else handleSendMessage();
  };

  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      loadChats(true);
      if (selectedChat) loadMessages(selectedChat, true);
    }, 20000);
    return () => clearInterval(interval);
  }, [selectedChat?.id, isConnected]);

  useEffect(() => {
    loadChats();
  }, [api, isConnected]);

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat);
      const jid = selectedChat.id || selectedChat.remoteJid;
      if (jid && api) {
        api.markRead(jid);
        setChats(prev => prev.map(c => isSameJid(c.id || c.remoteJid, jid) ? { ...c, unreadCount: 0 } : c));
      }
    }
  }, [selectedChat, api]);

  // Handle Deep Linking from Contacts page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const contactId = params.get('contactId');
    const tab = params.get('tab');

    if (contactId && chats.length > 0) {
      const chat = chats.find(c => isSameJid(c.id || c.remoteJid, contactId));
      if (chat) {
        setSelectedChat(chat);
        if (tab === 'details') setActiveTab('details');
        // Clear params to avoid loop
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [chats.length]);

  // OPTIMIZATION: Pre-calculate all chat metadata once to avoid work in the render loop
  const enrichedChats = useMemo(() => {
    return chats.map(chat => {
      const jid = chat.id || chat.remoteJid;
      return {
        ...chat,
        computedName: resolveName(jid, chat.name || chat.pushName),
        computedPhone: formatPhoneNumber(jid),
        primaryJid: jid
      };
    });
  }, [chats, customNames, resolveName]);

  const filteredChats = useMemo(() => {
    return enrichedChats.filter(chat => {
      const jid = chat.primaryJid;
      const isHidden = hiddenContacts.some(hc => isSameJid(hc, jid, lidMap));

      if (chatFilter === 'hidden') return isHiddenUnlocked && isHidden;
      if (isHidden) return false;

      const name = (chat.computedName || "").toLowerCase();
      const lastMsg = (chat.lastMessage || "").toLowerCase();
      const matchesSearch = name.includes(searchQuery.toLowerCase()) || lastMsg.includes(searchQuery.toLowerCase());

      if (chatFilter === 'mine') return matchesSearch && assignments[jid] === currentUser.id;
      return matchesSearch;
    });
  }, [enrichedChats, hiddenContacts, chatFilter, isHiddenUnlocked, searchQuery, assignments, currentUser.id, lidMap]);

  const mergedItems = useMemo(() => {
    return [
      ...messages.filter(msg => extractMessageContent(msg).type !== 'unknown').map(msg => ({
        type: 'message' as const,
        timestamp: Number(msg.messageTimestamp),
        data: msg
      })),
      ...whispers.filter(w => selectedChat && w.chatId === (selectedChat.id || selectedChat.remoteJid)).map(w => ({
        type: 'whisper' as const,
        timestamp: w.timestamp,
        data: w
      }))
    ].sort((a, b) => a.timestamp - b.timestamp);
  }, [messages, whispers, selectedChat?.id]);

  const handleSelectChat = useCallback((chat: any) => {
    setSelectedChat(chat);
  }, []);

  const handleInputChange = useCallback((val: string) => {
    setMessageInput(val);
  }, []);

  const handleSaveNote = () => {
    if (!selectedChat) return;
    saveContactNote(selectedChat.id || selectedChat.remoteJid, noteInput);
    toast.success("Nota salva!");
  };

  const handleStageChange = (val: string) => {
    if (!selectedChat) return;
    const jid = selectedChat.id || selectedChat.remoteJid;
    const deal = getDealByChatId(jid);
    if (deal) updateDealStage(deal.id, val);
    else addDeal({
      id: Math.random().toString(36).substr(2, 9),
      chatId: jid,
      title: resolveName(jid, selectedChat.name || selectedChat.pushName),
      company: "WhatsApp",
      value: "R$ 0,00",
      stageId: val,
      tags: ["Novo"],
      createdAt: Date.now()
    });
    toast.success("Funil atualizado!");
  };

  return (
    <CRMLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
        <div className="w-80 border-r border-border/50 flex flex-col bg-card">
          <div className="p-4 space-y-4 border-b border-border/50">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg">Inbox</h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 hover:bg-muted"
                    onClick={() => loadChats()}
                    disabled={loading}
                    title="Atualizar"
                  >
                    <RefreshCw className={`h-4.5 w-4.5 ${loading ? "animate-spin" : ""}`} />
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-9 gap-2 shadow-sm"
                    onClick={() => setIsNewChatOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Novo
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select value={currentUser.id} onValueChange={(id) => setCurrentUser(agents.find(a => a.id === id) || agents[0])}>
                  <SelectTrigger className="flex-1 h-9 text-xs bg-muted/30 border-none shadow-none focus:ring-1 focus:ring-primary/20">
                    <SelectValue placeholder="Usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex rounded-lg bg-muted p-1">
              <button onClick={() => setChatFilter('mine')} className={`flex-1 text-[10px] py-1.5 rounded-md transition-all ${chatFilter === 'mine' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>Minhas</button>
              <button onClick={() => setChatFilter('all')} className={`flex-1 text-[10px] py-1.5 rounded-md transition-all ${chatFilter === 'all' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>Todas</button>
              <button
                onClick={() => {
                  if (chatFilter === 'hidden') {
                    setChatFilter('all');
                  } else {
                    setChatFilter('hidden');
                    if (!isHiddenUnlocked) setShowHiddenInput(true);
                  }
                }}
                className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-all ${chatFilter === 'hidden' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted-foreground/10'}`}
              >
                {isHiddenUnlocked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              </button>
            </div>
            {chatFilter === 'hidden' && !isHiddenUnlocked && showHiddenInput && (
              <div className="p-2 space-y-2 animate-in slide-in-from-top-1">
                <Input
                  type="password"
                  placeholder="Senha para ocultas..."
                  className="h-8 text-[10px]"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (unlockPassword === hiddenChatPassword) {
                        setIsHiddenUnlocked(true);
                        setShowHiddenInput(false);
                        setUnlockPassword("");
                        toast.success("Conversas desbloqueadas!");
                      } else {
                        toast.error("Senha incorreta");
                      }
                    }
                  }}
                  autoFocus
                />
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Pesquisar conversas ou mensagens..." className="pl-9 h-9 bg-muted/50 border-none text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="divide-y divide-border/10">
              {filteredChats.map((chat) => {
                const jid = chat.id || chat.remoteJid;
                return (
                  <ChatListItem
                    key={jid}
                    chat={chat}
                    isSelected={selectedChat && isSameJid(jid, selectedChat.id || selectedChat.remoteJid, lidMap)}
                    name={chat.computedName}
                    phone={chat.computedPhone}
                    onSelect={handleSelectChat}
                  />
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col bg-muted/5">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="border-b border-border/50 bg-card/50 backdrop-blur z-10">
                <div className="h-16 flex items-center justify-between px-6">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-border/50">
                      <AvatarImage src={selectedChat.profilePicUrl} />
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {resolveName(selectedChat.id || selectedChat.remoteJid, selectedChat.name || selectedChat.pushName).substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm leading-none">
                          {resolveName(selectedChat.id || selectedChat.remoteJid, selectedChat.name || selectedChat.pushName)}
                        </p>
                        <span className="text-[10px] text-muted-foreground opacity-60">
                          {formatPhoneNumber(selectedChat.id || selectedChat.remoteJid)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">Responsável:</span>
                        <Select
                          value={assignments[selectedChat.id || selectedChat.remoteJid] || "unassigned"}
                          onValueChange={(val) => assignChat(selectedChat.id || selectedChat.remoteJid, val)}
                        >
                          <SelectTrigger className="h-5 w-[100px] text-[10px] px-2 py-0 border-border/30 bg-background/50">
                            <SelectValue placeholder="Ninguém" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Ninguém</SelectItem>
                            {agents.map(a => (
                              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {hiddenContacts.includes(selectedChat.id || selectedChat.remoteJid) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-500 hover:bg-green-500/10"
                        title="Desocultar"
                        onClick={() => {
                          unhideContact(selectedChat.id || selectedChat.remoteJid);
                          toast.success("Contato visível novamente!");
                        }}
                      >
                        <Unlock className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                      title="Ocultar do CRM"
                      onClick={() => {
                        if (confirm("Deseja ocultar permanentemente este contato do CRM? (Acessível via senha)")) {
                          hideContact(selectedChat.id || selectedChat.remoteJid);
                          setSelectedChat(null);
                          toast.success("Contato ocultado!");
                        }
                      }}
                    >
                      <EyeOff className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Tabs Navigation */}
                <div className="flex px-6 gap-6 text-sm font-medium text-muted-foreground">
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'chat' ? 'border-primary text-primary' : 'border-transparent hover:text-foreground'}`}
                  >
                    <MessageCircle className="h-4 w-4" /> Conversa
                  </button>
                  <button
                    onClick={() => setActiveTab('details')}
                    className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'details' ? 'border-primary text-primary' : 'border-transparent hover:text-foreground'}`}
                  >
                    <User className="h-4 w-4" /> Dados
                  </button>
                  <button
                    onClick={() => setActiveTab('notes')}
                    className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'notes' ? 'border-primary text-primary' : 'border-transparent hover:text-foreground'}`}
                  >
                    <StickyNote className="h-4 w-4" /> Notas
                  </button>
                  <button
                    onClick={() => setActiveTab('sales')}
                    className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'sales' ? 'border-primary text-primary' : 'border-transparent hover:text-foreground'}`}
                  >
                    <Briefcase className="h-4 w-4" /> Vendas
                  </button>
                </div>
              </div>

              {activeTab === 'chat' ? (
                <>
                  <div ref={scrollViewportRef} className="flex-1 overflow-y-auto p-6" onScroll={handleScroll}>
                    <div className="space-y-4 max-w-4xl mx-auto pb-4">
                      {mergedItems.map((item, idx) => {
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
                <div className="p-8 max-w-2xl mx-auto w-full space-y-6">
                  <div className="space-y-4">
                    <Label className="text-muted-foreground">Nome de Exibição (Clique para editar)</Label>
                    <div className="flex gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Digite um apelido ou nome..."
                        className="bg-muted focus-visible:ring-primary/20"
                      />
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          if (!selectedChat) return;
                          const jid = selectedChat.id || selectedChat.remoteJid;
                          setCustomName(jid, editName);
                          toast.success("Nome salvo com sucesso!");
                        }}
                        className="shrink-0"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Salvar
                      </Button>
                    </div>
                    <Label className="mt-4 block text-muted-foreground">WhatsApp ID / JID</Label>
                    <Input value={selectedChat.id || selectedChat.remoteJid} readOnly className="bg-muted/50 font-mono text-xs opacity-60" />
                  </div>

                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                    <p className="text-xs text-primary font-medium flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      O nome salvo aqui tem prioridade total e aparecerá em todas as telas do sistema.
                    </p>
                  </div>
                </div>
              ) : activeTab === 'notes' ? (
                <div className="p-8 max-w-2xl mx-auto w-full space-y-4">
                  <Label>Anotações Internas</Label>
                  <Textarea placeholder="Observações..." className="min-h-[200px]" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} />
                  <Button onClick={handleSaveNote} className="w-full"><Save className="h-4 w-4 mr-2" /> Salvar Notas</Button>
                </div>
              ) : (
                <div className="p-8 flex flex-col items-center justify-center max-w-2xl mx-auto w-full gap-6">
                  <Briefcase className="h-12 w-12 text-muted-foreground/30" />
                  <div className="text-center">
                    <h3 className="font-bold">Mover para Estágio</h3>
                    <p className="text-sm text-muted-foreground">Atualize a etapa deste cliente no funil de vendas.</p>
                  </div>
                  <Select value={getDealByChatId(selectedChat.id || selectedChat.remoteJid)?.stageId || ""} onValueChange={handleStageChange}>
                    <SelectTrigger className="w-full h-12">
                      <SelectValue placeholder="Selecionar etapa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map(s => <SelectItem key={s.id} value={s.id}><div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${s.color}`} /> {s.title}</div></SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground animate-in fade-in duration-500">
              <MessageSquare className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-medium italic">Selecione uma conversa para começar</p>
            </div>
          )}
        </div>
      </div>
      {/* Manual Resolution Dialog */}
      <div className={`fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 transition-all duration-200 ${resolutionDialogOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-card border border-border rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <User className="h-5 w-5 text-amber-500" />
              Identificar Contato
            </h3>
            <p className="text-sm text-muted-foreground">
              O sistema não conseguiu identificar o número de telefone deste contato (LID).
              Por favor, informe o número real para vincularmos.
            </p>
            <div className="p-2 bg-muted/50 rounded text-xs font-mono text-muted-foreground break-all">
              ID: {failedLid}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Número de Telefone (com DDD)</Label>
            <Input
              placeholder="Ex: 5511999998888"
              value={manualPhoneInput}
              onChange={(e) => setManualPhoneInput(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setResolutionDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleManualResolution}>Salvar e Reenviar</Button>
          </div>
        </div>
      </div>
    </CRMLayout>
  );
}


