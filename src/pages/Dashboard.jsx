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
              try { localStorage.setItem('logo_url', s.logo_url); } catch {}
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
        try { localStorage.setItem('logo_url', file_url); } catch {}
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
              className={`h-[150px] w-auto object-contain transition-opacity duration-300 ${logoReady ? 'opacity-100' : 'opacity-0'}`}
              loading="eager"
              decoding="async"
              fetchpriority="high"
              height={150}
              onLoad={() => setLogoReady(true)}
              onError={() => { setLogoUrl('/logo-fallback.svg'); setLogoReady(true); }}
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
        <div className="flex items-center justify-center gap-10 py-2">
          {actions.map((a) => (
            <Link key={a.label} to={a.link}>
              <div className="flex flex-col items-center">
                <div className={`w-[85px] h-[85px] rounded-2xl bg-gradient-to-br ${a.from} ${a.to} shadow-sm flex items-center justify-center`}>
                  <a.icon className={`w-10 h-10 ${a.iconColor}`} />
                </div>
                <div className="mt-2 text-[12px] font-semibold text-gray-700 tracking-wide">{a.label}</div>
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
              className="w-10 h-10 rounded-full bg-white hover:bg-gray-100 shadow border border-gray-200"
            >
              <SettingsIcon className="w-5 h-5 text-gray-600" />
            </Button>
          </Link>
        </div>
      </div>

      <div className={`flex justify-center mt-3 mb-6 transform translate-y-[35px] transition-opacity duration-500 ${showNotif ? 'opacity-100' : 'opacity-0'}`}>
        <div className="bg-gray-50 border border-gray-200 rounded-lg shadow-sm px-4 py-2 text-[12px] text-gray-700 max-w-[560px] w-full">
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${snippetIndex * 100}%)` }}
            >
              {snippets.map((sn, idx) => (
                <div key={idx} className="min-w-full flex items-center justify-center">
                  <span className="font-medium text-gray-800">Cashback ativo {settings?.cashback_percentage ?? 0}%.</span>
                  <span className="ml-1">{sn.text}</span>
                  <a href={sn.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-[11px] text-gray-500 underline">{sn.source}</a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}