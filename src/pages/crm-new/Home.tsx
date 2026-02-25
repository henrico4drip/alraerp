import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import CRMLayout from "@/components/CRMLayout";
import { useAuth } from "@/auth/AuthContext";
import { useEvolution } from "@/contexts/EvolutionContext";
import { useCrm } from "@/contexts/CrmContext";
import {
  MessageCircle, Users, Briefcase, Zap, TrendingUp, ArrowRight,
  Phone, Bell, Shield, BarChart3, CheckCircle2, Star
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { user } = useAuth();
  const { isConnected } = useEvolution();
  const { totalUnread } = useCrm();
  const navigate = useNavigate();

  // Auto-redirect logged-in users to inbox
  useEffect(() => {
    if (user) navigate("/crm/inbox", { replace: true });
  }, [user, navigate]);

  return (
    <CRMLayout>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-6 py-12 bg-gradient-to-br from-gray-50 via-white to-blue-50/30">
        {/* Hero */}
        <div className="text-center max-w-2xl mx-auto mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-xs font-semibold px-4 py-1.5 rounded-full mb-6 border border-blue-100">
            <Zap className="h-3.5 w-3.5" /> CRM Integrado com WhatsApp
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-4 tracking-tight leading-tight">
            Gerencie seus
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"> clientes</span>
          </h1>
          <p className="text-gray-500 text-base leading-relaxed max-w-lg mx-auto">
            Inbox inteligente, funil de vendas visual e gerenciamento completo de contatos — tudo integrado ao WhatsApp.
          </p>
          <div className="flex items-center justify-center gap-3 mt-8">
            <Button
              size="lg"
              className="rounded-2xl shadow-lg bg-blue-600 hover:bg-blue-700 px-6 font-semibold text-sm"
              onClick={() => navigate("/login")}
            >
              Começar Agora <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl w-full animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
          {[
            {
              icon: MessageCircle,
              title: "Inbox Unificado",
              desc: "Todas as conversas do WhatsApp em um só lugar, com notificações em tempo real.",
              gradient: "from-blue-500 to-indigo-500",
              bgLight: "bg-blue-50"
            },
            {
              icon: Briefcase,
              title: "Funil de Vendas",
              desc: "Kanban visual para acompanhar leads desde o primeiro contato até o fechamento.",
              gradient: "from-purple-500 to-pink-500",
              bgLight: "bg-purple-50"
            },
            {
              icon: Users,
              title: "Gestão de Contatos",
              desc: "Tags, notas, atribuição de responsáveis e histórico completo de interações.",
              gradient: "from-emerald-500 to-teal-500",
              bgLight: "bg-emerald-50"
            },
            {
              icon: Bell,
              title: "Notificações Inteligentes",
              desc: "Badges de mensagens não lidas como no WhatsApp. Nunca perca uma oportunidade.",
              gradient: "from-amber-500 to-orange-500",
              bgLight: "bg-amber-50"
            },
            {
              icon: Shield,
              title: "Multi-Perfil",
              desc: "Cada integrante da equipe com seu próprio login e visão personalizada.",
              gradient: "from-cyan-500 to-blue-500",
              bgLight: "bg-cyan-50"
            },
            {
              icon: BarChart3,
              title: "Relatórios",
              desc: "Acompanhe performance de vendas, volume de conversas e produtividade.",
              gradient: "from-rose-500 to-red-500",
              bgLight: "bg-rose-50"
            },
          ].map((feature, idx) => (
            <div
              key={idx}
              className={`p-5 rounded-2xl border border-gray-200/60 bg-white hover:shadow-lg transition-all duration-300 group cursor-default`}
            >
              <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-bold text-sm text-gray-900 mb-1">{feature.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* Connection Status */}
        <div className="mt-10 flex items-center gap-2 text-xs text-gray-400">
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-gray-300'}`} />
          <span>{isConnected ? 'WhatsApp conectado' : 'WhatsApp desconectado'}</span>
        </div>
      </div>
    </CRMLayout>
  );
}
