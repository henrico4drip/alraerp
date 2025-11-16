import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
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
  BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [settings, setSettings] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsList = await base44.entities.Settings.list();
        if (settingsList.length > 0) {
          setSettings(settingsList[0]);
        }
      } catch (error) {
        console.error("Erro ao carregar configurações:", error);
      }
    };
    fetchSettings();
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
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-100 flex">
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
              {allNavItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                    isActive(item.path)
                      ? "bg-blue-50 text-blue-600 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg"
              >
                <Menu className="w-5 h-5" />
              </Button>
              <Link to={createPageUrl("Dashboard")} className="hover:opacity-80 transition-opacity">
                <h1 className="text-lg font-semibold text-gray-900">
                  {settings?.erp_name || "Meu Negócio"} ERP
                </h1>
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 pb-20">
          {children}
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-30">
          <div className="grid grid-cols-4 max-w-7xl mx-auto">
            {bottomNavItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className={`flex flex-col items-center justify-center py-3 transition-colors ${
                  isActive(item.path)
                    ? "text-blue-600"
                    : "text-gray-500 hover:text-blue-500"
                }`}
              >
                <item.icon className="w-6 h-6 mb-1" />
                <span className="text-xs font-medium">{item.name}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
