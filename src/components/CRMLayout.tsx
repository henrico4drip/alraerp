import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import {
  MessageCircle, Users, Briefcase, BarChart3, Settings as SettingsIcon,
  ChevronLeft, ChevronRight, UserPlus, LogOut, Shield, Bell, Sun, Moon,
  PanelLeftClose, PanelLeft, Home, Search, MoreHorizontal, Building,
  Menu, X, DollarSign, MessageSquare, Headphones, Phone, Megaphone
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/auth/AuthContext";
import { useProfile } from "@/context/ProfileContext";
import { useCrm } from "@/contexts/CrmContext";
import { useEvolution } from "@/contexts/EvolutionContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { label: "Inbox", path: "/crm/inbox", icon: MessageCircle, gradient: "from-blue-500 to-indigo-600", activeBg: "bg-blue-50", activeText: "text-blue-700", activeBorder: "border-blue-200" },
  { label: "Contatos", path: "/crm/contacts", icon: Users, gradient: "from-violet-500 to-purple-600", activeBg: "bg-violet-50", activeText: "text-violet-700", activeBorder: "border-violet-200" },
  { label: "Funil", path: "/crm/funnel", icon: Briefcase, gradient: "from-amber-500 to-orange-600", activeBg: "bg-amber-50", activeText: "text-amber-700", activeBorder: "border-amber-200" },
  { label: "Campanhas", path: "/crm/campaigns", icon: Megaphone, gradient: "from-emerald-500 to-teal-600", activeBg: "bg-emerald-50", activeText: "text-emerald-700", activeBorder: "border-emerald-200" },
];

interface CRMLayoutProps {
  children?: React.ReactNode;
}

export default function CRMLayout({ children }: CRMLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { currentProfile, logoutProfile } = useProfile();
  const { totalUnread, unreadCounts } = useCrm();
  const { isConnected } = useEvolution();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('crm_sidebar_collapsed') === 'true'; }
    catch { return false; }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('crm_sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) => location.pathname === path || (path === '/crm/inbox' && location.pathname === '/crm');

  const sidebarWidth = sidebarCollapsed ? '60px' : '220px';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:relative z-50 h-full flex flex-col bg-white border-r border-gray-200/60 transition-all duration-200 ease-out ${mobileSidebarOpen ? 'translate-x-0 w-[220px]' : 'md:translate-x-0 -translate-x-full'
          }`}
        style={{ width: mobileSidebarOpen ? '220px' : sidebarWidth }}
      >
        {/* Sidebar Header */}
        <div className={`h-14 flex items-center border-b border-white/5 bg-[#0a0a0a] shrink-0 text-white shadow-md relative overflow-hidden ${sidebarCollapsed ? 'justify-center' : 'justify-between px-3'}`}>
          <div className="absolute right-0 top-0 h-full w-48 pointer-events-none opacity-20 flex items-center justify-end select-none translate-x-12 translate-y-2">
            <span className="text-[120px] font-black text-[#3490c7] blur-[2px] leading-none" style={{ fontFamily: `'Poppins', sans-serif` }}>a</span>
          </div>
          {!sidebarCollapsed ? (
            <>
              <Link to="/crm/inbox" className="flex items-center gap-2 min-w-0 relative z-10">
                <div className="h-8 w-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-sm border border-white/10">
                  <Headphones className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-sm font-bold text-white truncate leading-tight">CRM</h1>
                  <div className="flex items-center gap-1">
                    <div className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-green-400' : 'bg-white/30'}`} />
                    <span className="text-[9px] text-white/60 font-medium">{isConnected ? 'Conectado' : 'Offline'}</span>
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-1 relative z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl text-white/50 hover:text-white hover:bg-white/10 hidden md:flex shrink-0 transition-all"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl text-white/50 hover:text-white hover:bg-white/10 md:hidden transition-all"
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl text-white/70 hover:text-white hover:bg-white/10 flex shrink-0 transition-all relative z-10"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              <PanelLeft className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 px-2">
          <div className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              const isInbox = item.label === "Inbox";

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`flex items-center gap-2.5 py-2.5 rounded-xl transition-all relative ${sidebarCollapsed ? 'px-0 justify-center' : 'px-3'
                    } ${active
                      ? `${item.activeBg} ${item.activeText} font-semibold shadow-sm border ${item.activeBorder}`
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                >
                  <div className="relative shrink-0">
                    {active ? (
                      <div className={`h-[22px] w-[22px] rounded-md bg-gradient-to-br ${item.gradient} flex items-center justify-center`}>
                        <Icon className="h-3 w-3 text-white" />
                      </div>
                    ) : (
                      <Icon className="h-[18px] w-[18px]" />
                    )}
                    {isInbox && totalUnread > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 h-4 min-w-[1rem] px-[3px] rounded-full bg-gradient-to-r from-emerald-400 to-green-500 text-[8px] font-bold text-white flex items-center justify-center shadow-sm">
                        {totalUnread > 99 ? '99+' : totalUnread}
                      </span>
                    )}
                  </div>
                  {!sidebarCollapsed && (
                    <span className="text-[13px] truncate">{item.label}</span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Quick Links */}
          {!sidebarCollapsed && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-0.5">
              <Link
                to="/dashboard"
                className="flex items-center gap-2.5 px-3 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 rounded-xl transition-all text-[12px]"
              >
                <Home className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>
              <Link
                to="/settings"
                className="flex items-center gap-2.5 px-3 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 rounded-xl transition-all text-[12px]"
              >
                <SettingsIcon className="h-4 w-4" />
                <span>Configurações</span>
              </Link>
            </div>
          )}
          {sidebarCollapsed && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-0.5 flex flex-col items-center">
              <Link
                to="/dashboard"
                title="Dashboard"
                className="p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600 rounded-xl transition-all"
              >
                <Home className="h-4 w-4" />
              </Link>
              <Link
                to="/settings"
                title="Configurações"
                className="p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600 rounded-xl transition-all"
              >
                <SettingsIcon className="h-4 w-4" />
              </Link>
            </div>
          )}
        </nav>

        {/* User Section */}
        <div className="border-t border-gray-100 p-2 shrink-0 bg-gray-50/50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={`w-full flex items-center gap-2.5 p-2 hover:bg-gray-100 rounded-xl transition-all ${sidebarCollapsed ? 'justify-center' : ''}`}>
                <Avatar className="h-8 w-8 shrink-0 ring-2 ring-white shadow-sm">
                  <AvatarFallback className={`text-[10px] font-bold ${currentProfile?.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                    {currentProfile?.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                {!sidebarCollapsed && (
                  <div className="min-w-0 text-left">
                    <p className="text-xs font-semibold text-gray-800 truncate">{currentProfile?.name || "Usuário"}</p>
                    <p className="text-[9px] text-gray-400 uppercase">{currentProfile?.role || "user"}</p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-lg border-gray-200/60">
              <div className="px-2 py-1.5 text-sm font-semibold text-gray-500 uppercase">Conta</div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { logoutProfile(); navigate('/select-profile'); }} className="text-xs gap-2 rounded-lg">
                <Users className="h-3.5 w-3.5" /> Trocar Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings')} className="text-xs gap-2 rounded-lg">
                <SettingsIcon className="h-3.5 w-3.5" /> Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-xs gap-2 rounded-lg text-red-600"
                onClick={async () => {
                  logoutProfile();
                  try { await logout(); } catch { }
                  navigate('/login', { replace: true });
                }}
              >
                <LogOut className="h-3.5 w-3.5" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {/* Mobile Header */}
        <div className="md:hidden h-14 flex items-center justify-between px-4 border-b border-white/10 bg-[#0a0a0a] text-white shadow-md overflow-hidden relative">
          <div className="absolute right-[40px] top-[40%] -translate-y-1/2 pointer-events-none opacity-40 select-none">
            <span className="text-[140px] font-black italic text-[#3490c7] blur-[0.5px] leading-none block transform -skew-x-12" style={{ fontFamily: `'Poppins', sans-serif` }}>a</span>
          </div>
          <div className="relative flex items-center justify-between w-full h-full z-10">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-white/70 hover:text-white hover:bg-white/10" onClick={() => setMobileSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm border border-white/10">
                <Headphones className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-sm text-white tracking-wide">CRM</span>
              {totalUnread > 0 && (
                <span className="px-1.5 py-0.5 bg-green-500 text-white text-[9px] font-bold rounded-full shadow-sm">{totalUnread}</span>
              )}
            </div>
            <div className="w-8" />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
