import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/auth/AuthContext";
import { 
  ShoppingCart, 
  Package, 
  Users, 
  TrendingUp,
  Settings as SettingsIcon,
  Menu,
  X,
  LayoutDashboard,
  Megaphone,
  BarChart3,
  Store,
  UserCircle2 as UserCircle,
  LogOut,
  Home,
  Calendar,
  CalendarDays,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [settings, setSettings] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [showAgendaDialog, setShowAgendaDialog] = useState(false);
  const [agendaItems, setAgendaItems] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installAvailable, setInstallAvailable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [swActive, setSwActive] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  // Campos adicionais do formulário de tarefas
  const [taskDesc, setTaskDesc] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const [taskPriority, setTaskPriority] = useState("Média");
  const [taskCategory, setTaskCategory] = useState("Outro");
  const isCashierRoute = location.pathname.startsWith('/cashier');
  const [keepBottomNavForEntry, setKeepBottomNavForEntry] = useState(false);

  useEffect(() => {
    // Quando navega para /cashier e existe a flag de animação, mantém o rodapé da dashboard visível
    // por alguns milissegundos para o highlight "chegar em CAIXA" antes de trocar o rodapé.
    if (isCashierRoute) {
      try {
        const animate = sessionStorage.getItem('animateCashierEntry') === 'true';
        if (animate) {
          setKeepBottomNavForEntry(true);
          setTimeout(() => setKeepBottomNavForEntry(false), 550);
        } else {
          setKeepBottomNavForEntry(false);
        }
      } catch {
        setKeepBottomNavForEntry(false);
      }
    } else {
      setKeepBottomNavForEntry(false);
    }
  }, [location.pathname]);
  const fetchSettings = async () => {
    try {
      const settingsList = await base44.entities.Settings.list();
      if (settingsList.length > 0) {
        setSettings(settingsList[0]);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };
  fetchSettings();

  useEffect(() => {
    const updateStandalone = () => {
      const standalone = (typeof window !== 'undefined' && (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)) || (typeof navigator !== 'undefined' && navigator.standalone === true);
      setIsStandalone(Boolean(standalone));
    };
    updateStandalone();
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); setInstallAvailable(true); };
    window.addEventListener('beforeinstallprompt', handler);
    const onAppInstalled = () => { setInstallAvailable(false); setInstallPrompt(null); setIsStandalone(true); };
    window.addEventListener('appinstalled', onAppInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', handler); window.removeEventListener('appinstalled', onAppInstalled); };
  }, []);

  useEffect(() => {
    const updateSw = () => {
      try { setSwActive(Boolean(navigator.serviceWorker && navigator.serviceWorker.controller)); } catch { setSwActive(false); }
    };
    updateSw();
    if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('controllerchange', updateSw);
    return () => { if (navigator.serviceWorker) navigator.serviceWorker.removeEventListener('controllerchange', updateSw); };
  }, []);

  const allNavItems = [
    { name: "Dashboard", path: createPageUrl("Dashboard"), icon: LayoutDashboard },
    { name: "Caixa", path: createPageUrl("Cashier"), icon: ShoppingCart },
    { name: "Vendas", path: createPageUrl("Sales"), icon: TrendingUp },
    { name: "Clientes", path: createPageUrl("Customers"), icon: Users },
    { name: "Estoque", path: createPageUrl("Inventory"), icon: Package },
    { name: "Relatórios", path: createPageUrl("Reports"), icon: BarChart3 },
    { name: "Marketing", path: createPageUrl("Marketing"), icon: Megaphone },
    { name: "Configurações", path: createPageUrl("Settings"), icon: SettingsIcon },
  ];

  const bottomNavItems = [
    { name: "CAIXA", path: createPageUrl("Cashier"), icon: ShoppingCart },
    { name: "VENDAS", path: createPageUrl("Sales"), icon: TrendingUp },
    { name: "CLIENTES", path: createPageUrl("Customers"), icon: Users },
    { name: "ESTOQUE", path: createPageUrl("Inventory"), icon: Package },
    { name: "MARKETING", path: createPageUrl("Marketing"), icon: Megaphone },
  ];

  const isDashboard = location.pathname === createPageUrl("Dashboard");
  const isSettings = location.pathname === createPageUrl("Settings");
  // Se não encontrar a rota atual, inicializa com CAIXA (índice 0)
  const activeIndex = bottomNavItems.findIndex((i) => location.pathname === i.path);
  const currentActiveIndex = activeIndex >= 0 ? activeIndex : 0;
  const itemPercent = 100 / bottomNavItems.length;

  return (
    <div className="min-h-screen bg-white flex overflow-x-hidden">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 bg-white shadow-lg transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } w-64`}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">
                {settings?.erp_name || "ERP"}
              </h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Sidebar Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {allNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-[#3490c7] border-b border-[#3490c7] sticky top-0 z-30 shadow-sm w-full overflow-visible">
          <div className="w-full px-1.5 sm:px-4 py-1 sm:py-1.5 flex items-center justify-between text-white">
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <Link to={createPageUrl("Dashboard")} className="inline-flex items-baseline">
                <span className="text-sm sm:text-base md:text-lg tracking-wide text-white" style={{ fontFamily: `'Poppins', sans-serif`, fontWeight: 800 }}>alra <span style={{ verticalAlign: 'super', fontSize: '0.6rem', fontWeight: 300 }}>erp+</span></span>
              </Link>
              <Link
                to={createPageUrl("Dashboard")}
                className="px-2 sm:px-3 py-1.5 rounded-lg bg-white/20 text-white text-sm uppercase font-normal inline-flex items-center gap-2"
              >
                <Store className="w-5 h-5" /> <span>{settings?.erp_name?.toUpperCase() || "MINHA LOJA"}</span>
              </Link>
              <button
                type="button"
                onClick={() => setShowAgendaDialog(true)}
                className="px-2 sm:px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm uppercase font-normal inline-flex items-center gap-2"
              >
                <Calendar className="w-5 h-5" /> <span>AGENDA</span>
              </button>
            </div>

            <div className="flex items-center gap-2 md:gap-3 shrink-0">
              <div className="hidden sm:flex items-center gap-2">
                {(!isStandalone && (installAvailable || swActive)) && (
                  <Button
                    variant="secondary"
                    className="px-2 sm:px-3 py-1.5 h-7 rounded-lg bg白/20 hover:bg白/30 text-white text-sm uppercase font-normal inline-flex items-center gap-2"
                    onClick={async () => {
                      if (installPrompt) {
                        await installPrompt.prompt();
                        try { await installPrompt.userChoice; } catch {}
                        setInstallPrompt(null); setInstallAvailable(false);
                      } else {
                        setShowInstallHelp(true);
                      }
                    }}
                  >
                    <Download className="w-5 h-5" /> <span className="hidden sm:inline">INSTALAR</span>
                  </Button>
                )}
                <Link
                  to={createPageUrl("Settings")}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg ${isSettings ? 'bg-white/30' : 'bg-white/20 hover:bg-white/30'} text-white text-sm uppercase font-normal inline-flex items-center gap-2`}
                >
                  <SettingsIcon className="w-5 h-5" /> <span className="hidden sm:inline">OPÇÕES</span>
                </Link>
              </div>
              <div className="relative ml-auto">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  onClick={() => setAccountOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                >
                  <UserCircle className="w-6 h-6 text-white" />
                </Button>

                {accountOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl border border-gray-200 bg-white shadow-lg p-1 z-50">
                    <Link
                      to={createPageUrl("Settings")}
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <SettingsIcon className="w-4 h-4" />
                      Configurações
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        setAccountOpen(false);
                        try {
                          await logout();
                        } catch {}
                        navigate('/login', { replace: true });
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <LogOut className="w-4 h-4" />
                      Sair
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        {showInstallHelp && (
          <Dialog open={showInstallHelp} onOpenChange={setShowInstallHelp}>
            <DialogContent className="sm:max-w-[420px] rounded-xl">
              <DialogHeader>
                <DialogTitle>Instalar como App</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-gray-700">
                Para instalar, use o navegador:
              </p>
              <ul className="mt-2 text-sm text-gray-600 list-disc pl-4 space-y-1">
                <li>Chrome/Edge (Desktop/Mobile): clique no ícone de instalar na barra de endereço ou use o menu ⋮ → Adicionar à tela inicial.</li>
                <li>Safari (iPhone/iPad): toque em Compartilhar → Adicionar à Tela de Início.</li>
              </ul>
              <div className="flex justify-end pt-4">
                <Button variant="outline" className="rounded-xl" onClick={() => setShowInstallHelp(false)}>Fechar</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Main Content */}
        <main className={isDashboard ? 'flex-1 flex items-center justify-center min-h-[calc(100vh-112px-64px)] pb-20' : 'flex-1 pb-20'}>
          {isDashboard ? <div className="ios-home-reveal w-full mt-8">{children}</div> : children}
        </main>

        {/* Agenda Calendar Dialog */}
        <Dialog open={showAgendaDialog} onOpenChange={setShowAgendaDialog}>
          <DialogContent className="sm:w-[920px] sm:h-[620px] w-[95vw] h-[80vh] max-w-none rounded-2xl overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Agenda - {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </DialogTitle>
            </DialogHeader>
            
            {/* Calendar Navigation + 50/50 Layout */}
            <div className="flex items-center justify-between mb-4">
              {/* Agenda Layout 50/50 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Coluna esquerda: Calendário */}
                <div>
                  {/* Calendar Navigation */}
                  <div className="flex items-center justify-between mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                      className="rounded-lg"
                    >
                      ←
                    </Button>
                    <span className="font-medium">
                      {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                      className="rounded-lg"
                    >
                      →
                    </Button>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1 mb-4">
                    {/* Days of week header */}
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                      <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                        {day}
                      </div>
                    ))}
                    
                    {/* Calendar days */}
                    {(() => {
                      const year = currentMonth.getFullYear();
                      const month = currentMonth.getMonth();
                      const firstDay = new Date(year, month, 1);
                      const lastDay = new Date(year, month + 1, 0);
                      const startDate = new Date(firstDay);
                      startDate.setDate(startDate.getDate() - firstDay.getDay());
                      
                      const days = [];
                      for (let i = 0; i < 42; i++) {
                        const date = new Date(startDate);
                        date.setDate(startDate.getDate() + i);
                        
                        const dateStr = date.toISOString().split('T')[0];
                        const isCurrentMonth = date.getMonth() === month;
                        const isToday = date.toDateString() === new Date().toDateString();
                        const hasTasks = agendaItems.some(item => item.date === dateStr);
                        
                        days.push(
                          <button
                            key={i}
                            onClick={() => {
                              if (isCurrentMonth) {
                                setSelectedDate(dateStr);
                              }
                            }}
                            className={`
                              relative h-8 w-8 text-sm rounded-lg transition-colors
                              ${isCurrentMonth 
                                ? 'hover:bg-indigo-50 text-gray-900' 
                                : 'text-gray-300 cursor-not-allowed'
                              }
                              ${isToday ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                            `}
                            disabled={!isCurrentMonth}
                          >
                            {date.getDate()}
                            {hasTasks && (
                              <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></div>
                            )}
                          </button>
                        );
                      }
                      return days;
                    })()}
                  </div>
                </div>

                {/* Coluna direita: Painel de tarefas do dia */}
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-medium text-gray-800">
                      {selectedDate 
                        ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
                        : 'Selecione um dia'}
                    </div>
                    {selectedDate && (
                      <Button variant="ghost" size="sm" className="h-8 px-2 rounded-lg" onClick={() => setSelectedDate(null)}>
                        Limpar
                      </Button>
                    )}
                  </div>

                  {/* Tasks List */}
                  <div className="space-y-2 mb-4 max-h-48 overflow-auto">
                    {selectedDate && agendaItems.filter(item => item.date === selectedDate).length > 0 ? (
                      agendaItems
                        .filter(item => item.date === selectedDate)
                        .map(item => (
                          <div key={item.id} className="flex items-start justify-between bg-white border border-gray-200 rounded-xl p-3">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{item.title}</div>
                              {item.time && <div className="text-xs text-gray-500">{item.time}</div>}
                              {item.desc && <div className="text-xs text-gray-600 mt-1">{item.desc}</div>}
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-[10px] px-2 py-0.5 rounded-full border border-gray-300 text-gray-600">{item.priority || 'Média'}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full border border-gray-300 text-gray-600">{item.category || 'Outro'}</span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700 h-6 w-6 p-0"
                              onClick={() => setAgendaItems(prev => prev.filter(i => i.id !== item.id))}
                            >
                              ×
                            </Button>
                          </div>
                        ))
                    ) : (
                      <div className="text-xs text-gray-500">Nenhuma tarefa para este dia.</div>
                    )}
                  </div>

                  {/* Botão para abrir modal de nova tarefa */}
                  <div className="flex gap-2">
                    <Button 
                      type="button"
                      className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-xl"
                      onClick={() => setShowTaskDialog(true)}
                      disabled={!selectedDate}
                    >
                      Adicionar tarefa
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowAgendaDialog(false)}
                className="rounded-xl"
              >
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

            {/* Task Dialog */}
            <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
              <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {selectedDate && new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { 
                      weekday: 'long', 
                      day: 'numeric', 
                      month: 'long' 
                    })}
                  </DialogTitle>
                </DialogHeader>
                {/* Existing tasks for selected date */}
                {selectedDate && agendaItems.filter(item => item.date === selectedDate).length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Tarefas existentes:</h4>
                    <div className="space-y-2">
                      {agendaItems
                        .filter(item => item.date === selectedDate)
                        .map(item => (
                          <div key={item.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                            <span className="text-sm text-gray-700">{item.title}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setAgendaItems(prev => prev.filter(i => i.id !== item.id));
                              }}
                              className="text-red-500 hover:text-red-700 h-6 w-6 p-0"
                            >
                              ×
                            </Button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                {/* Add new task (form completo) */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!taskTitle.trim() || !selectedDate) return;

                    const newItem = {
                      id: Date.now(),
                      date: selectedDate,
                      title: taskTitle.trim(),
                      desc: taskDesc.trim(),
                      time: taskTime,
                      priority: taskPriority,
                      category: taskCategory,
                    };
                    setAgendaItems(prev => [...prev, newItem]);

                    setTaskTitle("");
                    setTaskDesc("");
                    setTaskTime("");
                    setTaskPriority("Média");
                    setTaskCategory("Outro");
                    setShowTaskDialog(false);
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="task-title" className="text-xs text-gray-700">Título</Label>
                      <Input
                        id="task-title"
                        value={taskTitle}
                        onChange={(e) => setTaskTitle(e.target.value)}
                        placeholder="Ex: Ligar para fornecedor"
                        className="rounded-xl border-gray-200"
                        autoFocus
                      />
                    </div>
                    <div>
                      <Label htmlFor="task-time" className="text-xs text-gray-700">Horário</Label>
                      <Input
                        id="task-time"
                        type="time"
                        value={taskTime}
                        onChange={(e) => setTaskTime(e.target.value)}
                        className="rounded-xl border-gray-200"
                      />
                    </div>
                    <div>
                      <Label htmlFor="task-priority" className="text-xs text-gray-700">Prioridade</Label>
                      <select
                        id="task-priority"
                        value={taskPriority}
                        onChange={(e) => setTaskPriority(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 text-sm px-3 py-2"
                      >
                        <option>Baixa</option>
                        <option>Média</option>
                        <option>Alta</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="task-category" className="text-xs text-gray-700">Categoria</Label>
                      <select
                        id="task-category"
                        value={taskCategory}
                        onChange={(e) => setTaskCategory(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 text-sm px-3 py-2"
                      >
                        <option>Outro</option>
                        <option>Reunião</option>
                        <option>Chamada</option>
                        <option>Entrega</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="task-desc" className="text-xs text-gray-700">Descrição</Label>
                    <textarea
                      id="task-desc"
                      value={taskDesc}
                      onChange={(e) => setTaskDesc(e.target.value)}
                      placeholder="Detalhes adicionais"
                      className="w-full rounded-xl border border-gray-200 text-sm px-3 py-2 min-h-[80px]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowTaskDialog(false)}
                      className="flex-1 rounded-xl"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-xl"
                      disabled={!taskTitle.trim()}
                    >
                      Adicionar
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

        {/* Bottom Navigation with Moving Green Highlight */}
          <nav className="fixed bottom-0 left-0 right-0 z-30">
            <div className="relative bg-gray-100 border-t border-gray-200 h-[64px] sm:h-[56px]">
              {/* Destaque verde que acompanha o item ativo */}
              <div
                className={`pointer-events-none absolute inset-y-0 rounded-full shadow-lg transition-all duration-500 ease-out z-0 ${bottomNavItems[currentActiveIndex]?.name === 'MARKETING' ? 'bg-blue-500' : 'bg-green-500'}`}
                style={{ 
                  width: `${itemPercent - 2}%`, 
                  left: `${currentActiveIndex * itemPercent + 1}%`,
                  margin: '6px 0',
                }}
              />
              
              <div className="grid grid-cols-5 gap-0 relative z-10">
                {bottomNavItems.map((item, idx) => {
                  const Icon = item.icon;
                  const isActive = idx === currentActiveIndex;
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      onClick={() => { if (item.name === 'CAIXA') { try { sessionStorage.setItem('animateCashierEntry', 'true'); } catch {} } }}
                      className={`relative flex flex-col items-center justify-center h-[64px] sm:h-[56px] px-1 sm:px-2 transition-colors duration-300 ${
                        isActive ? 'text-white' : 'text-gray-700 hover:text-gray-900'
                      }`}
                    >
                      {item.name === 'MARKETING' && (
                        <span className="absolute -top-1 left-1/2 -translate-x-1/2 bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 text-[10px] rounded-full shadow-sm">em breve</span>
                      )}
                      <Icon className="w-6 h-6 mb-0 sm:mb-0" />
                      <span className="hidden sm:inline text-xs font-semibold tracking-wide">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>
        </div>
    </div>
  );
}
