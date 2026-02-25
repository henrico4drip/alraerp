import { useState, useEffect, useMemo } from "react";
import CRMLayout from "@/components/CRMLayout";
import { useEvolution } from "@/contexts/EvolutionContext";
import { useCrm } from "@/contexts/CrmContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Search, User, Phone, MessageCircle, Loader2, RefreshCw, Tag, ChevronRight,
  Plus, Filter, Star, Users, Download, Hash, Eye, EyeOff, UserPlus
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPhoneNumber, isSameJid } from "@/lib/evolution";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function Contacts() {
  const { api, isConnected, contacts, resolveName, customNames } = useEvolution();
  const {
    agents, assignments, getChatAssignee, contactTags, unreadCounts,
    hiddenContacts, getDealByChatId, stages
  } = useCrm();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTag, setFilterTag] = useState<string>("");
  const [filterAssigned, setFilterAssigned] = useState<string>("all");
  const [sortBy, setSortBy] = useState<'name' | 'recent' | 'unread'>('name');
  const [chats, setChats] = useState<any[]>([]);

  // Load chats for richer data
  useEffect(() => {
    const loadChats = async () => {
      if (!api || !isConnected) return;
      setLoading(true);
      try {
        const response = await api.fetchChats();
        setChats(response || []);
      } catch (e) {
        console.error('[Contacts] Error:', e);
      } finally {
        setLoading(false);
      }
    };
    loadChats();
  }, [api, isConnected]);

  // All available tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    Object.values(contactTags).forEach(tags => {
      tags.forEach(t => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }, [contactTags]);

  // Process contacts
  const processedContacts = useMemo(() => {
    const contactMap = new Map<string, any>();

    // Add from chats
    chats.forEach(chat => {
      const jid = chat.id || chat.remoteJid;
      if (!jid || jid.includes('@g.us') || jid.includes('@broadcast')) return;
      if (hiddenContacts.includes(jid)) return;

      contactMap.set(jid, {
        id: jid,
        name: resolveName(jid, chat.name || chat.pushName),
        phone: formatPhoneNumber(jid),
        lastMessage: chat.lastMessage || "",
        lastMessageTime: Number(chat.messageTimestamp || 0),
        unread: unreadCounts[jid] || 0,
        assignee: getChatAssignee(jid),
        tags: contactTags[jid] || [],
        deal: getDealByChatId(jid),
        profilePicUrl: chat.profilePicUrl,
        pushName: chat.pushName || chat.name,
      });
    });

    // Add from contacts that are not already there
    contacts.forEach(contact => {
      const jid = contact.id;
      if (!jid || contactMap.has(jid) || jid.includes('@g.us') || jid.includes('@broadcast')) return;
      if (hiddenContacts.includes(jid)) return;

      contactMap.set(jid, {
        id: jid,
        name: resolveName(jid, contact.name || contact.pushName || contact.pushname || contact.profileName),
        phone: formatPhoneNumber(jid),
        lastMessage: "",
        lastMessageTime: 0,
        unread: unreadCounts[jid] || 0,
        assignee: getChatAssignee(jid),
        tags: contactTags[jid] || [],
        deal: getDealByChatId(jid),
        profilePicUrl: contact.profilePicUrl || contact.profilePictureUrl,
        pushName: contact.pushName || contact.name,
      });
    });

    let result = Array.from(contactMap.values());

    // Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.id.includes(q)
      );
    }

    if (filterTag) {
      result = result.filter(c => c.tags.includes(filterTag));
    }

    if (filterAssigned !== 'all') {
      if (filterAssigned === 'unassigned') {
        result = result.filter(c => !c.assignee);
      } else {
        result = result.filter(c => c.assignee?.id === filterAssigned);
      }
    }

    // Sort
    if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'recent') {
      result.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
    } else if (sortBy === 'unread') {
      result.sort((a, b) => b.unread - a.unread);
    }

    return result;
  }, [chats, contacts, searchQuery, filterTag, filterAssigned, sortBy, resolveName, unreadCounts, contactTags, hiddenContacts, assignments]);

  const totalContacts = processedContacts.length;
  const totalWithUnread = processedContacts.filter(c => c.unread > 0).length;
  const totalAssigned = processedContacts.filter(c => c.assignee).length;

  return (
    <CRMLayout>
      <div className="flex flex-col h-[calc(100vh-2rem)] m-3 bg-white rounded-2xl shadow-sm border border-gray-200/60 overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-100">
          <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-500 p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight">Contatos</h1>
                <div className="flex items-center gap-4 mt-1.5">
                  <span className="text-white/80 text-xs flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full">
                    <Users className="h-3 w-3" /> {totalContacts} contatos
                  </span>
                  {totalWithUnread > 0 && (
                    <span className="text-white text-xs font-medium flex items-center gap-1.5 bg-emerald-500/40 px-2.5 py-1 rounded-full">
                      <MessageCircle className="h-3 w-3" /> {totalWithUnread} novas
                    </span>
                  )}
                  <span className="text-white/80 text-xs flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full">
                    <User className="h-3 w-3" /> {totalAssigned} atribuídos
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setLoading(true); api?.fetchChats().then(r => { setChats(r || []); setLoading(false); }).catch(() => setLoading(false)); }} className="rounded-xl text-white/70 hover:text-white hover:bg-white/10">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Search + Filters */}
          <div className="flex items-center gap-2 p-3">
            <div className="relative flex-1 max-w-sm">
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 z-10">
                <Search className="h-3.5 w-3.5 text-gray-400" />
              </div>
              <Input
                placeholder="Buscar contato..."
                className="pr-10 h-9 bg-gray-50 border-0 rounded-xl text-xs focus:ring-2 focus:ring-purple-500/20"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {allTags.length > 0 && (
              <select
                value={filterTag}
                onChange={e => setFilterTag(e.target.value)}
                className="h-9 text-xs bg-gray-50 border-0 rounded-xl px-3 text-gray-600 font-medium cursor-pointer"
              >
                <option value="">Todas Tags</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>#{tag}</option>
                ))}
              </select>
            )}

            <select
              value={filterAssigned}
              onChange={e => setFilterAssigned(e.target.value)}
              className="h-9 text-xs bg-gray-50 border-0 rounded-xl px-3 text-gray-600 font-medium cursor-pointer"
            >
              <option value="all">Todos</option>
              <option value="unassigned">Sem responsável</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            <div className="flex bg-gray-100 rounded-xl p-0.5 gap-0.5">
              {[
                { key: 'name', label: 'A-Z' },
                { key: 'recent', label: 'Recentes' },
                { key: 'unread', label: 'Não Lidos' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key as any)}
                  className={`px-2.5 py-1.5 text-[10px] font-semibold rounded-lg transition-all ${sortBy === opt.key
                    ? 'bg-white text-purple-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Tags Sidebar */}
          <div className="w-56 border-r border-gray-100 bg-gradient-to-b from-slate-50 to-white p-4 hidden md:flex flex-col">
            <div className="flex items-center gap-2 mb-4 px-2">
              <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Tag className="h-3 w-3 text-white" />
              </div>
              <h2 className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">Categorias</h2>
            </div>
            <ScrollArea className="flex-1 -mx-2 px-2">
              <div className="space-y-1">
                <button
                  onClick={() => setFilterTag("")}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-between group ${!filterTag
                    ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-200'
                    : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <div className="flex items-center gap-2">
                    <Users className={`h-3.5 w-3.5 ${!filterTag ? 'text-white' : 'text-gray-400'}`} />
                    Todos os Contatos
                  </div>
                </button>
                {allTags.map((tag, idx) => {
                  const count = Object.values(contactTags).filter(tags => tags.includes(tag)).length;
                  const tagColors = [
                    { active: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-200', dot: 'bg-violet-400', hover: 'hover:bg-violet-50', text: 'text-violet-700', countBg: 'bg-violet-100 text-violet-700' },
                    { active: 'from-rose-500 to-pink-600', shadow: 'shadow-rose-200', dot: 'bg-rose-400', hover: 'hover:bg-rose-50', text: 'text-rose-700', countBg: 'bg-rose-100 text-rose-700' },
                    { active: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-200', dot: 'bg-amber-400', hover: 'hover:bg-amber-50', text: 'text-amber-700', countBg: 'bg-amber-100 text-amber-700' },
                    { active: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-200', dot: 'bg-emerald-400', hover: 'hover:bg-emerald-50', text: 'text-emerald-700', countBg: 'bg-emerald-100 text-emerald-700' },
                    { active: 'from-cyan-500 to-blue-600', shadow: 'shadow-cyan-200', dot: 'bg-cyan-400', hover: 'hover:bg-cyan-50', text: 'text-cyan-700', countBg: 'bg-cyan-100 text-cyan-700' },
                    { active: 'from-pink-500 to-fuchsia-600', shadow: 'shadow-pink-200', dot: 'bg-pink-400', hover: 'hover:bg-pink-50', text: 'text-pink-700', countBg: 'bg-pink-100 text-pink-700' },
                    { active: 'from-orange-500 to-red-600', shadow: 'shadow-orange-200', dot: 'bg-orange-400', hover: 'hover:bg-orange-50', text: 'text-orange-700', countBg: 'bg-orange-100 text-orange-700' },
                    { active: 'from-teal-500 to-green-600', shadow: 'shadow-teal-200', dot: 'bg-teal-400', hover: 'hover:bg-teal-50', text: 'text-teal-700', countBg: 'bg-teal-100 text-teal-700' },
                  ];
                  const c = tagColors[idx % tagColors.length];
                  const isActive = filterTag === tag;
                  return (
                    <button
                      key={tag}
                      onClick={() => setFilterTag(tag)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-between group ${isActive
                        ? `bg-gradient-to-r ${c.active} text-white shadow-lg ${c.shadow}`
                        : `text-gray-600 ${c.hover}`}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-white' : c.dot}`} />
                        <span className="truncate">#{tag}</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/20 text-white' : c.countBg}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Contact List */}
          <ScrollArea className="flex-1 bg-white">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <p className="text-xs font-medium">Carregando contatos...</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {processedContacts.map(contact => {
                  const stageName = contact.deal ? stages.find(s => s.id === contact.deal.stageId)?.title : null;

                  return (
                    <div
                      key={contact.id}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50/80 transition-all group cursor-pointer"
                      onClick={() => navigate(`/crm/inbox?contactId=${contact.id}`)}
                    >
                      <div className="relative">
                        <Avatar className="h-10 w-10 ring-2 ring-white shadow-sm">
                          <AvatarImage src={contact.profilePicUrl} />
                          <AvatarFallback className={`text-[10px] font-bold ${contact.unread > 0 ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {contact.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {contact.unread > 0 && (
                          <span className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 rounded-full bg-green-500 text-[8px] font-bold text-white flex items-center justify-center shadow-sm">
                            {contact.unread}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className={`text-sm truncate ${contact.unread > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>
                            {contact.name}
                          </h3>
                          {contact.assignee && (
                            <div className="flex items-center gap-1 bg-blue-50 text-blue-600 text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0">
                              <User className="h-2.5 w-2.5" />
                              {contact.assignee.name}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-gray-500 flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5" /> {contact.phone}
                          </span>
                          {stageName && (
                            <span className="text-[9px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-medium border border-purple-100/50">
                              {stageName}
                            </span>
                          )}
                        </div>
                        {contact.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {contact.tags.slice(0, 4).map((tag: string, idx: number) => (
                              <span key={idx} className="text-[8px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100/50 font-medium">
                                #{tag}
                              </span>
                            ))}
                            {contact.tags.length > 4 && (
                              <span className="text-[8px] text-gray-400 py-0.5">+{contact.tags.length - 4}</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-xl text-blue-500 hover:bg-blue-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/crm/inbox?contactId=${contact.id}`);
                          }}
                          title="Abrir chat"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </div>

                      {contact.lastMessage && (
                        <div className="text-right shrink-0 max-w-[140px]">
                          <p className="text-[10px] text-gray-400 truncate">{contact.lastMessage}</p>
                          {contact.lastMessageTime > 0 && (
                            <p className="text-[9px] text-gray-300 mt-0.5">
                              {new Date(contact.lastMessageTime * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {processedContacts.length === 0 && !loading && (
                  <div className="py-20 text-center text-gray-400">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-medium">Nenhum contato encontrado {filterTag ? `na tag #${filterTag}` : ''}</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </CRMLayout>
  );
}
