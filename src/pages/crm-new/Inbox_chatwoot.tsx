import { useState, useEffect, useRef, memo, useMemo } from "react";
import CRMLayout from "@/components/CRMLayout";
import { useChatwoot } from "@/contexts/ChatwootContext";
import { useCrm } from "@/contexts/CrmContext";
import { useEvolution } from "@/contexts/EvolutionContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Send, Check, Paperclip, FileIcon, Image as ImageIcon, Video, Music, Download } from "lucide-react";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { CHATWOOT_API_URL } from "@/lib/chatwoot";

const getAttachmentUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  const baseUrl = CHATWOOT_API_URL.includes(":3000") ? CHATWOOT_API_URL : `${CHATWOOT_API_URL}:3000`;
  return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
};

// --- Message Bubble ---
const MessageBubble = memo(({ item, isMe }: { item: any, isMe: boolean }) => {
  // Chatwoot message_type: 0 (incoming), 1 (outgoing), 2 (activity/private), 3 (template)
  if (item.message_type === 2) {
    return (
      <div className="flex justify-center my-3">
        <div className="bg-amber-50/80 backdrop-blur border border-amber-200/50 text-amber-800 px-4 py-2 rounded-lg max-w-lg shadow-sm">
          <p className="text-[11px] italic font-medium">"{item.content}"</p>
        </div>
      </div>
    );
  }

  const attachments = item.attachments || [];

  return (
    <div className={`flex flex-col mb-2 px-6 ${isMe ? 'items-end' : 'items-start'}`}>
      <div className={`group relative max-w-[85%] md:max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
        <div className={`relative px-3 py-2 text-[15px] shadow-sm leading-[1.4] transition-all hover:shadow-md ${isMe
          ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-2xl rounded-tr-sm border border-indigo-400/20'
          : 'bg-white text-gray-800 rounded-2xl rounded-tl-sm border border-gray-100'
          }`}>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="flex flex-col gap-2 mb-2 min-w-[200px]">
              {attachments.map((att: any) => {
                const isImage = att.file_type === 'image' || att.data_url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                const isVideo = att.file_type === 'video' || att.data_url?.match(/\.(mp4|webm|mov)$/i);
                const isAudio = att.file_type === 'audio' || att.data_url?.match(/\.(mp3|ogg|wav|m4a)$/i);

                if (isImage) {
                  return (
                    <a key={att.id} href={getAttachmentUrl(att.data_url)} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-black/5">
                      <img src={getAttachmentUrl(att.data_url)} alt="Attachment" className="max-w-full h-auto object-cover max-h-64" />
                    </a>
                  );
                }
                if (isVideo) {
                  return (
                    <video key={att.id} controls className="max-w-full rounded-lg border border-black/5 max-h-64">
                      <source src={getAttachmentUrl(att.data_url)} />
                    </video>
                  );
                }
                if (isAudio) {
                  return (
                    <audio key={att.id} controls className="max-w-full h-10">
                      <source src={getAttachmentUrl(att.data_url)} />
                    </audio>
                  );
                }
                return (
                  <a
                    key={att.id}
                    href={getAttachmentUrl(att.data_url)}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isMe ? 'bg-white/10 border-white/20 hover:bg-white/20' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                  >
                    <div className={`h-10 w-10 flex items-center justify-center rounded-lg ${isMe ? 'bg-white/20' : 'bg-indigo-100/50 text-indigo-600'}`}>
                      <FileIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold truncate ${isMe ? 'text-white' : 'text-gray-900'}`}>
                        {att.data_url?.split('/').pop()?.split('?')[0] || 'Arquivo'}
                      </p>
                      <p className={`text-[10px] opacity-70 ${isMe ? 'text-white' : 'text-gray-500'}`}>
                        {att.file_size ? `${(att.file_size / 1024 / 1024).toFixed(1)} MB` : 'Clique para ver'}
                      </p>
                    </div>
                    <Download className={`h-4 w-4 shrink-0 ${isMe ? 'text-white/70' : 'text-gray-400'}`} />
                  </a>
                );
              })}
            </div>
          )}

          {item.content && (
            <div className="whitespace-pre-wrap break-words">{item.content}</div>
          )}

          <div className={`flex items-center justify-end gap-1 mt-1 -mb-1 ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
            <span className="text-[10px] leading-none mb-0.5 opacity-90">
              {item.created_at ? format(new Date(item.created_at * 1000), "HH:mm") : ''}
            </span>
            {isMe && <Check className={`h-3 w-3 text-indigo-200`} />}
          </div>
        </div>
      </div>
    </div>
  );
});

// --- Chat List Item ---
const ChatListItem = memo(({ chat, isSelected, onSelect }: {
  chat: any, isSelected: boolean, onSelect: (chat: any) => void
}) => {
  const meta = chat.meta || {};
  const sender = meta.sender || {};
  const name = (chat as any).resolvedName || "Desconhecido";
  const lastMsg = chat.messages?.[chat.messages.length - 1];
  const lastMsgContent = lastMsg?.content || (lastMsg?.attachments?.length ? "📎 Arquivo/Mídia" : "");
  const unread = chat.unread_count || 0;

  return (
    <button
      onClick={() => onSelect(chat)}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all relative group ${isSelected
        ? "bg-gradient-to-r from-indigo-50 to-blue-50/50 border-l-[3px] border-l-indigo-500"
        : "bg-white hover:bg-gray-50/80 border-l-[3px] border-l-transparent"
        }`}
    >
      <div className="relative">
        <Avatar className="h-11 w-11 shrink-0 ring-2 ring-white shadow-sm">
          <AvatarImage src={getAttachmentUrl(sender.thumbnail)} />
          <AvatarFallback className="bg-gradient-to-br from-indigo-100 to-blue-100 text-indigo-700 font-semibold text-sm">
            {name.substring(0, 2).toUpperCase()}
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
            {lastMsg ? format(new Date(lastMsg.created_at * 1000), "HH:mm") : ''}
          </span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <p className={`text-sm truncate ${unread > 0 ? "text-gray-900 font-medium" : "text-gray-500"}`}>
            {lastMsgContent}
          </p>
        </div>
      </div>
    </button>
  );
});

// --- Main Inbox Component ---
export default function Inbox() {
  const { conversations, messages, isLoading, activeConversationId, setActiveConversationId, sendMessage, sendFile } = useChatwoot();
  const { resolveName } = useEvolution();
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedChat = conversations.find(c => c.id === activeConversationId);
  // Ensure messages are sorted chronologically (oldest first, newest last at bottom)
  const currentMessages = useMemo(() => {
    if (!activeConversationId) return [];
    const msgs = messages[activeConversationId] || [];
    return [...msgs].sort((a, b) => {
      const tA = a.created_at || 0;
      const tB = b.created_at || 0;
      if (tA !== tB) return tA - tB;
      return (a.id || 0) - (b.id || 0);
    });
  }, [messages, activeConversationId]);

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

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversationId) return;

    try {
      setIsSending(true);
      await sendFile(activeConversationId, file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error("Erro ao enviar arquivo:", err);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    // Immediate scroll on new messages
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [currentMessages.length]);

  const resolvedConversations = useMemo(() => {
    return conversations.map(c => {
      const jid = c.meta?.sender?.identifier || c.meta?.sender?.phone_number || "";
      const resolvedName = resolveName(jid, c.meta?.sender?.name || c.meta?.sender?.phone_number || "Desconhecido");
      return { ...c, resolvedName };
    });
  }, [conversations, resolveName]);

  const filteredChats = useMemo(() => {
    return resolvedConversations.filter(c => {
      const name = c.resolvedName.toLowerCase();
      const phone = c.meta?.sender?.phone_number || '';
      return name.includes(searchQuery.toLowerCase()) || phone.includes(searchQuery);
    });
  }, [resolvedConversations, searchQuery]);

  return (
    <CRMLayout>
      <div className="h-[calc(100vh-64px)] overflow-hidden bg-gray-50 flex">
        {/* Lado Esquerdo - Lista de Chats */}
        <div className="w-[380px] shrink-0 border-r border-gray-200 bg-white flex flex-col h-full z-10 shadow-[2px_0_8px_-3px_rgba(0,0,0,0.05)]">
          <div className="p-4 bg-white border-b border-gray-100 shrink-0 shadow-sm relative z-10">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4">
              Inbox <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">{filteredChats.length}</span>
            </h1>
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
            ) : filteredChats.map((chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                isSelected={activeConversationId === chat.id}
                onSelect={handleSelectChat}
              />
            ))}
          </ScrollArea>
        </div>

        {/* Lado Direito - Mensagens */}
        <div className="flex-1 flex flex-col h-full bg-[#E5DDD5] relative">
          {selectedChat ? (
            <>
              {/* Header do Chat */}
              <div className="h-[68px] shrink-0 px-6 bg-white/95 backdrop-blur shadow-sm border-b border-gray-200 flex items-center justify-between z-10">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 ring-2 ring-gray-100 shadow-sm pointer-events-none">
                    <AvatarImage src={getAttachmentUrl(selectedChat.meta?.sender?.thumbnail)} />
                    <AvatarFallback className="bg-gradient-to-br from-indigo-100 to-blue-200 text-indigo-700 font-bold">
                      {(resolvedConversations.find(c => c.id === selectedChat.id)?.resolvedName || "D").substring(0, 2).toUpperCase()}
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
              </div>

              {/* Área de Mensagens */}
              <ScrollArea className="flex-1 p-6 z-0" style={{ backgroundImage: 'url("https://w7.pngwing.com/pngs/1023/241/png-transparent-whatsapp-pattern-abstract-doodle.png")', backgroundSize: '400px', backgroundBlendMode: 'soft-light' }}>
                <div className="max-w-4xl mx-auto flex flex-col justify-end min-h-full py-4">
                  {currentMessages.length === 0 && isLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="animate-spin text-gray-400 h-8 w-8" />
                    </div>
                  ) : (
                    currentMessages.map((msg, i) => (
                      <MessageBubble
                        key={msg.id || `msg-${i}`}
                        item={msg}
                        isMe={msg.message_type === 1}
                      />
                    ))
                  )}
                  <div ref={messagesEndRef} className="h-4" />
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-3 bg-white/80 backdrop-blur-xl border-t border-gray-100 shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.05)]">
                <div className="max-w-4xl mx-auto flex items-end gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleFileClick}
                    disabled={isSending}
                    className="h-11 w-11 rounded-2xl hover:bg-indigo-50 text-indigo-600 transition-all active:scale-95 shadow-sm border border-indigo-100"
                  >
                    <Paperclip className="h-5 w-5" />
                  </Button>

                  <div className="flex-1">
                    <Textarea
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder="Digite uma mensagem..."
                      className="min-h-[44px] max-h-32 resize-none bg-white border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-2xl shadow-sm text-[15px] py-3 px-4 leading-relaxed"
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
                    className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 bg-indigo-500 hover:bg-indigo-600 text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSending ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="h-24 w-24 bg-white/50 backdrop-blur-xl rounded-full flex items-center justify-center mb-6 shadow-xl border border-white/60">
                <Send className="h-10 w-10 text-indigo-400 opacity-80" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Selecione uma conversa</h2>
              <p className="text-gray-500 max-w-sm leading-relaxed">
                As mensagens são sincronizadas automaticamente com o Chatwoot.
              </p>
            </div>
          )}
        </div>
      </div>
    </CRMLayout>
  );
}
