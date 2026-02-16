# Diagnóstico - Conversas não aparecem no CRM

## Data: 2025-02-16
## Problema: O CRM funciona (não desloga), mas as conversas do WhatsApp não estão sendo puxadas.

---

## ✅ ALTERAÇÕES REALIZADAS

### 1. Adicionado logs de debug em `~/Documents/ERP/src/lib/evolution.ts`
   - Logs na função `fetchChats()` para rastrear:
     - Instância sendo usada
     - Status das respostas da API
     - Quantidade de chats retornados
     - Estrutura dos dados

### 2. Adicionado logs de debug em `~/Documents/ERP/src/pages/crm-new/Inbox.tsx`
   - Logs na função `loadChats()` para verificar:
     - Se a função está sendo chamada
     - Se `api` e `isConnected` estão disponíveis
     - Quantidade de chats retornados
   - Logs no `useEffect` de `isConnected`
   - Logs no `filteredChats` useMemo
   - Logs de estado para rastrear mudanças

---

## 🔍 COMO VERIFICAR O PROBLEMA

### Passo 1: Abrir o Console do Navegador
1. Abra o CRM no navegador
2. Pressione `F12` para abrir as ferramentas de desenvolvedor
3. Vá na aba "Console"

### Passo 2: Procurar por logs
Procure pelos seguintes logs em ordem:

```
[Inbox] isConnected effect triggered. isConnected: true
[Inbox] isConnected is true, calling loadChats()...
[Inbox] loadChats called. api: true isConnected: true
[Inbox] Calling api.fetchChats()...
[EvolutionAPI] fetchChats: Starting fetch for instance: alraerp
[EvolutionAPI] fetchChats: Fetching contacts...
[EvolutionAPI] fetchChats: Contacts response: ...
[EvolutionAPI] fetchChats: Fetching chats from /chat/findChats/...
[EvolutionAPI] fetchChats: Chats response status: ...
[EvolutionAPI] fetchChats: Processed rawChats count: ...
[EvolutionAPI] Final processed inbox: X conversations.
[Inbox] fetchChats returned: X chats
[Inbox] Updating chats state from 0 to X
```

---

## 🚨 POSSÍVEIS PROBLEMAS E SOLUÇÕES

### PROBLEMA 1: `isConnected` está `false`
**Sintoma:** O log `[Inbox] isConnected effect triggered. isConnected: false` aparece

**Causa:** A API não está retornando o estado correto da instância

**Solução:**
1. Verificar se a instância `alraerp` existe na Evolution API
2. Verificar se a API está respondendo em `http://84.247.143.180:8080`
3. Verificar se a chave API `mypassy` está correta

### PROBLEMA 2: A API retorna vazio ou erro
**Sintoma:** Os logs da Evolution API mostram status 404, 401 ou array vazio

**Causa:** O endpoint `/chat/findChats/{instance}` pode ter mudado ou estar indisponível

**Solução:**
1. Verificar documentação da Evolution API v2.3.0
2. Testar endpoint alternativo: `/chat/findConversations/`
3. Verificar se a instância está conectada no painel da Evolution API

### PROBLEMA 3: Filtros removendo todas as conversas
**Sintoma:** A API retorna conversas mas `filteredChats` está vazio

**Causa:** O filtro `hiddenContacts` pode estar marcando todos como ocultos

**Solução temporária:**
No arquivo `Inbox.tsx`, altere o filtro para:
```typescript
filtered = filtered.filter(c => !hiddenContacts.includes(c.id || c.remoteJid));
// Temporariamente desativar este filtro
// filtered = chats; // Use isto para testar
```

### PROBLEMA 4: Formato de resposta inesperado
**Sintoma:** Os logs mostram "Chats response data keys" com valores inesperados

**Causa:** A API pode estar retornando dados em formato diferente do esperado

**Solução:**
Adicione mais fallbacks no `fetchChats()`:
```typescript
const rawChats = Array.isArray(rawChatsData) ? rawChatsData : 
    (rawChatsData?.records || 
     rawChatsData?.data || 
     rawChatsData?.chats ||
     rawChatsData?.conversations ||
     rawChatsData?.results ||
     Object.values(rawChatsData || {}));
```

---

## 🛠️ PRÓXIMOS PASSOS

1. **Abrir o CRM no navegador** e verificar os logs do console
2. **Identificar em qual etapa** o fluxo está falhando
3. **Aplicar a solução correspondente** baseada nos logs
4. Se necessário, **testar a API diretamente** usando curl ou Postman:

```bash
curl -X POST http://84.247.143.180:8080/chat/findChats/alraerp \
  -H "apikey: mypassy" \
  -H "Content-Type: application/json" \
  -d '{"where": {}, "limit": 1000}'
```

---

## 📋 RESUMO DOS ARQUIVOS MODIFICADOS

| Arquivo | Modificação |
|---------|-------------|
| `~/Documents/ERP/src/lib/evolution.ts` | Adicionados logs detalhados na função `fetchChats()` |
| `~/Documents/ERP/src/pages/crm-new/Inbox.tsx` | Adicionados logs em `loadChats()`, `useEffect` e `filteredChats` |

---

## 📝 NOTAS

- Os logs adicionados são temporários para diagnóstico
- Após resolver o problema, os logs podem ser removidos ou mantidos em nível 'debug'
- O problema mais provável é que a API está retornando dados em formato não esperado ou vazio
