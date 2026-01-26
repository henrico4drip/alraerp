import { useState, useEffect, useRef } from "react";
import CRMLayout from "@/components/CRMLayout";
import { useEvolution } from "@/contexts/EvolutionContext";
import { useCrm } from "@/contexts/CrmContext";
import { Plus, MoreHorizontal, GripVertical, Loader2, X, Save, Pencil, Trash2, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

// Simple Modal Component (No Radix dependency to avoid install issues)
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
      <div className="bg-background border border-border w-full max-w-md p-6 rounded-xl shadow-lg space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Editar Negócio</h3>
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
      // Only fetch if we don't have deals yet
      if (deals.length > 0) return;

      setLoading(true);
      try {
        const chats = await api.fetchChats();

        // Map chats to Deals and place them in "Novos Leads"
        // Taking first 50 to avoid performance issues for now
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
              title: name || "Novo Negócio", // Use WhatsApp name as initial title
              company: "WhatsApp", // Source
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

  const onMouseDown = (e: React.MouseEvent) => {
    // Only start board drag if clicking on the container itself, not on cards
    const target = e.target as HTMLElement;
    if (target.closest('[draggable="true"]') || target.closest('button')) {
      return;
    }

    if (!scrollContainerRef.current) return;
    setIsDraggingBoard(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
    e.preventDefault();
  };

  const onMouseLeave = () => {
    setIsDraggingBoard(false);
  };

  const onMouseUp = () => {
    setIsDraggingBoard(false);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingBoard || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Scroll speed multiplier
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

    // Reorder logic
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
      <div className="flex flex-col h-[calc(100vh-2rem)] m-4 bg-background">
        <EditTaskModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          task={editingTask}
          onSave={handleSaveTask}
        />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Funil de Vendas</h1>
            <p className="text-muted-foreground">Gerencie seus negócios e oportunidades.</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Novo Negócio
          </Button>
        </div>

        <div
          ref={scrollContainerRef}
          className={`flex-1 overflow-x-auto overflow-y-hidden pb-4 scrollbar-thin scrollbar-thumb-primary/10 scrollbar-track-transparent ${isDraggingBoard ? 'cursor-grabbing select-none' : 'cursor-grab'
            }`}
          style={{
            userSelect: isDraggingBoard ? 'none' : 'auto',
            WebkitUserSelect: isDraggingBoard ? 'none' : 'auto'
          }}
          onMouseDown={onMouseDown}
          onMouseLeave={onMouseLeave}
          onMouseUp={onMouseUp}
          onMouseMove={onMouseMove}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p>Carregando funil...</p>
            </div>
          ) : (
            <div className="flex gap-4 h-full min-w-max pr-96">
              {stages.map((stage) => {
                const stageDeals = deals.filter(d =>
                  d.stageId === stage.id &&
                  !hiddenContacts.some(hc => isSameJid(hc, d.chatId))
                );
                return (
                  <div
                    key={stage.id}
                    className="w-80 min-w-[20rem] max-w-[20rem] shrink-0 flex flex-col bg-muted/40 rounded-xl border border-border/50 h-full overflow-hidden"
                    onDragOver={onDragOver}
                    onDrop={(e) => onDrop(e, stage.id)}
                  >
                    {/* Column Header */}
                    <div className="p-3 border-b border-border/50 flex items-center justify-between bg-card/50 rounded-t-xl backdrop-blur">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${stage.color}`} />
                        <span className="font-semibold text-sm">{stage.title}</span>
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                          {stageDeals.length}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        onClick={() => handleRemoveStage(stage.id, stage.title)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Tasks Area */}
                    <ScrollArea className="flex-1 p-2">
                      <div className="space-y-2">
                        {stageDeals.map((deal) => {
                          const contactName = resolveName(deal.chatId, deal.title);
                          return (
                            <div
                              key={deal.id}
                              draggable
                              onDragStart={(e) => onDragStart(e, deal.id, stage.id)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.stopPropagation();
                                onDrop(e, stage.id, deal.id);
                              }}
                              className="group bg-card p-3 rounded-lg border border-border/50 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:border-primary/20 overflow-hidden"
                            >
                              <div className="w-full flex flex-col gap-3">
                                {/* Header: Info vs Actions */}
                                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-start w-full">
                                  {/* Info Column */}
                                  <div className="flex flex-col gap-1.5 min-w-0 overflow-hidden">
                                    {/* Line 1: Source */}
                                    <div className="flex shrink-0">
                                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-primary bg-primary/10 px-1.5 py-0.5 rounded truncate max-w-full">
                                        {deal.company || "WhatsApp"}
                                      </span>
                                    </div>

                                    {/* Line 2: Tags */}
                                    <div className="flex flex-wrap gap-1 max-w-full overflow-hidden">
                                      {(contactTags[deal.chatId] || []).length > 0 ? (
                                        (contactTags[deal.chatId] || []).map((tag, idx) => (
                                          <span key={idx} className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border/50 truncate max-w-[80px]">
                                            {tag}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-[9px] text-muted-foreground/30 italic">Sem etiquetas</span>
                                      )}
                                    </div>

                                    {/* Line 3: Customer Name */}
                                    <h4 className="font-bold text-sm text-foreground truncate w-full mt-0.5" title={contactName}>
                                      {contactName}
                                    </h4>
                                  </div>

                                  {/* Actions Column */}
                                  <div className="flex flex-col gap-1 shrink-0">
                                    <button
                                      onClick={() => navigate(`/crm/inbox?contactId=${deal.chatId}`)}
                                      className="p-1.5 hover:bg-primary/10 rounded text-primary transition-colors border border-border/10 bg-primary/5 hover:border-primary/20"
                                      title="Abrir Conversa"
                                    >
                                      <MessageCircle className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={() => handleEditClick(deal as any)}
                                      className="p-1.5 hover:bg-muted rounded text-muted-foreground transition-colors border border-border/10 bg-muted/5 hover:border-border"
                                      title="Editar"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={() => handleRemoveDeal(deal.id, deal.title)}
                                      className="p-1.5 hover:bg-red-500/10 rounded text-red-500/60 hover:text-red-500 transition-colors border border-border/10 bg-muted/5 hover:border-red-500/20"
                                      title="Excluir"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>

                                {/* Footer: Value and Avatar */}
                                <div className="flex items-center justify-between pt-3 border-t border-border/30 w-full overflow-hidden">
                                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 truncate flex-1 min-w-0">
                                    {deal.value}
                                  </p>
                                  <Avatar className="h-7 w-7 border-2 border-background shadow-sm shrink-0 ml-2">
                                    <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-600 font-bold">
                                      {(contactName || "?").substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {stageDeals.length === 0 && (
                          <div className="h-24 border-2 border-dashed border-border/50 rounded-lg flex items-center justify-center text-muted-foreground text-xs bg-muted/20">
                            Arraste itens aqui
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )
              })}

              {/* Add Column Button */}
              {isAddingStage ? (
                <div className="w-80 flex flex-col gap-2 p-3 bg-card rounded-xl border border-border/50">
                  <Input
                    placeholder="Nome do estágio..."
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddStage} className="flex-1">
                      <Plus className="h-3 w-3 mr-1" /> Adicionar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      setIsAddingStage(false);
                      setNewStageName("");
                    }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingStage(true)}
                  className="w-80 h-12 flex items-center justify-center gap-2 border-2 border-dashed border-border/50 rounded-xl text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:border-border transition-colors"
                >
                  <Plus className="h-4 w-4" /> Adicionar Estágio
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </CRMLayout>
  );
}
