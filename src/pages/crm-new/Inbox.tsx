import { useState, useEffect, useRef, memo, useMemo } from "react";
import CRMLayout from "@/components/CRMLayout";
import { useChatwoot } from "@/contexts/ChatwootContext";
import { useCrm } from "@/contexts/CrmContext";
import { useEvolution } from "@/contexts/EvolutionContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Send, Check, RefreshCw, GitMerge, Info, MessageSquare, Trash2, CheckCircle2, Briefcase, Plus } from "lucide-react";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";

// --- Helpers ---
function safeFormatDate(timestamp: any) {
  if (!timestamp) return "";
  try {
    const date = typeof timestamp === 'number'
      ? new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000)
      : new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    return format(date, "HH:mm");
  } catch {
    return "";
  }
}

function safeSub(str: any, len: number = 2) {
  const s = String(str || "");
  return s.substring(0, len).toUpperCase();
}

// --- Message Bubble ---
const MessageBubble = memo(({ item, isMe }: { item: any, isMe: boolean }) => {
  if (item.message_type === 2) {
    return (
      <div className="flex justify-center my-3">
        <div className="bg-amber-50/80 backdrop-blur border border-amber-200/50 text-amber-800 px-4 py-2.5 rounded-xl max-w-lg w-full flex gap-3 shadow-sm">
          <p className="text-xs italic font-medium">"{item.content}"</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col mb-1.5 px-6 ${isMe ? 'items-end' : 'items-start'}`}>
      <div className={`group relative max-w-[75%] md:max-w-[65%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
        <div className={`relative px-4 py-2 text-[15px] shadow-sm leading-[1.4] transition-all hover:shadow-md ${isMe
          ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-2xl rounded-tr-sm border border-indigo-400/20'
          : 'bg-white text-gray-800 rounded-2xl rounded-tl-sm border border-gray-100'
          }`}>
          {item.content && (
            <div className="whitespace-pre-wrap break-words">{item.content}</div>
          )}
          <div className={`flex items-center justify-end gap-1 mt-1 -mb-1 ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
            <span className="text-[10px] leading-none mb-0.5 opacity-90">
              {safeFormatDate(item.created_at)}
            </span>
            {isMe && <Check className={`h-3 w-3 text-indigo-200`} />}
          </div>
        </div>
      </div>
    </div>
  );
});

// --- Chat List Item ---
const ChatListItem = memo(({ chat, isSelected, onSelect, onResolve, onDelete }: {
  chat: any, isSelected: boolean, onSelect: (chat: any) => void, onResolve: (chat: any) => void, onDelete: (chat: any) => void
}) => {
  const meta = chat.meta || {};
  const sender = meta.sender || {};
  const name = (chat as any).resolvedName || "Desconhecido";
  const lastMsg = chat.messages?.[chat.messages.length - 1];
  const lastMsgContent = lastMsg?.content || "";
  const unread = (chat as any)._mergedUnread || chat.unread_count || 0;

  return (
    <div className="relative group">
      <button
        onClick={() => onSelect(chat)}
        className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all border-l-[3px] ${isSelected
          ? "bg-gradient-to-r from-indigo-50 to-blue-50/50 border-l-indigo-500"
          : "bg-white hover:bg-gray-50/80 border-l-transparent"
          }`}
      >
        <div className="relative">
          <Avatar className="h-11 w-11 shrink-0 ring-2 ring-white shadow-sm">
            <AvatarImage src={sender.thumbnail} />
            <AvatarFallback className="bg-gradient-to-br from-indigo-100 to-blue-100 text-indigo-700 font-semibold text-sm">
              {safeSub(name)}
            </AvatarFallback>
          </Avatar>
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-[20px] rounded-full bg-red-500 ring-2 ring-white text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-sm transition-transform group-hover:scale-110">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-0.5">
            <span className="font-semibold text-gray-900 text-[15px] truncate pr-2">{name}</span>
            <span className={`text-[11px] whitespace-nowrap ${unread > 0 ? "text-indigo-600 font-bold" : "text-gray-400"}`}>
              {safeFormatDate(lastMsg?.created_at)}
            </span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <p className={`text-sm truncate ${unread > 0 ? "text-gray-900 font-medium" : "text-gray-500"}`}>
              {lastMsgContent}
            </p>
          </div>
        </div>
      </button>

      {/* Hover Actions */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
        <button
          onClick={(e) => { e.stopPropagation(); onResolve(chat); }}
          className="h-8 w-8 rounded-lg bg-white border border-gray-200 shadow-sm flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-colors"
          title="Arquivar/Resolver"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(chat); }}
          className="h-8 w-8 rounded-lg bg-white border border-gray-200 shadow-sm flex items-center justify-center text-red-600 hover:bg-red-50 transition-colors"
          title="Deletar permanentemente"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});

// --- Main Inbox Component ---
export default function Inbox() {
  const { conversations, messages, isLoading, activeConversationId, setActiveConversationId, sendMessage,
    syncEvolutionHistory, isSyncingHistory,
    loadMoreMessages, isFetchingHistory, hasMoreMessages,
    loadMoreConversations, isFetchingMoreConvos, hasMoreConversations,
    resolveConversation, deleteConversation } = useChatwoot();
  const { resolveName } = useEvolution();
  const {
    agents, getChatAssignee, assignChat, stages, updateDealStage, addDeal,
    getDealByChatId, contactNotes, saveContactNote, contactTags, saveContactTags
  } = useCrm();

  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showContactPanel, setShowContactPanel] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedChat = conversations.find(c => c.id === activeConversationId);
  const currentMessages = (activeConversationId ? messages[activeConversationId] : []) || [];

  const handleSelectChat = (chat: any) => {
    setActiveConversationId(chat.id);
  };

  const handleSend = async () => {
    if (!messageInput.trim() || !activeConversationId || isSending) return;
    try {
      setIsSending(true);
      await sendMessage(activeConversationId, messageInput.trim());
      setMessageInput("");
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages]);

  const resolvedConversations = useMemo(() => {
    return conversations.map(c => {
      const sender = c.meta?.sender || {};
      const jid = sender.identifier || sender.phone_number || "";
      const fallbackName = sender.name || sender.phone_number || "Desconhecido";
      const name = resolveName(jid, fallbackName);

      return { ...c, resolvedName: name };
    });
  }, [conversations, resolveName]);

  const filteredChats = useMemo(() => {
    return resolvedConversations.filter(c => {
      const name = c.resolvedName.toLowerCase();
      const phone = c.meta?.sender?.phone_number || '';

      // Filter out system/api conversations that clutter the UI
      if (name.includes('evolutionapi')) return false;

      return name.includes(searchQuery.toLowerCase()) || phone.includes(searchQuery);
    });
  }, [resolvedConversations, searchQuery]);

  // Derived JID for CRM lookups
  const crmId = useMemo(() => {
    if (!selectedChat) return null;
    const sender = selectedChat.meta?.sender || {};
    return sender.identifier || sender.phone_number || null;
  }, [selectedChat]);

  return (
    <CRMLayout>
      <div className="h-full bg-white flex flex-col md:flex-row overflow-hidden absolute inset-0">
        {/* We use absolute inset-0 to force fill the main content area of CRMLayout */}
        {/* Lado Esquerdo - Lista de Chats */}
        <div className="w-[380px] shrink-0 border-r border-gray-200 bg-white flex flex-col h-full z-10 shadow-[2px_0_8px_-3px_rgba(0,0,0,0.05)]">
          <div className="p-4 bg-white border-b border-gray-100 shrink-0 shadow-sm relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                Inbox <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">{filteredChats.length}</span>
              </h1>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => syncEvolutionHistory()}
                  disabled={isSyncingHistory}
                  title="Puxar todo o histórico do WhatsApp para o Chatwoot"
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-indigo-600 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncingHistory ? 'animate-spin' : ''}`} />
                </button>
                {conversations.some(c => c.resolvedName?.includes('EvolutionAPI')) && (
                  <button
                    onClick={async () => {
                      if (confirm("Deseja arquivar TODAS as conversas de sistema (EvolutionAPI)?")) {
                        const targets = conversations.filter(c => c.resolvedName?.includes('EvolutionAPI'));
                        for (const t of targets) {
                          await resolveConversation(t.id);
                        }
                      }
                    }}
                    title="Arquivar conversas de sistema"
                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar conversas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-inner"
              />
            </div>
          </div>

          <ScrollArea className="flex-1 bg-white">
            {isLoading && conversations.length === 0 ? (
              <div className="flex items-center justify-center h-full p-8 text-indigo-500">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filteredChats.length > 0 ? (
              filteredChats.map((chat) => (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  isSelected={activeConversationId === chat.id}
                  onSelect={handleSelectChat}
                  onResolve={(c) => resolveConversation(c.id)}
                  onDelete={(c) => {
                    if (confirm(`Deletar permanentemente a conversa com ${c.resolvedName}?`)) {
                      deleteConversation(c.id);
                    }
                  }}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <MessageSquare className="h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">Nenhuma conversa encontrada</p>
                <p className="text-[10px] text-gray-400 mt-1 italic">Tente mudar o filtro ou buscar</p>
              </div>
            )}

            {hasMoreConversations && filteredChats.length > 0 && searchQuery === "" && (
              <div className="p-3 border-t border-gray-50 bg-white">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    if (!isFetchingMoreConvos) loadMoreConversations();
                  }}
                  disabled={isFetchingMoreConvos}
                  className="w-full py-2.5 px-4 bg-white border border-gray-200 text-gray-600 font-bold text-[10px] tracking-widest rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isFetchingMoreConvos ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 text-gray-400" />
                  )}
                  <span>CARREGAR MAIS CONVERSAS</span>
                </button>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Lado Direito - Mensagens */}
        <div className="flex-1 flex flex-col h-full bg-[#E5DDD5] relative overflow-hidden">
          {selectedChat ? (
            <div className="flex h-full w-full">
              <div className="flex-1 flex flex-col h-full min-w-0">
                {/* Header do Chat */}
                <div className="h-[68px] shrink-0 px-6 bg-white/95 backdrop-blur shadow-sm border-b border-gray-200 flex items-center justify-between z-10">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 ring-2 ring-gray-100 shadow-sm pointer-events-none">
                      <AvatarImage src={selectedChat.meta?.sender?.thumbnail} />
                      <AvatarFallback className="bg-gradient-to-br from-indigo-100 to-blue-200 text-indigo-700 font-bold">
                        {safeSub(resolvedConversations.find(c => c.id === selectedChat.id)?.resolvedName || "D")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-lg font-bold text-gray-800 leading-tight">
                        {resolvedConversations.find(c => c.id === selectedChat.id)?.resolvedName || "Desconhecido"}
                      </h2>
                      <p className="text-sm text-gray-500 font-medium">
                        {selectedChat.meta?.sender?.phone_number || ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resolveConversation(selectedChat.id)}
                      className="h-9 gap-2 rounded-xl text-emerald-600 border-emerald-100 hover:bg-emerald-50"
                    >
                      <Check className="h-4 w-4" />
                      <span className="text-xs font-bold">Resolver</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowContactPanel(!showContactPanel)}
                      className={`h-10 w-10 rounded-xl transition-all ${showContactPanel ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400'}`}
                    >
                      <Info className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* Área de Mensagens */}
                <ScrollArea className="flex-1 p-6 z-0" style={{ backgroundImage: 'url("https://w7.pngwing.com/pngs/1023/241/png-transparent-whatsapp-pattern-abstract-doodle.png")', backgroundSize: '400px', backgroundBlendMode: 'soft-light' }}>
                  <div className="max-w-4xl mx-auto flex flex-col justify-end min-h-full py-4 px-2">
                    {currentMessages.length === 0 ? (
                      <div className="flex items-center justify-center p-8">
                        <Loader2 className="animate-spin text-gray-400 h-8 w-8" />
                      </div>
                    ) : (
                      <>
                        {hasMoreMessages[activeConversationId as number] && (
                          <div className="flex justify-center mb-6">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => loadMoreMessages(activeConversationId as number)}
                              disabled={isFetchingHistory}
                              className="rounded-full bg-white/50 backdrop-blur-sm border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-200"
                            >
                              {isFetchingHistory ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-2" />
                              ) : (
                                <RefreshCw className="h-3 w-3 mr-2" />
                              )}
                              Carregar mensagens anteriores
                            </Button>
                          </div>
                        )}
                        {currentMessages.map((msg: any, i: number) => (
                          <MessageBubble
                            key={msg.id || i}
                            item={msg}
                            isMe={msg.message_type === 1}
                          />
                        ))}
                      </>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Input Area - Adjusted for absolute bottom reach */}
                <div className="p-4 bg-white border-t border-gray-100 mt-auto pb-4 md:pb-6 shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
                  <div className="max-w-4xl mx-auto flex items-end gap-2">
                    <div className="flex-1">
                      <Textarea
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder="Digite uma mensagem..."
                        className="min-h-[44px] max-h-32 resize-none bg-gray-50/50 border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-2xl shadow-sm text-[15px] py-3 px-4 leading-relaxed"
                        disabled={isSending}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                      />
                    </div>
                    <Button
                      onClick={handleSend}
                      disabled={isSending || !messageInput.trim()}
                      className="h-11 w-11 rounded-full flex items-center justify-center shrink-0 bg-indigo-500 hover:bg-indigo-600 text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isSending ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Contact Panel (Lado Direito do Chat) */}
              {showContactPanel && crmId && (
                <div className="w-[340px] border-l border-gray-200 bg-white h-full flex flex-col animate-in slide-in-from-right duration-300">
                  <ContactPanel
                    chat={selectedChat}
                    resolveName={(jid) => resolveName(jid)}
                    phone={(selectedChat as any).meta?.sender?.phone_number}
                    deal={getDealByChatId(crmId)}
                    assignee={getChatAssignee(crmId)}
                    agents={agents}
                    onAssign={(agentId) => crmId && assignChat(crmId, agentId === 'none' ? '' : agentId)}
                    onStageChange={(dealId, stageId) => updateDealStage(dealId, stageId)}
                    onAddDeal={(deal) => addDeal(deal)}
                    onSaveNote={(n) => crmId && saveContactNote(crmId, n)}
                    onSaveTags={(t) => crmId && saveContactTags(crmId, t)}
                    notes={contactNotes[crmId]}
                    tags={contactTags[crmId] || []}
                    stages={stages}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="h-24 w-24 bg-white/50 backdrop-blur-xl rounded-full flex items-center justify-center mb-6 shadow-xl border border-white/60">
                <MessageSquare className="h-10 w-10 text-indigo-400 opacity-80" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Selecione uma conversa</h2>
              <p className="text-gray-500 max-w-sm leading-relaxed">
                As conversas do Chatwoot aparecem aqui. <br /> Use o botão de sincronização acima para puxar o histórico do WhatsApp.
              </p>
            </div>
          )}
        </div>
      </div>
    </CRMLayout >
  );
}

// Re-using the same ContactPanel component structure from previous edits
function ContactPanel({ chat, resolveName, phone, deal, assignee, agents, onAssign, onStageChange, onAddDeal, onSaveNote, onSaveTags, notes, tags, stages }: any) {
  const [activeTab, setActiveTab] = useState<'info' | 'notes' | 'deal'>('info');
  const [note, setNote] = useState("");

  const jid = chat.meta?.sender?.identifier || chat.meta?.sender?.phone_number;

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="p-4 border-b border-gray-100 text-center bg-gradient-to-b from-indigo-50/50 to-white">
        <Avatar className="h-16 w-16 mx-auto mb-3 ring-4 ring-white shadow-md">
          <AvatarImage src={chat.meta?.sender?.thumbnail} />
          <AvatarFallback className="text-xl font-bold bg-indigo-500 text-white">
            {resolveName(jid).substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h3 className="font-bold text-gray-900 truncate px-2">{resolveName(jid)}</h3>
        <p className="text-xs text-gray-500 font-medium mt-1">{phone || jid}</p>
      </div>

      <div className="flex p-1 bg-gray-50 m-3 rounded-xl border border-gray-100 shadow-inner">
        {(['info', 'notes', 'deal'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            {tab === 'info' ? 'Dados' : tab === 'notes' ? 'Notas' : 'Negócio'}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1 px-4 pb-4">
        {activeTab === 'info' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Responsável</label>
              <select
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                value={assignee?.id || 'none'}
                onChange={(e) => onAssign(e.target.value)}
              >
                <option value="none">Nenhum agente</option>
                {agents.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Tags</label>
              <div className="flex flex-wrap gap-1.5 min-h-[40px] p-2 bg-gray-50 rounded-xl border border-gray-100">
                {tags.map((t: string) => (
                  <span key={t} className="px-2 py-0.5 bg-white text-[10px] font-bold text-indigo-600 rounded-md border border-indigo-100 shadow-sm">#{t}</span>
                ))}
                <button onClick={() => {
                  const next = prompt("Nova tag:");
                  if (next) onSaveTags([...tags, next.replace('#', '')]);
                }} className="h-5 px-1.5 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 transition-colors">
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
              <p className="text-[11px] font-medium text-indigo-800 leading-relaxed italic">
                {notes || 'Sem notas para este contato.'}
              </p>
            </div>
            <Textarea
              placeholder="Adicionar nota interna..."
              className="text-xs min-h-[100px] rounded-xl border-gray-100 bg-gray-50/30 font-medium"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
            <Button size="sm" className="w-full rounded-xl bg-indigo-500 hover:bg-indigo-600 text-[11px] font-bold py-5" onClick={() => { onSaveNote(note); setNote(""); }}>Salvar Nota</Button>
          </div>
        )}

        {activeTab === 'deal' && (
          <div className="animate-in fade-in duration-300">
            {deal ? (
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
                  <p className="text-[10px] font-bold uppercase opacity-70 mb-1">Negócio Ativo</p>
                  <h4 className="font-bold text-lg mb-0.5">{deal.title}</h4>
                  <p className="text-xl font-black mb-3">R$ {deal.value?.toLocaleString()}</p>
                  <div className="flex items-center gap-1.5 opacity-90">
                    <Briefcase className="h-3 w-3" />
                    <span className="text-[10px] font-bold">ETAPA: {stages.find((s: any) => s.id === deal.stageId)?.name.toUpperCase()}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Mover Estágio</label>
                  <div className="grid grid-cols-1 gap-1">
                    {stages.map((s: any) => (
                      <button
                        key={s.id}
                        onClick={() => onStageChange(deal.id, s.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${deal.stageId === s.id ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm ring-2 ring-indigo-500/10' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-white hover:border-indigo-200'}`}
                      >
                        <div className="flex items-center justify-between">
                          {s.name}
                          {deal.stageId === s.id && <Check className="h-3 w-3" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-50/50 rounded-3xl border border-dashed border-gray-200 my-4">
                <div className="h-12 w-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
                  <Briefcase className="h-6 w-6 text-gray-300" />
                </div>
                <h4 className="text-sm font-bold text-gray-700 mb-1">Sem negócio ativo</h4>
                <p className="text-[11px] text-gray-400 mb-5">Adicione este contato ao seu funil de vendas</p>
                <Button className="w-full bg-indigo-500 hover:bg-indigo-600 rounded-xl font-bold py-5 text-xs shadow-lg shadow-indigo-200" onClick={() => onAddDeal({
                  title: `Novo negócio - ${resolveName(jid)}`,
                  contactId: jid,
                  value: 0,
                  stageId: stages[0]?.id
                })}>Criar Negócio</Button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
