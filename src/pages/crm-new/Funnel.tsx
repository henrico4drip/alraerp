import { useState, useEffect, useRef, useMemo } from "react";
import CRMLayout from "@/components/CRMLayout";
import { useEvolution } from "@/contexts/EvolutionContext";
import { useCrm } from "@/contexts/CrmContext";
import {
  Plus, Loader2, X, Save, Pencil, Trash2, MessageCircle, Filter as FilterIcon,
  DollarSign, Users, Clock, Tag, ArrowUpDown, Eye, Search, GripVertical,
  TrendingUp, Phone, Star, MoreHorizontal, ChevronDown, User
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { isSameJid, formatPhoneNumber } from "@/lib/evolution";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Task = {
  id: string;
  title: string;
  company: string;
  value: string;
  tags: string[];
  chatId?: string;
  stageId?: string;
  assignedTo?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  dealValue?: number;
  createdAt?: number;
  lastActivity?: number;
};

// --- Enhanced Edit Modal ---
const EditTaskModal = ({
  isOpen, onClose, task, onSave, stages, agents
}: {
  isOpen: boolean; onClose: () => void; task: Task | null;
  onSave: (taskId: string, updates: Partial<Task>) => void;
  stages: any[]; agents: any[];
}) => {
  const [formData, setFormData] = useState<Partial<Task>>({});

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        value: task.value,
        company: task.company,
        priority: task.priority || 'medium',
        assignedTo: task.assignedTo || '',
      });
    }
  }, [task]);

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg p-6 rounded-2xl shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 border border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Editar Negócio</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-500 uppercase">Título</Label>
            <Input
              value={formData.title || ""}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase">Empresa / Cliente</Label>
              <Input
                value={formData.company || ""}
                onChange={e => setFormData({ ...formData, company: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase">Valor Estimado</Label>
              <Input
                value={formData.value || ""}
                onChange={e => setFormData({ ...formData, value: e.target.value })}
                className="rounded-xl"
                placeholder="R$ 0,00"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase">Prioridade</Label>
              <Select value={formData.priority || 'medium'} onValueChange={v => setFormData({ ...formData, priority: v as Task['priority'] })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">🟢 Baixa</SelectItem>
                  <SelectItem value="medium">🟡 Média</SelectItem>
                  <SelectItem value="high">🟠 Alta</SelectItem>
                  <SelectItem value="urgent">🔴 Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase">Responsável</Label>
              <Select value={formData.assignedTo || ''} onValueChange={v => setFormData({ ...formData, assignedTo: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {agents.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancelar</Button>
          <Button onClick={() => { onSave(task.id, formData); onClose(); }} className="rounded-xl">
            <Save className="h-4 w-4 mr-2" /> Salvar
          </Button>
        </div>
      </div>
    </div>
  );
};

// --- New Deal Modal ---
const NewDealModal = ({
  isOpen, onClose, onSave, stages, agents
}: {
  isOpen: boolean; onClose: () => void;
  onSave: (deal: any) => void;
  stages: any[]; agents: any[];
}) => {
  const [formData, setFormData] = useState({
    title: '', company: '', value: 'R$ 0,00',
    stageId: stages[0]?.id || 'leads',
    priority: 'medium', assignedTo: '',
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg p-6 rounded-2xl shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 border border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Novo Negócio</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-500 uppercase">Nome do Cliente / Negócio</Label>
            <Input
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="rounded-xl" placeholder="Ex: João - Proposta Website"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase">Empresa</Label>
              <Input value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase">Valor</Label>
              <Input value={formData.value} onChange={e => setFormData({ ...formData, value: e.target.value })} className="rounded-xl" placeholder="R$ 0,00" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase">Etapa</Label>
              <Select value={formData.stageId} onValueChange={v => setFormData({ ...formData, stageId: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase">Prioridade</Label>
              <Select value={formData.priority} onValueChange={v => setFormData({ ...formData, priority: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">🟢 Baixa</SelectItem>
                  <SelectItem value="medium">🟡 Média</SelectItem>
                  <SelectItem value="high">🟠 Alta</SelectItem>
                  <SelectItem value="urgent">🔴 Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase">Responsável</Label>
              <Select value={formData.assignedTo} onValueChange={v => setFormData({ ...formData, assignedTo: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancelar</Button>
          <Button
            onClick={() => {
              if (!formData.title.trim()) { toast.error("Nome obrigatório"); return; }
              onSave({
                id: "manual-" + Date.now(),
                chatId: "manual-" + Date.now(),
                ...formData,
                tags: [],
                createdAt: Date.now()
              });
              onClose();
              toast.success("Negócio criado!");
            }}
            className="rounded-xl"
          >
            <Plus className="h-4 w-4 mr-2" /> Criar
          </Button>
        </div>
      </div>
    </div>
  );
};

// Priority Badge Component
const PriorityBadge = ({ priority }: { priority?: string }) => {
  if (!priority || priority === 'medium') return null;
  const config: Record<string, { bg: string, text: string, label: string }> = {
    low: { bg: 'bg-green-50', text: 'text-green-600', label: 'Baixa' },
    high: { bg: 'bg-orange-50', text: 'text-orange-600', label: 'Alta' },
    urgent: { bg: 'bg-red-50', text: 'text-red-600', label: '⚡ Urgente' },
  };
  const c = config[priority];
  if (!c) return null;
  return <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${c.bg} ${c.text} uppercase`}>{c.label}</span>;
};

export default function Funnel() {
  const { api, isConnected, resolveName, setDiscoveredNames } = useEvolution();
  const {
    stages, deals, addDeal, updateDeal, removeDeal, addStage, removeStage,
    setDeals, contactTags, hiddenContacts, agents, assignments, getChatAssignee,
    unreadCounts
  } = useCrm();
  const navigate = useNavigate();

  const [draggedTask, setDraggedTask] = useState<{ taskId: string; sourceColId: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isNewDealOpen, setIsNewDealOpen] = useState(false);
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [view, setView] = useState<'kanban' | 'list'>('kanban');

  const handleEditClick = (task: Task) => {
    setEditingTask(task);
    setIsEditOpen(true);
  };

  const handleSaveTask = (taskId: string, updates: Partial<Task>) => {
    updateDeal(taskId, updates);
    toast.success("Negócio atualizado!");
  };

  const handleAddStage = () => {
    if (!newStageName.trim()) { toast.error("Nome obrigatório"); return; }
    const colors = ["bg-pink-500", "bg-indigo-500", "bg-teal-500", "bg-red-500", "bg-cyan-500", "bg-violet-500"];
    addStage({
      id: Math.random().toString(36).substr(2, 9),
      title: newStageName.trim(),
      color: colors[Math.floor(Math.random() * colors.length)]
    });
    setNewStageName("");
    setIsAddingStage(false);
    toast.success(`Etapa "${newStageName}" criada!`);
  };

  const handleRemoveDeal = (dealId: string, dealTitle: string) => {
    if (confirm(`Excluir "${dealTitle}"?`)) {
      removeDeal(dealId);
      toast.success("Negócio excluído");
    }
  };

  const handleRemoveStage = (stageId: string, stageTitle: string) => {
    const dealsInStage = deals.filter(d => d.stageId === stageId);
    if (dealsInStage.length > 0) {
      if (!confirm(`"${stageTitle}" contém ${dealsInStage.length} negócio(s). Mover para o primeiro estágio?`)) return;
    }
    removeStage(stageId);
    toast.success(`Estágio "${stageTitle}" removido`);
  };

  // Auto-populate from WhatsApp chats
  useEffect(() => {
    const fetchLeads = async () => {
      if (!api || !isConnected) return;
      if (deals.length > 0) return;

      setLoading(true);
      try {
        const chats = await api.fetchChats();
        const leadStageId = stages.find(s => s.id === "leads")?.id || stages[0]?.id;
        const newDiscovered: Record<string, string> = {};

        chats
          .filter(chat => !hiddenContacts.some(hc => isSameJid(hc, chat.id || chat.remoteJid)))
          .slice(0, 50)
          .forEach((chat: any) => {
            const chatId = chat.id || chat.remoteJid;
            const name = chat.name || chat.pushName;

            // Prevent duplicate deals in state
            if (deals.some(d => d.id === chatId)) return;

            if (chatId && name && name !== chatId.split('@')[0]) {
              newDiscovered[chatId] = name;
            }

            addDeal({
              id: chatId,
              chatId: chatId,
              title: name || "Novo Negócio",
              company: "WhatsApp",
              value: "R$ 0,00",
              stageId: leadStageId,
              tags: ["Novo"],
              createdAt: Date.now()
            });
          });

        if (Object.keys(newDiscovered).length > 0) {
          setDiscoveredNames(prev => ({ ...prev, ...newDiscovered }));
        }
      } catch (error: any) {
        toast.error("Erro ao carregar leads: " + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, [api, isConnected]);

  // Board scroll with drag
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingBoard, setIsDraggingBoard] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const onMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[draggable="true"]') || target.closest('button') || target.closest('input') || target.closest('.group')) return;
    if (!scrollContainerRef.current) return;
    setIsDraggingBoard(true);
    setStartX(e.pageX);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const onMouseLeave = () => { if (isDraggingBoard) setIsDraggingBoard(false); };
  const onMouseUp = () => { setIsDraggingBoard(false); };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingBoard || !scrollContainerRef.current) return;
    e.preventDefault();
    scrollContainerRef.current.scrollLeft = scrollLeft - (e.pageX - startX) * 2;
  };

  const onDragStart = (e: React.DragEvent, taskId: string, sourceColId: string) => {
    setDraggedTask({ taskId, sourceColId });
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const onDrop = (e: React.DragEvent, targetColId: string, targetDealId?: string) => {
    e.preventDefault();
    if (!draggedTask) return;
    const { taskId, sourceColId } = draggedTask;

    setDeals(prevDeals => {
      const newDeals = [...prevDeals];
      const draggedIndex = newDeals.findIndex(d => d.id === taskId);
      if (draggedIndex === -1) return prevDeals;

      const [movedDeal] = newDeals.splice(draggedIndex, 1);
      movedDeal.stageId = targetColId;

      if (targetDealId) {
        const targetIndex = newDeals.findIndex(d => d.id === targetDealId);
        if (targetIndex !== -1) newDeals.splice(targetIndex, 0, movedDeal);
        else newDeals.push(movedDeal);
      } else {
        newDeals.push(movedDeal);
      }
      return newDeals;
    });

    if (sourceColId !== targetColId) toast.success("Negócio movido!");
    setDraggedTask(null);
  };

  // Filtered deals
  const filteredDeals = useMemo(() => {
    let result = deals;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d =>
        d.title.toLowerCase().includes(q) ||
        d.company.toLowerCase().includes(q) ||
        (d.chatId && d.chatId.includes(q))
      );
    }

    if (filterAgent !== 'all') {
      result = result.filter(d => d.assignedTo === filterAgent || assignments[d.chatId] === filterAgent);
    }

    if (filterPriority !== 'all') {
      result = result.filter(d => d.priority === filterPriority);
    }

    return result;
  }, [deals, searchQuery, filterAgent, filterPriority, assignments]);

  // Stats
  const totalDeals = deals.length;
  const totalValue = deals.reduce((sum, d) => {
    const numVal = d.dealValue || parseFloat((d.value || "0").replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
    return sum + numVal;
  }, 0);

  return (
    <CRMLayout>
      <div className="flex flex-col h-[calc(100vh-2rem)] m-3 bg-white rounded-2xl shadow-sm border border-gray-200/60 overflow-hidden">
        <EditTaskModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          task={editingTask}
          onSave={handleSaveTask}
          stages={stages}
          agents={agents}
        />
        <NewDealModal
          isOpen={isNewDealOpen}
          onClose={() => setIsNewDealOpen(false)}
          onSave={(deal) => addDeal(deal)}
          stages={stages}
          agents={agents}
        />

        {/* Header */}
        <div className="border-b border-gray-100 bg-white shadow-sm z-20">
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight">Funil de Vendas</h1>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-white/80 text-xs flex items-center gap-1.5 bg-white/15 px-2.5 py-1 rounded-full">
                    <Users className="h-3 w-3" /> {totalDeals} negócios
                  </span>
                  <span className="text-white text-xs font-semibold flex items-center gap-1.5 bg-emerald-500/40 px-2.5 py-1 rounded-full">
                    <DollarSign className="h-3 w-3" /> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
                  </span>
                </div>
              </div>
              <Button onClick={() => setIsNewDealOpen(true)} className="rounded-xl shadow-lg bg-white text-orange-600 hover:bg-white/90 font-semibold">
                <Plus className="mr-2 h-4 w-4" /> Novo Negócio
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 p-3">
            <div className="relative flex-1 max-w-xs">
              <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
                <Search className="h-3.5 w-3.5 text-gray-400" />
              </div>
              <Input
                placeholder="Buscar negócio..."
                className="pr-10 h-9 bg-gray-50 border-0 rounded-xl text-xs focus:ring-2 focus:ring-orange-500/20"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterAgent} onValueChange={setFilterAgent}>
              <SelectTrigger className="w-[140px] h-9 text-xs rounded-xl bg-gray-50 border-0">
                <User className="h-3 w-3 mr-1 text-gray-400" />
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[130px] h-9 text-xs rounded-xl bg-gray-50 border-0">
                <Star className="h-3 w-3 mr-1 text-gray-400" />
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="low">🟢 Baixa</SelectItem>
                <SelectItem value="medium">🟡 Média</SelectItem>
                <SelectItem value="high">🟠 Alta</SelectItem>
                <SelectItem value="urgent">🔴 Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Kanban scrollbar styles */}
        <style>{`
          .kanban-scroll::-webkit-scrollbar {
            height: 8px !important;
            width: 6px !important;
            display: block !important;
          }
          .kanban-scroll::-webkit-scrollbar-track {
            background: transparent !important;
          }
          .kanban-scroll::-webkit-scrollbar-thumb {
            background: #cbd5e1 !important;
            border-radius: 10px;
          }
          .kanban-scroll::-webkit-scrollbar-thumb:hover {
            background: #94a3b8 !important;
          }
        `}</style>

        {/* Board */}
        <div
          ref={scrollContainerRef}
          className={`flex-1 overflow-x-auto overflow-y-hidden p-6 bg-gray-50/50 kanban-scroll ${isDraggingBoard ? 'cursor-grabbing' : 'cursor-default'}`}
          onMouseDown={onMouseDown}
          onMouseLeave={onMouseLeave}
          onMouseUp={onMouseUp}
          onMouseMove={onMouseMove}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm font-medium">Sincronizando leads...</p>
            </div>
          ) : (
            <div className="flex flex-nowrap gap-6 h-full min-h-0">
              {stages.map((stage) => {
                const stageDeals = filteredDeals.filter(d =>
                  d.stageId === stage.id &&
                  !hiddenContacts.some(hc => isSameJid(hc, d.chatId))
                );
                const stageValue = stageDeals.reduce((sum, d) => {
                  const numVal = d.dealValue || parseFloat((d.value || "0").replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
                  return sum + numVal;
                }, 0);

                return (
                  <div
                    key={stage.id}
                    className="w-[320px] min-w-[320px] flex flex-col bg-gray-100/60 rounded-2xl border border-gray-200/40 h-full overflow-hidden shrink-0 shadow-sm"
                    onDragOver={onDragOver}
                    onDrop={(e) => onDrop(e, stage.id)}
                  >
                    {/* Column Header */}
                    <div className="p-4 border-b border-gray-200/30 flex flex-col gap-1.5 bg-white/50 rounded-t-2xl backdrop-blur-sm shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`h-2.5 w-2.5 rounded-full ${stage.color} shadow-sm`} />
                          <span className="font-bold text-[11px] text-gray-800 uppercase tracking-tight">{stage.title}</span>
                          <span className="text-[10px] font-bold text-gray-500 bg-gray-200/60 px-2 py-0.5 rounded-full">
                            {stageDeals.length}
                          </span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" onClick={() => handleRemoveStage(stage.id, stage.title)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      {stageValue > 0 && (
                        <span className="text-[10px] font-bold text-emerald-600">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stageValue)}
                        </span>
                      )}
                    </div>

                    {/* Cards - Replaced ScrollArea with standard div for better visibility control */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3 kanban-scroll min-h-0">
                      {stageDeals.map((deal) => {
                        const contactName = resolveName(deal.chatId, deal.title);
                        const assignee = getChatAssignee(deal.chatId) || agents.find(a => a.id === deal.assignedTo);
                        const unread = unreadCounts[deal.chatId] || 0;
                        const phone = formatPhoneNumber(deal.chatId);

                        return (
                          <div
                            key={deal.id}
                            draggable
                            onDragStart={(e) => onDragStart(e, deal.id, stage.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => { e.stopPropagation(); onDrop(e, stage.id, deal.id); }}
                            className="group bg-white p-4 rounded-xl border border-gray-200/60 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-grab active:cursor-grabbing relative animate-in fade-in slide-in-from-bottom-2 duration-300"
                          >
                            {/* Priority indicator */}
                            {deal.priority === 'urgent' && (
                              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-orange-500 rounded-t-xl" />
                            )}
                            {deal.priority === 'high' && (
                              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 to-yellow-400 rounded-t-xl" />
                            )}

                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Avatar className="h-8 w-8 shrink-0 ring-2 ring-white shadow-sm">
                                  <AvatarFallback className="text-[10px] font-bold bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                                    {contactName.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <h4 className="text-[12px] font-bold text-gray-900 leading-tight truncate">{contactName}</h4>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] text-gray-400 font-medium">{phone}</span>
                                    {deal.company !== 'WhatsApp' && (
                                      <>
                                        <span className="text-gray-300">•</span>
                                        <span className="text-[10px] text-gray-400 truncate">{deal.company}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {unread > 0 && (
                                <span className="h-5 min-w-[1.25rem] px-1 rounded-full bg-green-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm">
                                  {unread}
                                </span>
                              )}
                            </div>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              <PriorityBadge priority={deal.priority} />
                              {(contactTags[deal.chatId] || []).slice(0, 3).map((tag, idx) => (
                                <span key={idx} className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100/50 font-bold">#{tag}</span>
                              ))}
                              {(contactTags[deal.chatId] || []).length > 3 && (
                                <span className="text-[9px] text-gray-400 py-0.5">+{(contactTags[deal.chatId] || []).length - 3}</span>
                              )}
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] font-extrabold text-emerald-600">{deal.value}</span>
                                {assignee && (
                                  <div className="flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded-full border border-gray-100">
                                    <div className="h-3.5 w-3.5 rounded-full bg-blue-100 flex items-center justify-center text-[7px] font-bold text-blue-600">
                                      {assignee.name?.charAt(0)}
                                    </div>
                                    <span className="text-[9px] text-gray-500 font-medium">{assignee.name?.split(' ')[0]}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-0 sm:translate-x-2">
                                <button onClick={() => navigate(`/crm/inbox?contactId=${deal.chatId}`)} className="h-7 w-7 flex items-center justify-center hover:bg-blue-50 rounded-lg text-blue-500 transition-colors bg-white shadow-sm border border-gray-100" title="Chat">
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => handleEditClick(deal as any)} className="h-7 w-7 flex items-center justify-center hover:bg-gray-100 rounded-lg text-gray-500 transition-colors bg-white shadow-sm border border-gray-100" title="Editar">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => handleRemoveDeal(deal.id, deal.title)} className="h-7 w-7 flex items-center justify-center hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors bg-white shadow-sm border border-gray-100" title="Excluir">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {stageDeals.length === 0 && (
                        <div className="h-24 border-2 border-dashed border-gray-200/50 rounded-2xl flex items-center justify-center text-gray-300 text-[11px] font-medium bg-gray-50/50">
                          Arraste negócios aqui
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add Stage */}
              <div className="h-full">
                {isAddingStage ? (
                  <div className="w-[320px] p-4 bg-white rounded-2xl border border-gray-200/50 shadow-lg space-y-3 h-fit shrink-0">
                    <h4 className="text-xs font-bold text-gray-900 uppercase">Nova Etapa</h4>
                    <Input
                      placeholder="Nome da etapa..."
                      value={newStageName}
                      onChange={e => setNewStageName(e.target.value)}
                      className="h-9 text-sm rounded-xl focus:ring-2 focus:ring-blue-500/20"
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleAddStage()}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 h-9 rounded-xl shadow-md" onClick={handleAddStage}>Adicionar</Button>
                      <Button size="sm" variant="ghost" className="h-9 w-9 p-0 rounded-xl" onClick={() => setIsAddingStage(false)}><X className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingStage(true)}
                    className="w-[320px] h-14 border-2 border-dashed border-gray-300/50 rounded-2xl flex items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 transition-all text-xs font-bold shrink-0 shadow-sm bg-white/50 group"
                  >
                    <Plus className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" /> Nova Etapa
                  </button>
                )}
              </div>

              {/* Extra spacing for horizontal scroll */}
              <div className="w-[100px] shrink-0" />
            </div>
          )}
        </div>
      </div>
    </CRMLayout>
  );
}
