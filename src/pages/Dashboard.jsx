import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/api/supabaseClient";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Upload,
  FileText,
  DollarSign,
  Users,
  TrendingUp,
  Zap,
  Settings as SettingsIcon,
  MessageSquare,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RequirePermission from "@/components/RequirePermission";

export default function Dashboard() {
  return (
    <RequirePermission permission="dashboard">
      <DashboardContent />
    </RequirePermission>
  );
}

function DashboardContent() {
  const [settings, setSettings] = useState(null);
  const [showNotif, setShowNotif] = useState(false);
  const [snippetIndex, setSnippetIndex] = useState(0);
  const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem('logo_url') || '/logo-fallback.svg');
  const [logoReady, setLogoReady] = useState(false);
  const imgRef = useRef(null);
  const [crmUnreadCount, setCrmUnreadCount] = useState(0);

  const snippets = [
    {
      text: 'Cashback aumenta retenção e reduz custo de desconto. Clientes preferem recompensa contínua.',
      source: 'McKinsey',
      url: 'https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights/next-gen-loyalty',
    },
    {
      text: 'Programas de cashback elevam engajamento e recorrência. Incentivos simples melhoram lealdade.',
      source: 'Harvard Business Review',
      url: 'https://hbr.org/2014/10/the-truth-about-customer-loyalty',
    },
    {
      text: 'Cashback incentiva gasto incremental e satisfação. Benefício direto volta ao cliente.',
      source: 'ScienceDirect',
      url: 'https://www.sciencedirect.com/science/article/abs/pii/S0148296321008857',
    },
  ];

  const { data: sales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list('-created_date'),
    initialData: [],
  });

  const { data: settingsList = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Settings.list(),
    initialData: [],
  });

  useEffect(() => {
    if (!Array.isArray(settingsList) || settingsList.length === 0) return;
    const s = settingsList[0];
    setSettings(s);
    if (s?.logo_url) {
      setLogoUrl((prev) => {
        if (prev !== s.logo_url) {
          setLogoReady(false);
          try { localStorage.setItem('logo_url', s.logo_url); } catch { }
          return s.logo_url;
        }
        return prev;
      });
    }
  }, [settingsList]);

  useEffect(() => {
    const showTimer = setTimeout(() => setShowNotif(true), 3000);
    return () => clearTimeout(showTimer);
  }, []);

  useEffect(() => {
    if (!showNotif) return;
    const rotation = setInterval(() => {
      setSnippetIndex((idx) => (idx + 1) % snippets.length);
    }, 6000);
    return () => clearInterval(rotation);
  }, [showNotif]);

  useEffect(() => {
    const fetchUnread = async () => {
      if (!supabase) return;
      try {
        const { count, error } = await supabase
          .from('whatsapp_messages')
          .select('*', { count: 'exact', head: true })
          .eq('direction', 'inbound')
          .eq('is_read', false);
        if (!error) setCrmUnreadCount(count || 0);
      } catch (e) { }
    };
    fetchUnread();

    const channel = supabase ? supabase.channel('dashboard-crm-unread')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages' }, () => fetchUnread())
      .subscribe() : null;

    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        if (settings) {
          await base44.entities.Settings.update(settings.id, { logo_url: file_url });
          setSettings({ ...settings, logo_url: file_url });
        } else {
          const created = await base44.entities.Settings.create({ logo_url: file_url });
          setSettings(created);
        }
        try { localStorage.setItem('logo_url', file_url); } catch { }
        setLogoReady(false);
        setLogoUrl(file_url);
      } catch (error) {
        console.error("Erro ao fazer upload:", error);
      }
    }
  };

  const actions = [
    { label: "RESUMO", icon: FileText, link: createPageUrl("Sales"), from: "from-gray-50", to: "to-gray-100", iconColor: "text-blue-600" },
    { label: "PAGAMENTOS", icon: DollarSign, link: createPageUrl("Payments"), from: "from-gray-50", to: "to-gray-100", iconColor: "text-green-600" },
    { label: "+ CLIENTE", icon: Users, link: createPageUrl("Customers"), from: "from-gray-50", to: "to-gray-100", iconColor: "text-gray-600" },
    { label: "CRM", icon: MessageSquare, link: createPageUrl("CRM"), from: "from-gray-50", to: "to-gray-100", iconColor: "text-[#3490c7]", unread: crmUnreadCount },
    { label: "FATURAMENTO", icon: TrendingUp, link: createPageUrl("Reports"), from: "from-gray-50", to: "to-gray-100", iconColor: "text-indigo-600" },
  ];

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
  const monthSales = (sales || []).filter(s => s?.sale_date && new Date(s.sale_date) >= startOfMonth && new Date(s.sale_date) <= endOfMonth);
  const monthlyTotal = monthSales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);

  const monthReceivables = (sales || []).reduce((acc, s) => {
    if (!s.payments || !Array.isArray(s.payments)) return acc;
    const carne = s.payments.filter(p => p.method === 'Carnê' && Array.isArray(p.schedule));
    let total = 0;
    carne.forEach(p => p.schedule.forEach(inst => {
      if (inst.status !== 'paid' && inst.due_date) {
        const d = new Date(inst.due_date);
        if (d >= startOfMonth && d <= endOfMonth) total += Number(inst.amount || 0);
      }
    }));
    return acc + total;
  }, 0);

  const monthUniqueCustomers = Object.keys(monthSales.reduce((m, s) => {
    m[s.customer_name || 'AVULSO'] = true;
    return m;
  }, {})).length;

  return (
    <div className="bg-white p-4 w-full">
      <div className="max-w-4xl mx-auto w-full flex flex-col items-center transform -translate-y-[7px]">
        <div className="mb-6 flex items-center justify-center">
          {(() => {
            const hasLogo = Boolean((settings?.logo_url) || (logoUrl && logoUrl !== '/logo-fallback.svg'));
            return hasLogo ? (
              <img
                ref={imgRef}
                src={(settings?.logo_url) || logoUrl}
                alt="Logo"
                className={`w-auto object-contain transition-opacity duration-300 ${logoReady ? 'opacity-100' : 'opacity-0'}`}
                style={{ height: 'clamp(80px, 12vw, 150px)' }}
                onLoad={() => setLogoReady(true)}
                onError={() => setLogoReady(true)}
              />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Button variant="outline" className="rounded-2xl h-12 px-8 bg-white" onClick={() => document.getElementById('logoInputDash')?.click()}>Inserir logo</Button>
                <input id="logoInputDash" type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </div>
            );
          })()}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-8 py-2">
          {actions.map((a) => {
            let val = '';
            if (a.label === 'RESUMO') val = monthSales.length;
            else if (a.label === 'PAGAMENTOS') val = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(monthReceivables);
            else if (a.label === '+ CLIENTE') val = monthUniqueCustomers;
            else if (a.label === 'FATURAMENTO') val = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(monthlyTotal);
            else if (a.label === 'CRM') val = 'Abrir';

            const Icon = a.icon;

            return (
              <Link key={a.label} to={a.link}>
                <div className="flex flex-col items-center">
                  <div className={`rounded-2xl bg-gradient-to-br ${a.from} ${a.to} shadow-sm flex flex-col items-center justify-center p-1 text-center relative`} style={{ width: 'clamp(64px, 10vw, 95px)', height: 'clamp(64px, 10vw, 95px)' }}>
                    <Icon className={`${a.iconColor} mb-0.5`} style={{ width: 'clamp(20px, 3vw, 28px)', height: 'clamp(20px, 3vw, 28px)' }} />
                    {a.unread > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[8px] text-white flex items-center justify-center font-bold">{a.unread}</span>
                      </span>
                    )}
                    <div className="flex flex-col leading-none gap-1">
                      <span className="text-[7px] sm:text-[9px] font-medium text-gray-600 uppercase">{a.label === 'RESUMO' ? 'Vendas' : a.label === 'PAGAMENTOS' ? 'Receber' : a.label === '+ CLIENTE' ? 'Novos' : a.label === 'FATURAMENTO' ? 'Total' : 'Chat'}</span>
                      <span className={`text-[9px] sm:text-[11px] font-extrabold ${a.iconColor} truncate max-w-[58px] sm:max-w-[80px]`}>{val}</span>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] sm:text-[12px] font-semibold text-gray-700">{a.label}</div>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="flex justify-center pt-4">
          <Link to={createPageUrl("Settings")}>
            <Button variant="ghost" size="icon" className="rounded-full bg-white shadow border border-gray-200" style={{ width: 'clamp(36px, 4vw, 40px)', height: 'clamp(36px, 4vw, 40px)' }}>
              <SettingsIcon className="text-gray-600" style={{ width: 'clamp(16px, 2vw, 20px)', height: 'clamp(16px, 2vw, 20px)' }} />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
