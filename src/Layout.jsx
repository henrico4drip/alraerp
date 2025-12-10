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
  Check,
  LayoutDashboard,
  Megaphone,
  BarChart3,
  Store,
  UserCircle2 as UserCircle,
  LogOut,
  Home,
  Calendar,
  CalendarDays,
  Wallet,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from '@/api/supabaseClient'
import { useEffectiveSettings } from '@/hooks/useEffectiveSettings'
import Tutorial from '@/components/Tutorial'
import { useProfile } from "@/context/ProfileContext";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { currentProfile, logoutProfile } = useProfile();
  const [settings, setSettings] = useState(null);
  const effective = useEffectiveSettings();
  useEffect(() => { setSettings(effective) }, [effective])
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [showAgendaDialog, setShowAgendaDialog] = useState(false);
  const [agendaItems, setAgendaItems] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('agenda').select('*').order('date', { ascending: true }).order('time', { ascending: true })
        if (Array.isArray(data)) {
          setAgendaItems(data.map(it => ({
            id: it.id,
            date: it.date,
            title: it.title,
            desc: it.desc || '',
            time: it.time || '',
            priority: it.priority || 'Média',
            category: it.category || 'Outro',
            done: Boolean(it.done),
          })))
        }
      } catch { }
    })()
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const seeded = window.localStorage.getItem('seed_defaults_done') === 'true'
        if (seeded) return
        const [products, customers] = await Promise.all([
          base44.entities.Product.list('-created_date'),
          base44.entities.Customer.list(),
        ])
        if (!products || products.length === 0) {
          try {
            await base44.entities.Product.create({
              name: 'Produto Exemplo',
              barcode: 'EXEMPLO001',
              price: 49.9,
              cost: 30,
              stock: 10,
              category: 'Exemplos',
            })
          } catch { }
        }
        if (!customers || customers.length === 0) {
          try {
            await base44.entities.Customer.create({
              name: 'Cliente Exemplo',
              phone: '(11) 99999-0000',
              email: 'exemplo@cliente.com',
            })
          } catch { }
        }
        try { window.localStorage.setItem('seed_defaults_done', 'true') } catch { }
      } catch { }
    })()
  }, [])
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
  // Edição de tarefa existente
  const [showEditTaskDialog, setShowEditTaskDialog] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDesc, setEditTaskDesc] = useState("");
  const [editTaskTime, setEditTaskTime] = useState("");
  const [editTaskPriority, setEditTaskPriority] = useState("Média");
  const [editTaskCategory, setEditTaskCategory] = useState("Outro");
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


  useEffect(() => {
    const media = (typeof window !== 'undefined' && window.matchMedia) ? window.matchMedia('(display-mode: standalone)') : null;
    const updateStandalone = () => {
      const standalone = (media && media.matches) || (typeof navigator !== 'undefined' && navigator.standalone === true);
      setIsStandalone(Boolean(standalone));
      if (standalone) { setInstallAvailable(false); setInstallPrompt(null); }
    };
    updateStandalone();
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); setInstallAvailable(true); };
    window.addEventListener('beforeinstallprompt', handler);
    const onAppInstalled = () => { setInstallAvailable(false); setInstallPrompt(null); setIsStandalone(true); };
    window.addEventListener('appinstalled', onAppInstalled);
    if (media && media.addEventListener) media.addEventListener('change', updateStandalone);
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
    { name: "Dashboard", path: createPageUrl("Dashboard"), icon: LayoutDashboard, tutorialId: "dashboard-link" },
    { name: "Caixa", path: createPageUrl("Cashier"), icon: ShoppingCart, tutorialId: "cashier-link" },
    { name: "Vendas", path: createPageUrl("Sales"), icon: TrendingUp },
    { name: "Clientes", path: createPageUrl("Customers"), icon: Users, tutorialId: "customers-link" },
    { name: "Estoque", path: createPageUrl("Inventory"), icon: Package, tutorialId: "inventory-link" },
    { name: "Pagamentos", path: createPageUrl("Payments"), icon: Wallet, tutorialId: "payments-link" },
    { name: "Relatórios", path: createPageUrl("Reports"), icon: BarChart3 },
    { name: "Marketing", path: createPageUrl("Marketing"), icon: Megaphone },
    { name: "Configurações", path: createPageUrl("Settings"), icon: SettingsIcon, tutorialId: "settings-link" },
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
      <div className={`fixed inset-y-0 left-0 z-50 bg-white shadow-lg transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
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
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    data-tutorial={item.tutorialId}
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
        <header className="bg-[#3490c7] border-b border-[#3490c7] fixed top-0 left-0 right-0 z-30 shadow-sm w-full overflow-visible">
          <div className="w-full px-1.5 sm:px-4 py-1 sm:py-1.5 flex items-center justify-between text-white">
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <Link to={createPageUrl("Dashboard")} className="inline-flex items-baseline">
                <span className="text-sm sm:text-base md:text-lg tracking-wide text-white" style={{ fontFamily: `'Poppins', sans-serif`, fontWeight: 800 }}>alra <span style={{ verticalAlign: 'super', fontSize: '0.6rem', fontWeight: 300 }}>erp+</span></span>
              </Link>
              <Link
                to={createPageUrl("Dashboard")}
                className="px-2 sm:px-3 py-1.5 rounded-lg bg-white/20 text-white text-sm uppercase font-normal inline-flex items-center gap-2"
                data-tutorial="dashboard-link"
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
                    className="px-2 sm:px-3 py-1.5 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm uppercase font-normal inline-flex items-center gap-2"
                    onClick={async () => {
                      if (installPrompt) {
                        await installPrompt.prompt();
                        try { await installPrompt.userChoice; } catch { }
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
                  data-tutorial="settings-link"
                >
                  <SettingsIcon className="w-5 h-5" /> <span className="hidden sm:inline">OPÇÕES</span>
                </Link>
              </div>
              <div className="relative ml-auto">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-full shadow-sm border border-white/20 ${currentProfile?.role === 'admin' ? 'bg-blue-600' : 'bg-gray-600'}`}
                  onClick={() => setAccountOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                >
                  {/* Initials */}
                  <span className="font-bold text-sm text-white">{currentProfile?.name?.charAt(0) || <UserCircle className="w-6 h-6" />}</span>
                </Button>

                {accountOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-xl border border-gray-200 bg-white shadow-lg p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-3 py-2 border-b border-gray-100 mb-1">
                      <p className="font-bold text-gray-900">{currentProfile?.name}</p>
                      <p className="text-xs text-gray-500 uppercase">{currentProfile?.role}</p>
                      <p className="text-xs text-gray-400 mt-1 truncate">{user?.email}</p>
                    </div>

                    <Link
                      to={createPageUrl("Settings")}
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <SettingsIcon className="w-4 h-4" />
                      Configurações
                    </Link>

                    {/* Switch Profile Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setAccountOpen(false);
                        logoutProfile();
                        navigate('/select-profile');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Users className="w-4 h-4" />
                      Trocar Perfil
                    </button>

                    <div className="border-t border-gray-100 my-1"></div>

                    <button
                      type="button"
                      onClick={async () => {
                        setAccountOpen(false);
                        logoutProfile();
                        try {
                          await logout();
                        } catch { }
                        navigate('/login', { replace: true });
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4" />
                      Sair Totalmente
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        {/* Spacer to avoid content being hidden under fixed header */}
        <div className="h-12 sm:h-14"></div>
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

        {/* Agenda Calendar Dialog - Estilo Apple/iCloud */}
        <Dialog open={showAgendaDialog} onOpenChange={setShowAgendaDialog}>
          <DialogContent className="sm:w-[900px] sm:h-[600px] w-[95vw] h-[85vh] max-w-none rounded-3xl overflow-hidden p-0 gap-0 border-0 shadow-2xl flex flex-col sm:flex-row bg-[#f5f5f7]">
            {/* COLUNA ESQUERDA: Calendário (Visual Clean) */}
            <div className="w-full sm:w-[320px] bg-white border-r border-gray-200 p-6 flex flex-col h-full">
              {/* Navegação do Mês */}
              <div className="flex items-center justify-between mb-6">
                <span className="text-xl font-bold capitalize text-gray-900">
                  {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="h-8 w-8 rounded-full hover:bg-gray-100 text-gray-500">
                    <span className="sr-only">Anterior</span>
                    <span className="text-lg">‹</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="h-8 w-8 rounded-full hover:bg-gray-100 text-gray-500">
                    <span className="sr-only">Próximo</span>
                    <span className="text-lg">›</span>
                  </Button>
                </div>
              </div>

              {/* Grid Dias da Semana */}
              <div className="grid grid-cols-7 mb-2">
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
                  <div key={i} className="text-center text-[11px] font-semibold text-gray-400 py-1 uppercase tracking-wide">
                    {day}
                  </div>
                ))}
              </div>

              {/* Grid Dias do Mês */}
              <div className="grid grid-cols-7 gap-y-2 flex-1 content-start">
                {(() => {
                  const year = currentMonth.getFullYear();
                  const month = currentMonth.getMonth();
                  const firstDay = new Date(year, month, 1);
                  const startDate = new Date(firstDay);
                  startDate.setDate(startDate.getDate() - firstDay.getDay());

                  const days = [];
                  for (let i = 0; i < 42; i++) {
                    const date = new Date(startDate);
                    date.setDate(startDate.getDate() + i);
                    const dateStr = date.toISOString().split('T')[0];
                    const isCurrentMonth = date.getMonth() === month;
                    const isToday = date.toDateString() === new Date().toDateString();
                    const isSelected = selectedDate === dateStr;
                    const hasTasks = agendaItems.some(item => item.date === dateStr);

                    days.push(
                      <button
                        key={i}
                        onClick={() => isCurrentMonth && setSelectedDate(dateStr)}
                        disabled={!isCurrentMonth}
                        className={`
                          relative h-9 w-9 mx-auto flex items-center justify-center text-sm font-medium rounded-full transition-all
                          ${!isCurrentMonth ? 'text-gray-200 cursor-default' : 'text-gray-900 hover:bg-gray-100'}
                          ${isSelected ? 'bg-black text-white hover:bg-black shadow-md' : ''}
                          ${isToday && !isSelected ? 'text-red-500 font-bold' : ''}
                        `}
                      >
                        {date.getDate()}
                        {/* Indicador de tarefa (Dot style) */}
                        {hasTasks && (
                          <div className={`absolute bottom-1 h-1 w-1 rounded-full ${isSelected ? 'bg-white' : 'bg-gray-400'}`}></div>
                        )}
                      </button>
                    );
                  }
                  return days;
                })()}
              </div>
            </div>

            {/* COLUNA DIREITA: Lista de Tarefas (Estilo Timeline) */}
            <div className="flex-1 bg-[#f5f5f7] flex flex-col h-full overflow-hidden">
              {/* Cabeçalho da Data Selecionada */}
              <div className="p-6 border-b border-gray-200/50 bg-white/50 backdrop-blur-md sticky top-0 z-10 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 capitalize">
                    {selectedDate
                      ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })
                      : 'Próximos 7 dias'}
                  </h2>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {selectedDate
                      ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
                      : 'Nenhuma data selecionada'}
                  </p>
                </div>
                <Button
                  onClick={() => setShowTaskDialog(true)}
                  disabled={!selectedDate}
                  className="rounded-full w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white shadow-lg p-0 flex items-center justify-center"
                >
                  <span className="text-xl pb-1">+</span>
                </Button>
              </div>

              {/* Lista Scrollável */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {(() => {
                  const now = new Date()
                  const start = new Date(now)
                  start.setHours(0, 0, 0, 0)
                  const end = new Date(start)
                  end.setDate(end.getDate() + 7)
                  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
                  const baseList = selectedDate
                    ? agendaItems.filter(item => item.date === selectedDate)
                    : agendaItems.filter(item => {
                      const d = new Date((item.date || '') + 'T00:00:00')
                      return d >= start && d <= end
                    })
                  const list = baseList.filter(item => !(item.done && item.done_at && new Date(item.done_at) < fiveMinAgo))
                  list.sort((a, b) => {
                    const da = new Date((a.date || '') + 'T00:00:00')
                    const db = new Date((b.date || '') + 'T00:00:00')
                    const diff = da - db
                    if (diff !== 0) return diff
                    return (a.time || '').localeCompare(b.time || '')
                  })
                  return list.map(item => (
                    <div key={item.id} className="group flex gap-4 relative">
                      {/* Coluna Horário */}
                      <div className="w-14 text-right pt-1">
                        <span className="text-xs font-semibold text-gray-900">{item.time || 'Dia todo'}</span>
                      </div>

                      {/* Linha Vertical Decorativa */}
                      <div className="w-[2px] bg-gray-200 relative">
                        <div className={`absolute top-2 -left-[3px] w-2 h-2 rounded-full border-2 border-white 
                            ${item.category === 'Reunião' ? 'bg-purple-500' :
                            item.category === 'Entrega' ? 'bg-green-500' :
                              item.category === 'Chamada' ? 'bg-blue-500' : 'bg-orange-500'} 
                          `}></div>
                      </div>

                      {/* Card do Evento */}
                      <div className={`flex-1 bg-white p-3 rounded-xl border ${item.done ? 'border-green-200 bg-green-50' : 'border-gray-100'} shadow-sm transition-shadow hover:shadow-md mb-2`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className={`font-semibold text-sm ${item.done ? 'text-green-700 line-through' : 'text-gray-900'}`}>{item.title}</h4>
                            {item.desc && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.desc}</p>}
                            <div className="mt-2 flex gap-2">
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 font-medium">
                                {item.category || 'Geral'}
                              </span>
                              {item.time && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 font-medium">{item.time}</span>
                              )}
                              {item.priority === 'Alta' && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-50 text-red-600 font-medium">! Alta Prioridade</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingTaskId(item.id);
                                setEditTaskTitle(item.title || "");
                                setEditTaskDesc(item.desc || "");
                                setEditTaskTime(item.time || "");
                                setEditTaskPriority(item.priority || "Média");
                                setEditTaskCategory(item.category || "Outro");
                                setShowEditTaskDialog(true);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-700 p-1"
                              title="Editar"
                            >
                              ✎
                            </button>
                            <button
                              onClick={async () => {
                                const newDone = !item.done
                                setAgendaItems(prev => prev.map(i => i.id === item.id ? { ...i, done: newDone } : i))
                                try { await supabase.from('agenda').update({ done: newDone }).eq('id', item.id) } catch { }
                              }}
                              className={`opacity-0 group-hover:opacity-100 transition-opacity ${item.done ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-gray-700'} p-1`}
                              title={item.done ? 'Desmarcar' : 'Concluir'}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                setAgendaItems(prev => prev.filter(i => i.id !== item.id))
                                try { await supabase.from('agenda').delete().eq('id', item.id) } catch { }
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 p-1"
                              title="Excluir"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                })()}
                {(!selectedDate && agendaItems.length === 0) && (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                    <CalendarDays className="w-16 h-16 mb-4 text-gray-300" strokeWidth={1} />
                    <p className="text-sm">Sem compromissos</p>
                  </div>
                )}
              </div>

              {/* Botão Fechar Mobile */}
              <div className="p-4 border-t bg-white sm:hidden">
                <Button variant="outline" className="w-full rounded-xl" onClick={() => setShowAgendaDialog(false)}>Fechar</Button>
              </div>
            </div>

            {/* Botão Fechar Desktop (Absolute) */}
            <button
              onClick={() => setShowAgendaDialog(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 hidden sm:block bg-gray-100/50 hover:bg-gray-200/80 rounded-full p-2 transition-colors z-20"
            >
              <X className="w-5 h-5" />
            </button>
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
            {/* Existing tasks for selected date or all when none selected */}
            {(selectedDate ? agendaItems.filter(item => item.date === selectedDate) : agendaItems).length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Tarefas existentes:</h4>
                <div className="space-y-2">
                  {(selectedDate ? agendaItems.filter(item => item.date === selectedDate) : agendaItems)
                    .map(item => (
                      <div key={item.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                        <span className="text-sm text-gray-700">{item.title}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            setAgendaItems(prev => prev.filter(i => i.id !== item.id));
                            try { await supabase.from('agenda').delete().eq('id', item.id) } catch { }
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
              onSubmit={async (e) => {
                e.preventDefault();
                if (!taskTitle.trim()) return;
                const payload = {
                  user_id: user?.id,
                  date: selectedDate || new Date().toISOString().split('T')[0],
                  title: taskTitle.trim(),
                  desc: taskDesc.trim(),
                  time: taskTime,
                  priority: taskPriority,
                  category: taskCategory,
                  done: false,
                }
                try {
                  const { data } = await supabase.from('agenda').insert(payload).select('*').limit(1)
                  const inserted = Array.isArray(data) && data[0] ? data[0] : null
                  if (inserted) {
                    setAgendaItems(prev => [...prev, {
                      id: inserted.id,
                      date: inserted.date,
                      title: inserted.title,
                      desc: inserted.desc || '',
                      time: inserted.time || '',
                      priority: inserted.priority || 'Média',
                      category: inserted.category || 'Outro',
                      done: Boolean(inserted.done),
                    }])
                  } else {
                    setAgendaItems(prev => [...prev, { id: Date.now(), ...payload }])
                  }
                } catch {
                  setAgendaItems(prev => [...prev, { id: Date.now(), ...payload }])
                }
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
                    <option>Financeiro</option>
                    <option>Fornecedor</option>
                    <option>Cliente</option>
                    <option>Marketing</option>
                    <option>Operacional</option>
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

        {/* Edit Task Dialog */}
        <Dialog open={showEditTaskDialog} onOpenChange={setShowEditTaskDialog}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Editar tarefa</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editingTaskId) return;
                const update = {
                  title: editTaskTitle.trim(),
                  desc: editTaskDesc.trim(),
                  time: editTaskTime,
                  priority: editTaskPriority,
                  category: editTaskCategory,
                }
                setAgendaItems(prev => prev.map(i => i.id === editingTaskId ? { ...i, ...update } : i));
                try { await supabase.from('agenda').update(update).eq('id', editingTaskId) } catch { }
                setShowEditTaskDialog(false);
                setEditingTaskId(null);
              }}
              className="space-y-3"
            >
              <div>
                <p className="text-xs text-gray-500">Título</p>
                <input className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" value={editTaskTitle} onChange={(e) => setEditTaskTitle(e.target.value)} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Descrição</p>
                <textarea className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" value={editTaskDesc} onChange={(e) => setEditTaskDesc(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-gray-500">Horário</p>
                  <input className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" value={editTaskTime} onChange={(e) => setEditTaskTime(e.target.value)} placeholder="ex.: 14:30" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Prioridade</p>
                  <select className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" value={editTaskPriority} onChange={(e) => setEditTaskPriority(e.target.value)}>
                    <option>Média</option>
                    <option>Baixa</option>
                    <option>Alta</option>
                  </select>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500">Categoria</p>
                <input className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" value={editTaskCategory} onChange={(e) => setEditTaskCategory(e.target.value)} />
              </div>
              <div className="pt-2 flex gap-2 justify-end">
                <Button variant="outline" className="rounded-xl" type="button" onClick={() => { setShowEditTaskDialog(false); setEditingTaskId(null); }}>Cancelar</Button>
                <Button className="rounded-xl" type="submit">Salvar</Button>
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
                    onClick={() => { if (item.name === 'CAIXA') { try { sessionStorage.setItem('animateCashierEntry', 'true'); } catch { } } }}
                    className={`relative flex flex-col items-center justify-center h-[64px] sm:h-[56px] px-1 sm:px-2 transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-700 hover:text-gray-900'
                      }`}
                    data-tutorial={
                      item.name === 'ESTOQUE' ? 'inventory-bottom-link' :
                        item.name === 'CLIENTES' ? 'customers-bottom-link' :
                          item.name === 'CAIXA' ? 'cashier-bottom-link' : undefined
                    }
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

      {/* Tutorial System */}
      <Tutorial />
    </div>
  );
}
