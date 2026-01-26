import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import {
  MessageCircle,
  Users,
  Filter,
  Zap,
  ArrowRight,
  CheckCircle2,
  BarChart3
} from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const features = [
  {
    icon: MessageCircle,
    title: "Inbox Unificado",
    description: "Todas as conversas do WhatsApp em um só lugar, com suporte a fotos, vídeos e áudios."
  },
  {
    icon: Users,
    title: "Gestão de Contatos",
    description: "Organize seus contatos com tags, notas e histórico completo de interações."
  },
  {
    icon: Filter,
    title: "Funil de Vendas",
    description: "Acompanhe leads através de estágios personalizáveis com drag-and-drop."
  },
  {
    icon: BarChart3,
    title: "Dashboard Analítico",
    description: "Métricas em tempo real sobre conversas, contatos e performance de vendas."
  },
  {
    icon: Zap,
    title: "Sincronização Automática",
    description: "Integração direta com Evolution API para sincronização em tempo real."
  },
  {
    icon: CheckCircle2,
    title: "WhatsApp Business",
    description: "Conecte seu WhatsApp Business via QR Code e comece a usar imediatamente."
  }
];

export default function Home() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/crm/inbox");
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/20" />
          <div className="h-4 w-32 rounded bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="relative container mx-auto px-4 py-20 lg:py-32">
          <div className="max-w-4xl mx-auto text-center">
            {/* Logo */}
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-primary/10 mb-8 shadow-elegant">
              <MessageCircle className="h-10 w-10 text-primary" />
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              CRM para{" "}
              <span className="text-primary">WhatsApp Business</span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Gerencie conversas, contatos e vendas em uma plataforma elegante e intuitiva.
              Integração direta com Evolution API.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="text-base px-8 shadow-lg hover:shadow-xl transition-all glow-primary"
                onClick={() => window.location.href = getLoginUrl()}
              >
                Começar Agora
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Tudo que você precisa para gerenciar seu WhatsApp
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Uma solução completa para transformar conversas em vendas
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-6 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-all hover:shadow-elegant"
            >
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>CRM WhatsApp Evolution · Integrado com Evolution API</p>
        </div>
      </footer>
    </div>
  );
}
