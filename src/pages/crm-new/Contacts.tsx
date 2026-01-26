import { useState, useEffect } from "react";
import CRMLayout from "@/components/CRMLayout";
import { useEvolution } from "@/contexts/EvolutionContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Users, Phone, Mail, Building, Tag, MoreVertical, Loader2, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { formatPhoneNumber } from "@/lib/evolution";

export default function Contacts() {
  const { api, isConnected, instanceName, resolveName } = useEvolution();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleViewProfile = (contactId: string) => {
    // Navigate to Inbox with the contact selected and details tab active
    navigate(`/crm/inbox?contactId=${encodeURIComponent(contactId)}&tab=details`);
  };

  const handleSendMessage = (contactId: string) => {
    // Navigate to Inbox with the conversation selected via query param
    navigate(`/crm/inbox?contactId=${encodeURIComponent(contactId)}`);
  };

  const loadContacts = async () => {
    if (!api || !isConnected) return;
    setLoading(true);
    try {
      const response = await api.fetchContacts();
      const contactList = Array.isArray(response) ? response : (response as any)?.data || [];
      setContacts(contactList);
    } catch (error: any) {
      toast.error("Erro ao carregar contatos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, [api, isConnected]);

  const filteredContacts = contacts.filter(contact => {
    const jid = contact.id || contact.remoteJid;
    const name = resolveName(jid, contact.name || contact.pushName || jid);
    return name.toLowerCase().includes(searchQuery.toLowerCase()) || jid.includes(searchQuery);
  });

  return (
    <CRMLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Meus Contatos</h1>
            <p className="text-muted-foreground">
              Total de {contacts.length} contatos sincronizados na instância <strong>{instanceName}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2 shadow-sm" onClick={loadContacts} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
            <Button className="gap-2 shadow-lg shadow-primary/20">
              <Users className="h-4 w-4" />
              Novo Contato
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou empresa..."
            className="pl-10 h-12 bg-card border-border/50 shadow-sm transition-all focus:ring-2 focus:ring-primary/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="h-16 w-16 rounded-full border-4 border-primary/10 border-t-primary animate-spin" />
            <p className="font-medium text-muted-foreground">Sincronizando contatos do WhatsApp...</p>
          </div>
        ) : filteredContacts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContacts.map((contact) => {
              const jid = contact.id || contact.remoteJid;
              const name = resolveName(jid, contact.name || contact.pushName);
              const phone = formatPhoneNumber(jid);

              return (
                <Card key={contact.id} className="group hover:border-primary/50 transition-all hover:shadow-xl hover:shadow-primary/5 bg-card/50 backdrop-blur">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-14 w-14 ring-2 ring-background ring-offset-2 ring-offset-border/20 group-hover:ring-offset-primary/20 transition-all">
                          <AvatarImage src={contact.profilePictureUrl} />
                          <AvatarFallback className="bg-primary/5 text-primary text-xl font-bold">
                            {name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-bold text-lg leading-none mb-1">{name}</h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {phone}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-border/50">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building className="h-4 w-4" />
                        <span>Empresa não informada</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-none">Cliente</Badge>
                        <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-none">WhatsApp</Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-6">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs font-semibold py-5"
                        onClick={() => handleViewProfile(contact.id)}
                      >
                        Ver Perfil
                      </Button>
                      <Button
                        size="sm"
                        className="w-full text-xs font-semibold py-5 shadow-inner"
                        onClick={() => handleSendMessage(contact.id)}
                      >
                        Mensagem
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="h-20 w-20 rounded-3xl bg-muted flex items-center justify-center">
              <Users className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <div>
              <h3 className="text-xl font-bold italic">Nenhum contato encontrado</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Tente ajustar sua busca ou sincronize novamente para buscar novos contatos da sua conta WhatsApp.
              </p>
            </div>
            <Button onClick={loadContacts} variant="secondary">Sincronizar agora</Button>
          </div>
        )}
      </div>
    </CRMLayout>
  );
}
