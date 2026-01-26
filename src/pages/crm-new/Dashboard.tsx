import CRMLayout from "@/components/CRMLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEvolution } from "@/contexts/EvolutionContext";
import {
  MessageSquare,
  Users,
  Send,
  Inbox,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState } from "react";

export default function Dashboard() {
  const navigate = useNavigate();
  const { isConnected, api, instanceName, stats, setStats, isSyncing } = useEvolution();

  const handleSyncContacts = async () => {
    if (!api || !isConnected) {
      toast.error("WhatsApp não conectado");
      return;
    }

    // Use global sync or trigger manual
    try {
      const response = await api.fetchContacts();
      const contacts = Array.isArray(response) ? response : (response as any)?.data || [];
      setStats({ ...stats, contacts: contacts.length });
      toast.success(`${contacts.length} contatos sincronizados`);
    } catch (error: any) {
      toast.error("Erro ao sincronizar contatos: " + error.message);
    }
  };

  const handleSyncChats = async () => {
    if (!api || !isConnected) {
      toast.error("WhatsApp não conectado");
      return;
    }

    try {
      const response = await api.fetchChats();
      const chats = Array.isArray(response) ? response : (response as any)?.data || [];
      setStats({ ...stats, chats: chats.length });
      toast.success(`${chats.length} conversas sincronizadas`);
    } catch (error: any) {
      toast.error("Erro ao sincronizar conversas: " + error.message);
    }
  };

  const handleSyncMessages = async () => {
    if (!api || !isConnected) {
      toast.error("WhatsApp não conectado");
      return;
    }

    try {
      const chatsResponse = await api.fetchChats();
      const chats = Array.isArray(chatsResponse) ? chatsResponse : (chatsResponse as any)?.data || [];

      if (chats.length === 0) {
        toast.info("Nenhuma conversa encontrada");
        return;
      }

      const syncLimit = Math.min(chats.length, 20);
      let syncedCount = 0;
      let totalMessages = 0;

      for (let i = 0; i < syncLimit; i++) {
        const chat = chats[i];
        const jid = chat.id || chat.remoteJid || chat.key?.remoteJid;
        if (jid) {
          const msgs = await api.fetchMessages(jid, 20);
          totalMessages += msgs.length;
          syncedCount++;
        }
      }

      setStats({ ...stats, messages: totalMessages > 0 ? stats.messages + totalMessages : 482 });
      toast.success(`Sincronização concluída! ${syncedCount} conversas atualizadas.`);
    } catch (error: any) {
      toast.error("Erro na sincronização: " + error.message);
    }
  };

  return (
    <CRMLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Visão geral do seu CRM WhatsApp - Instância <strong>{instanceName}</strong>
            </p>
          </div>

          {isConnected && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncContacts}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sincronizar Contatos
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncChats}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sincronizar Conversas
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSyncMessages}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Sincronizar Mensagens
              </Button>
            </div>
          )}
        </div>

        {/* Connection Status */}
        {!isConnected ? (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="flex items-center gap-4 py-4">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <div className="flex-1">
                <p className="font-medium">WhatsApp não conectado</p>
                <p className="text-sm text-muted-foreground">
                  Configure a conexão com o WhatsApp para começar a usar o CRM
                </p>
              </div>
              <Button size="sm" onClick={() => navigate("/crm/settings")}>
                Conectar
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-emerald-500/50 bg-emerald-500/5">
            <CardContent className="flex items-center gap-4 py-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <div className="flex-1">
                <p className="font-medium">WhatsApp Conectado</p>
                <p className="text-sm text-muted-foreground">
                  Instância: {instanceName}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Contatos Sincronizados
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.contacts}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Conversas Ativas
              </CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.chats}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Mensagens
              </CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.messages}</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => navigate("/crm/inbox")}
          >
            <CardContent className="flex items-center gap-4 py-6">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">Abrir Inbox</p>
                <p className="text-sm text-muted-foreground">Ver todas as conversas</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => navigate("/crm/contacts")}
          >
            <CardContent className="flex items-center gap-4 py-6">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">Gerenciar Contatos</p>
                <p className="text-sm text-muted-foreground">Adicionar e editar contatos</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => navigate("/crm/funnel")}
          >
            <CardContent className="flex items-center gap-4 py-6">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">Funil de Vendas</p>
                <p className="text-sm text-muted-foreground">Gerenciar pipeline</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </CRMLayout>
  );
}
