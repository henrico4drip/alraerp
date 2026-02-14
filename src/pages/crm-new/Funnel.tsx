import { useState, useEffect, useRef } from "react";
import CRMLayout from "@/components/CRMLayout";
import { useEvolution } from "@/contexts/EvolutionContext";
import { useCrm } from "@/contexts/CrmContext";
import { Plus, Loader2, X, Save, Pencil, Trash2, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { isSameJid } from "@/lib/evolution";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Task = {
  id: string;
  title: string;
  company: string;
  value: string;
  tags: string[];
};

// Simple Modal Component
const EditTaskModal = ({
  isOpen,
  onClose,
  task,
  onSave
}: {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onSave: (taskId: string, updates: Partial<Task>) => void;
}) => {
  const [formData, setFormData] = useState<Partial<Task>>({});

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        value: task.value,
        company: task.company
      });
    }
  }, [task]);

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white border border-gray-200 w-full max-w-md p-6 rounded-xl shadow-lg space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Editar Negócio</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Título do Negócio</Label>
            <Input
              value={formData.title || ""}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Empresa / Cliente</Label>
            <Input
              value={formData.company || ""}
              onChange={e => setFormData({ ...formData, company: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Valor Estimado</Label>
            <Input
              value={formData.value || ""}
              onChange={e => setFormData({ ...formData, value: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => {
            onSave(task.id, formData);
            onClose();
          }}>
            <Save className="h-4 w-4 mr-2" /> Salvar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function Funnel() {
  const { api, isConnected, resolveName, setDiscoveredNames } = useEvolution();
  const { stages, deals, addDeal, updateDeal, removeDeal, addStage, removeStage, setDeals, contactTags, hiddenContacts } = useCrm();
  const navigate = useNavigate();
  const [draggedTask, setDraggedTask] = useState<{ taskId: string; sourceColId: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Edit State
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // New Stage State
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");

  const handleEditClick = (task: Task) => {
    setEditingTask(task);
    setIsEditOpen(true);
  };

  const handleSaveTask = (taskId: string, updates: Partial<Task>) => {
    updateDeal(taskId, updates);
    toast.success("Negócio atualizado com sucesso!");
  };

  const handleAddStage = () => {
    if (!newStageName.trim()) {
      toast.error("Digite um nome para o estágio");
      return;
    }

    const colors = ["bg-pink-500", "bg-indigo-500", "bg-teal-500", "bg-red-500", "bg-cyan-500"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    addStage({
      id: Math.random().toString(36).substr(2, 9),
      title: newStageName.trim(),
      color: randomColor
    });

    setNewStageName("");
    setIsAddingStage(false);
    toast.success(`Estágio "${newStageName}" criado!`);
  };

  const handleRemoveDeal = (dealId: string, dealTitle: string) => {
    if (confirm(`Tem certeza que deseja excluir "${dealTitle}"?`)) {
      removeDeal(dealId);
      toast.success("Negócio excluído");
    }
  };

  const handleRemoveStage = (stageId: string, stageTitle: string) => {
    const dealsInStage = deals.filter(d => d.stageId === stageId);
    if (dealsInStage.length > 0) {
      if (!confirm(`O estágio "${stageTitle}" contém ${dealsInStage.length} negócio(s). Os negócios serão movidos para o primeiro estágio. Continuar?`)) {
        return;
      }
    }
    removeStage(stageId);
    toast.success(`Estágio "${stageTitle}" removido`);
  };

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

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingBoard, setIsDraggingBoard] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Drag to Scroll Logic
  const onMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't drag board if clicking on a task card (which has .group class) or button/input
    if (target.closest('[draggable="true"]') || target.closest('button') || target.closest('input') || target.closest('.group')) return;

    if (!scrollContainerRef.current) return;
    setIsDraggingBoard(true);
    setStartX(e.pageX);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const onMouseLeave = () => {
    if (isDraggingBoard) setIsDraggingBoard(false);
  };

  const onMouseUp = () => {
    setIsDraggingBoard(false);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingBoard || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX;
    const walk = (x - startX) * 2;
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  const onDragStart = (e: React.DragEvent, taskId: string, sourceColId: string) => {
    setDraggedTask({ taskId, sourceColId });
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

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
        if (targetIndex !== -1) {
          newDeals.splice(targetIndex, 0, movedDeal);
        } else {
          newDeals.push(movedDeal);
        }
      } else {
        newDeals.push(movedDeal);
      }
      return newDeals;
    });

    if (sourceColId !== targetColId) {
      toast.success("Negócio movido!");
    }
    setDraggedTask(null);
  };

  return (
    <CRMLayout>
      <div className="flex flex-col h-[calc(100vh-2rem)] m-4 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden select-none">
        <EditTaskModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          task={editingTask}
          onSave={handleSaveTask}
        />
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Funil de Vendas</h1>
            <p className="text-sm text-gray-500">Acompanhe seus leads e oportunidades.</p>
          </div>
          <Button onClick={() => {
            const id = prompt("Nome do Cliente:");
            if (id) addDeal({
              id: "manual-" + Date.now(),
              chatId: "manual-" + Date.now(),
              title: id,
              company: "Manual",
              value: "R$ 0,00",
              stageId: stages[0].id,
              tags: [],
              createdAt: Date.now()
            })
          }}>
            <Plus className="mr-2 h-4 w-4" /> Novo Negócio
          </Button>
        </div>

        <style>{`
          .custom-scrollbar-h::-webkit-scrollbar {
            height: 14px !important;
            display: block !important;
          }
          .custom-scrollbar-h::-webkit-scrollbar-track {
            background: #f8fafc !important;
            border-radius: 10px;
            border: 1px solid #e2e8f0;
          }
          .custom-scrollbar-h::-webkit-scrollbar-thumb {
            background: #94a3b8 !important;
            border-radius: 10px;
            border: 3px solid #f8fafc;
          }
          .custom-scrollbar-h::-webkit-scrollbar-thumb:hover {
            background: #64748b !important;
          }
        `}</style>
        <div
          ref={scrollContainerRef}
          className={`flex-1 w-full overflow-x-scroll p-6 bg-gray-50/50 custom-scrollbar-h ${isDraggingBoard ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={onMouseDown}
          onMouseLeave={onMouseLeave}
          onMouseUp={onMouseUp}
          onMouseMove={onMouseMove}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm font-medium">Sincronizando Leads...</p>
            </div>
          ) : (
            <div className="inline-flex flex-nowrap gap-6 h-full min-w-full pr-40">
              {stages.map((stage) => {
                const stageDeals = deals.filter(d =>
                  d.stageId === stage.id &&
                  !hiddenContacts.some(hc => isSameJid(hc, d.chatId))
                );
                return (
                  <div
                    key={stage.id}
                    className="w-80 shrink-0 flex flex-col bg-gray-100/50 rounded-xl border border-gray-200 h-full overflow-hidden"
                    onDragOver={onDragOver}
                    onDrop={(e) => onDrop(e, stage.id)}
                  >
                    <div className="p-3 border-b border-gray-200/60 flex items-center justify-between bg-white rounded-t-xl">
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
                        <span className="font-semibold text-sm text-gray-700">{stage.title}</span>
                        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                          {stageDeals.length}
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-500 hover:bg-red-50" onClick={() => handleRemoveStage(stage.id, stage.title)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>

                    <ScrollArea className="flex-1 p-2">
                      <div className="space-y-2.5">
                        {stageDeals.map((deal) => {
                          const contactName = resolveName(deal.chatId, deal.title);
                          return (
                            <div
                              key={deal.id}
                              draggable
                              onDragStart={(e) => onDragStart(e, deal.id, stage.id)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => { e.stopPropagation(); onDrop(e, stage.id, deal.id); }}
                              className="group bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-grab active:cursor-grabbing relative"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{deal.company}</span>
                                  <h4 className="text-sm font-semibold text-gray-900 leading-tight">{contactName}</h4>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-1 mb-3">
                                {(contactTags[deal.chatId] || []).length > 0 ? (
                                  (contactTags[deal.chatId] || []).map((tag, idx) => (
                                    <span key={idx} className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 font-medium">#{tag}</span>
                                  ))
                                ) : <span className="text-[9px] text-gray-300 italic">Sem tags</span>}
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
                                <span className="text-xs font-bold text-emerald-600">{deal.value}</span>

                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => navigate(`/crm/inbox?contactId=${deal.chatId}`)} className="p-1 hover:bg-blue-50 rounded text-blue-500 transition-colors" title="Chat">
                                    <MessageCircle className="h-3.5 w-3.5" />
                                  </button>
                                  <button onClick={() => handleEditClick(deal as any)} className="p-1 hover:bg-gray-100 rounded text-gray-500 transition-colors" title="Editar">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button onClick={() => handleRemoveDeal(deal.id, deal.title)} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition-colors" title="Excluir">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {stageDeals.length === 0 && (
                          <div className="h-24 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-300 text-xs font-medium">
                            Vazio
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )
              })}

              {isAddingStage ? (
                <div className="w-80 p-3 bg-white rounded-xl border border-gray-200 shadow-sm space-y-2 h-fit">
                  <Input placeholder="Nome da etapa..." value={newStageName} onChange={e => setNewStageName(e.target.value)} className="h-9 text-sm" autoFocus onKeyDown={e => e.key === 'Enter' && handleAddStage()} />
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-8" onClick={handleAddStage}>Adicionar</Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setIsAddingStage(false)}><X className="h-4 w-4" /></Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingStage(true)}
                  className="w-80 h-12 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 hover:border-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-all text-sm font-medium shrink-0"
                >
                  <Plus className="h-4 w-4 mr-2" /> Nova Etapa
                </button>
              )}
              <div className="w-80 shrink-0" /> {/* Extra space at the end */}
            </div>
          )}
        </div>
      </div>
    </CRMLayout>
  );
}
