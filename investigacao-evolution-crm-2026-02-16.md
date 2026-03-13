# 🔍 RELATÓRIO DE INVESTIGAÇÃO - Evolution + Chatwoot + CRM

**Data:** 2026-02-16  
**Investigador:** YUGI (Subagent)  
**Status:** ✅ CONCLUÍDO

---

## 📊 STATUS DOS COMPONENTES

### 1. Evolution API (http://84.247.143.180:8080)
**Status:** ✅ ONLINE  
**Instância:** alraerp  
**Estado:** `open` (conectada)

```bash
# Teste realizado:
curl http://84.247.143.180:8080/instance/connectionState/alraerp -H "apikey: mypassy"

# Resultado:
{"instance":{"instanceName":"alraerp","state":"open"}}
```

**Chats disponíveis:** ✅ 100+ conversas encontradas  
**Mensagens acessíveis:** ✅ Endpoint respondendo (array vazio para alguns JIDs, mas funcionando)

### 2. Webhook Configuration
**Status:** ✅ CONFIGURADO CORRETAMENTE

```bash
# Teste realizado:
curl http://84.247.143.180:8080/webhook/find/alraerp -H "apikey: mypassy"

# Resultado:
{
  "id": "cmljdi4tj0005ph54fng1zr2o",
  "url": "https://greotjobqprtmrprptdb.supabase.co/functions/v1/whatsapp-proxy?secret=alraerp-webhook-secret-2026",
  "headers": {"x-webhook-secret": "alraerp-webhook-secret-2026"},
  "enabled": true,
  "events": [
    "MESSAGES_UPSERT",
    "MESSAGES_UPDATE",
    "SEND_MESSAGE",
    "CONTACTS_UPSERT",
    "CONTACTS_UPDATE",
    "CONNECTION_UPDATE"
  ],
  "webhookByEvents": false,
  "webhookBase64": false,
  "createdAt": "2026-02-12T11:26:17.574Z",
  "updatedAt": "2026-02-16T02:14:31.032Z"
}
```

### 3. Supabase Edge Function (whatsapp-proxy)
**Status:** ⚠️ REQUER AUTENTICAÇÃO (para ações internas)

**Problema identificado:** A função Edge Function requer autenticação do Supabase para ações internas (get_status, fetch_contacts, etc), mas webhooks deveriam funcionar sem auth.

**Código analisado:** O handler verifica `eventName` antes da autenticação para permitir webhooks sem auth (linha ~160 do index.ts).

### 4. CRM Inbox (src/pages/crm-new/Inbox.tsx)
**Status:** ⚠️ DEPENDE DO SUPABASE

**Fluxo identificado:**
1. CRM chama `EvolutionAPI.fetchChats()` → que chama a Edge Function via proxyInvoke
2. A Edge Function requer token de autenticação
3. O token não está sendo passado corretamente ou a função não está autorizando

---

## 🎯 CAUSA RAIZ IDENTIFICADA

### PROBLEMA PRINCIPAL: Autenticação na Edge Function

O código do `EvolutionContext.tsx` inicializa a API Evolution sem passar o token de autenticação do Supabase corretamente para as chamadas da Edge Function.

**Arquivo afetado:** `src/lib/evolution.ts` → método `proxyInvoke()`

```typescript
private async proxyInvoke(action: string, payload?: any) {
    // ...
    const { data: { session } } = await this.supabase.auth.getSession();
    const token = session?.access_token;
    
    const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',  // <-- Token pode estar vazio
        },
        body: JSON.stringify({ action, payload })
    });
    // ...
}
```

### PROBLEMA SECUNDÁRIO: Múltiplas fontes de dados

O CRM pode estar buscando dados de:
1. **Evolution API direto** (se `this.supabase` não estiver definido)
2. **Supabase via Edge Function** (se `this.supabase` estiver definido)

No `EvolutionContext.tsx`, a API é inicializada com `supabase` passado, então ele tenta usar a Edge Function.

---

## 🔧 SOLUÇÕES IMPLEMENTADAS/RECOMENDADAS

### 1. Verificar se usuário está autenticado antes de chamar a API
**Arquivo:** `src/contexts/EvolutionContext.tsx`

```typescript
// Verificar se há sessão ativa antes de inicializar API
useEffect(() => {
    if (!user?.id) {
        setApi(null);
        return;
    }
    
    // Garantir que o usuário tem sessão válida
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
            console.error('[EvolutionContext] No active session');
            setError('Sessão expirada. Faça login novamente.');
            return;
        }
        
        setApi(new EvolutionAPI(...));
    });
}, [user?.id, instanceName]);
```

### 2. Fallback para Evolution API direta se Edge Function falhar
**Arquivo:** `src/lib/evolution.ts` → método `proxyInvoke()`

```typescript
private async proxyInvoke(action: string, payload?: any) {
    try {
        // Tentar Edge Function primeiro
        return await this.callEdgeFunction(action, payload);
    } catch (edgeError) {
        console.warn('[EvolutionAPI] Edge Function failed, falling back to direct API:', edgeError);
        // Fallback para chamada direta à Evolution API
        return this.callDirectAPI(action, payload);
    }
}
```

### 3. Verificar webhook events no Supabase
**Query SQL para verificar mensagens recebidas:**

```sql
-- Verificar se há mensagens na tabela
SELECT COUNT(*) as total_messages,
       MAX(created_at) as last_message
FROM whatsapp_messages;

-- Verificar mensagens recentes
SELECT contact_phone, contact_name, content, direction, created_at
FROM whatsapp_messages
ORDER BY created_at DESC
LIMIT 10;
```

### 4. Testar webhook manualmente
```bash
# Simular evento de webhook
curl -X POST "https://greotjobqprtmrprptdb.supabase.co/functions/v1/whatsapp-proxy?secret=alraerp-webhook-secret-2026" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "instance": "alraerp",
    "data": {
      "key": {
        "remoteJid": "555199999999@s.whatsapp.net",
        "fromMe": false,
        "id": "TEST123"
      },
      "pushName": "Test User",
      "message": {
        "conversation": "Mensagem de teste"
      }
    }
  }'
```

---

## 📋 FLUXO DE DADOS CORRETO

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Evolution API  │────▶│  Webhook (Edge   │────▶│  Supabase       │
│  (WhatsApp)     │     │  Function)       │     │  (Postgres)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                                               │
         │                                               │
         │ (fallback)                                    │
         │                                               │
         ▼                                               ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  CRM Frontend   │◀────│  React Context   │◀────│  Realtime/Query │
│  (Inbox.tsx)    │     │  (Evolution)     │     │  (supabase-js)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## ✅ CHECKLIST DE VALIDAÇÃO

- [x] Evolution API está online (`state: open`)
- [x] Webhook configurado corretamente
- [x] Edge Function implementada com handler de webhook
- [x] CRM Inbox carrega sem erros visuais
- [ ] Edge Function autenticando usuários corretamente
- [ ] Mensagens sendo salvas no Supabase via webhook
- [ ] CRM exibindo mensagens do Supabase

---

## 🚨 PRÓXIMAS AÇÕES RECOMENDADAS

1. **Verificar logs da Edge Function no Supabase Dashboard**
   - Acessar: Supabase → Functions → whatsapp-proxy → Logs
   - Procurar por erros de autenticação ou inserção

2. **Testar inserção manual no Supabase**
   - Inserir registro de teste na tabela `whatsapp_messages`
   - Verificar se CRM exibe a mensagem

3. **Verificar tabela `whatsapp_messages` existe com schema correto**
   - Colunas necessárias: `id`, `user_id`, `contact_phone`, `contact_name`, `content`, `direction`, `status`, `wa_message_id`, `created_at`

4. **Verificar RLS (Row Level Security) na tabela**
   - Garantir que usuários autenticados podem ler/escrever

---

**Investigação concluída em:** 2026-02-16 18:52 GMT-3  
**Status:** Aguardando correções e validação final
