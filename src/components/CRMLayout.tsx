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
          <div className="absolute right-[30px] top-1/2 -translate-y-[45%] pointer-events-none opacity-40 select-none transform -skew-x-12 blur-[0.4px]">
            <svg viewBox="4.8 15 6 5.8" className="h-[120px] w-auto">
              <path
                fill="#3490c7"
                fillRule="evenodd"
                d="M 8.152344 15.21875 L 8.152344 15.269531 L 8.257812 15.269531 L 8.257812 15.320312 L 8.359375 15.320312 L 8.359375 15.371094 L 8.460938 15.371094 L 8.460938 15.421875 L 8.511719 15.421875 L 8.511719 15.472656 L 8.5625 15.472656 L 8.5625 15.523438 L 8.664062 15.523438 L 8.664062 15.574219 L 8.714844 15.574219 L 8.714844 15.625 L 8.765625 15.625 L 8.765625 15.675781 L 8.816406 15.675781 L 8.839844 15.777344 L 8.890625 15.777344 L 8.917969 15.878906 L 8.96875 15.878906 L 8.992188 15.167969 L 10.648438 15.167969 L 10.648438 20.613281 L 8.992188 20.613281 L 8.992188 19.847656 L 8.941406 19.847656 L 8.941406 19.898438 L 8.890625 19.898438 L 8.882812 19.945312 C 8.867188 20 8.867188 20 8.839844 20.050781 L 8.789062 20.050781 L 8.789062 20.101562 L 8.738281 20.101562 L 8.738281 20.152344 L 8.6875 20.152344 L 8.6875 20.203125 C 8.597656 20.296875 8.496094 20.375 8.382812 20.433594 L 8.300781 20.480469 C 8.191406 20.535156 8.078125 20.570312 7.964844 20.605469 C 7.945312 20.609375 7.925781 20.613281 7.910156 20.621094 C 7.527344 20.730469 7.105469 20.71875 6.722656 20.636719 C 6.585938 20.601562 6.453125 20.558594 6.324219 20.511719 L 6.324219 20.460938 L 6.222656 20.460938 L 6.222656 20.410156 L 6.117188 20.410156 L 6.117188 20.359375 L 6.066406 20.359375 L 6.066406 20.304688 L 5.964844 20.304688 L 5.964844 20.253906 L 5.914062 20.253906 L 5.914062 20.203125 L 5.863281 20.203125 L 5.863281 20.152344 L 5.789062 20.152344 L 5.789062 20.101562 L 5.738281 20.101562 L 5.738281 20.050781 L 5.660156 20.050781 L 5.636719 19.949219 L 5.585938 19.949219 L 5.558594 19.847656 L 5.507812 19.847656 L 5.507812 19.796875 L 5.457031 19.796875 L 5.40625 19.644531 L 5.355469 19.644531 L 5.304688 19.492188 L 5.253906 19.492188 L 5.253906 19.390625 L 5.203125 19.390625 L 5.203125 19.289062 L 5.152344 19.289062 C 5.046875 19.023438 4.976562 18.753906 4.921875 18.476562 L 4.910156 18.402344 C 4.886719 18.242188 4.890625 18.082031 4.890625 17.917969 L 4.890625 17.863281 C 4.890625 17.582031 4.902344 17.320312 4.972656 17.050781 L 4.988281 16.996094 C 5.070312 16.65625 5.199219 16.316406 5.429688 16.042969 C 5.464844 16.003906 C 5.464844 16.003906 5.484375 15.929688 L 5.535156 15.929688 C 5.539062 15.917969 5.546875 15.902344 5.550781 15.886719 C 5.59375 15.8125 5.644531 15.761719 5.707031 15.699219 L 5.773438 15.632812 C 5.835938 15.578125 5.894531 15.539062 5.964844 15.5 L 6 15.460938 C 6.046875 15.417969 6.089844 15.394531 6.144531 15.367188 L 6.207031 15.335938 L 6.273438 15.308594 L 6.335938 15.277344 C 6.898438 15.019531 7.574219 15.015625 8.152344 15.21875 Z M 7.183594 16.6875 C 7.128906 16.726562 7.082031 16.769531 7.035156 16.820312 L 6.957031 16.847656 L 6.957031 16.898438 L 6.90625 16.898438 C 6.882812 16.9375 6.855469 16.980469 6.832031 17.023438 L 6.78125 17.097656 C 6.636719 17.320312 6.597656 17.570312 6.578125 17.832031 C 6.574219 18.117188 6.628906 18.371094 6.753906 18.628906 L 6.78125 18.679688 C 6.796875 18.714844 6.8125 18.746094 6.832031 18.78125 L 6.882812 18.78125 L 6.882812 18.832031 L 6.933594 18.832031 L 6.933594 18.882812 L 6.984375 18.882812 L 6.984375 18.933594 L 7.035156 18.933594 L 7.035156 18.984375 L 7.085938 18.984375 L 7.085938 19.035156 L 7.1875 19.035156 L 7.1875 19.085938 C 7.382812 19.195312 7.566406 19.238281 7.792969 19.246094 C 7.972656 19.246094 8.140625 19.203125 8.308594 19.136719 C 8.359375 19.105469 8.410156 19.070312 8.460938 19.035156 L 8.535156 18.984375 L 8.535156 18.933594 L 8.585938 18.933594 L 8.585938 18.882812 L 8.636719 18.882812 L 8.636719 18.832031 L 8.6875 18.832031 C 8.816406 18.695312 8.886719 18.535156 8.9375 18.355469 C 9.003906 18.042969 9.011719 17.675781 8.917969 17.371094 C 8.875 17.257812 8.824219 17.152344 8.765625 17.050781 L 8.714844 17.050781 L 8.664062 16.898438 L 8.613281 16.898438 L 8.613281 16.847656 L 8.5625 16.847656 L 8.5625 16.796875 L 8.484375 16.796875 L 8.484375 16.746094 L 8.410156 16.746094 L 8.410156 16.695312 L 8.308594 16.695312 L 8.308594 16.644531 L 8.207031 16.644531 L 8.207031 16.59375 C 7.875 16.484375 7.484375 16.507812 7.183594 16.6875 Z"
              />
            </svg>
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
