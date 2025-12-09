import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
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
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [settings, setSettings] = useState(null);
  const [showNotif, setShowNotif] = useState(false);
  const [notifEntering, setNotifEntering] = useState(false);
  const [snippetIndex, setSnippetIndex] = useState(0);
  const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem('logo_url') || '/logo-fallback.svg');
  const [logoReady, setLogoReady] = useState(false);
  const imgRef = useRef(null);
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

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    initialData: [],
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const settingsList = await base44.entities.Settings.list();
      if (settingsList.length > 0) {
        const s = settingsList[0];
        setSettings(s);
        if (s.logo_url) {
          // Only trigger fade if the URL actually changed
          setLogoUrl((prev) => {
            if (prev !== s.logo_url) {
              setLogoReady(false);
              try { localStorage.setItem('logo_url', s.logo_url); } catch { }
              return s.logo_url;
            }
            // Same URL: ensure ready if already cached
            if (imgRef.current && imgRef.current.complete) {
              setLogoReady(true);
            }
            return prev;
          });
        }
      }
    };
    fetchSettings();
  }, []);

  // When logoUrl changes, if the image is already cached, mark as ready immediately
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      setLogoReady(true);
    }
  }, [logoUrl]);

  // Mostrar aviso após 3s e iniciar rotação dos snippets
  useEffect(() => {
    const showTimer = setTimeout(() => setShowNotif(true), 3000);

    // Pixel: CompleteRegistration
    const regCompleted = localStorage.getItem('registration_completed');
    if (regCompleted === 'true' && window.fbq) {
      window.fbq('track', 'CompleteRegistration');
      localStorage.removeItem('registration_completed');
    }

    return () => clearTimeout(showTimer);
  }, []);

  useEffect(() => {
    if (!showNotif) return;
    const rotation = setInterval(() => {
      setSnippetIndex((idx) => (idx + 1) % snippets.length);
    }, 6000);
    return () => clearInterval(rotation);
  }, [showNotif]);

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
    { label: "RESUMO", icon: FileText, link: createPageUrl("Sales"), from: "from-blue-100", to: "to-blue-200", iconColor: "text-blue-600" },
    { label: "PAGAMENTOS", icon: DollarSign, link: createPageUrl("Payments"), from: "from-emerald-100", to: "to-emerald-200", iconColor: "text-emerald-600" },
    { label: "+ CLIENTE", icon: Users, link: createPageUrl("Customers"), from: "from-gray-100", to: "to-gray-200", iconColor: "text-gray-700" },
    { label: "FATURAMENTO", icon: TrendingUp, link: createPageUrl("Reports"), from: "from-indigo-100", to: "to-indigo-200", iconColor: "text-indigo-600" },
  ];

  const currentSnippet = snippets[snippetIndex] || snippets[0];
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthSales = (sales || []).filter(s => s?.sale_date && new Date(s.sale_date) >= startOfMonth);
  const monthlyTotal = monthSales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
  const monthCustomerCounts = monthSales.reduce((m, s) => {
    const key = (s.customer_name || 'AVULSO');
    m[key] = (m[key] || 0) + 1;
    return m;
  }, {});
  const monthUniqueCustomers = Object.keys(monthCustomerCounts).length;
  const monthRepeatCustomers = Object.values(monthCustomerCounts).filter(c => c > 1).length;
  const retentionPercent = monthUniqueCustomers > 0 ? Math.round((monthRepeatCustomers / monthUniqueCustomers) * 100) : 0;

  return (
    <div className="bg-white p-4 w-full">
      <div className="max-w-4xl mx-auto w-full flex flex-col items-center transform -translate-y-[7px]">
        {/* Logo */}
        <div className="mb-6 flex items-center justify-center">
          <div className="relative group">
            <img
              ref={imgRef}
              src={logoUrl}
              alt="Logo"
              className={`w-auto object-contain transition-opacity duration-300 ${logoReady ? 'opacity-100' : 'opacity-0'}`}
              style={{ height: 'clamp(80px, 12vw, 150px)' }}
              loading="eager"
              decoding="async"
              fetchpriority="high"
              onLoad={() => setLogoReady(true)}
              onError={() => { setLogoUrl('/logo-fallback.svg'); setLogoReady(true); }}
              data-tutorial="dashboard-logo"
            />
            <label className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center bg-black/30 pointer-events-none group-hover:pointer-events-auto">
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <span className="text-white text-xs">Trocar logo</span>
            </label>
          </div>
        </div>

        {/* Ações em linha - exatamente 4 ícones */}
        <div className="flex items-center justify-center gap-6 sm:gap-10 py-2">
          {actions.map((a) => (
            <Link key={a.label} to={a.link} data-tutorial={a.label === 'PAGAMENTOS' ? 'dashboard-payments-button' : a.label === 'FATURAMENTO' ? 'dashboard-billing-button' : undefined}>
              <div className="flex flex-col items-center">
                <div
                  className={`rounded-2xl bg-gradient-to-br ${a.from} ${a.to} shadow-sm flex items-center justify-center`}
                  style={{ width: 'clamp(56px, 8vw, 85px)', height: 'clamp(56px, 8vw, 85px)' }}
                >
                  <a.icon className={`${a.iconColor}`} style={{ width: 'clamp(24px, 3vw, 40px)', height: 'clamp(24px, 3vw, 40px)' }} />
                </div>
                <div className="mt-2 text-[10px] sm:text-[12px] font-semibold text-gray-700 tracking-wide">{a.label}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Botão de configurações central */}
        <div className="flex justify-center pt-4">
          <Link to={createPageUrl("Settings")}>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-white hover:bg-gray-100 shadow border border-gray-200"
              style={{ width: 'clamp(36px, 4vw, 40px)', height: 'clamp(36px, 4vw, 40px)' }}
            >
              <SettingsIcon className="text-gray-600" style={{ width: 'clamp(16px, 2vw, 20px)', height: 'clamp(16px, 2vw, 20px)' }} />
            </Button>
          </Link>
        </div>
      </div>

      {/* Card de marketing movido para a página Marketing */}

    </div>
  );
}
