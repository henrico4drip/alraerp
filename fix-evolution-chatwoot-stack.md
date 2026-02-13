# 🔧 Configuração da Stack: Evolution API + Chatwoot + ERP

**Última Atualização:** 13 de Fevereiro de 2026  
**Servidor:** 84.247.143.180  
**SSH:** `sshpass -p 'Henrico9516' ssh root@84.247.143.180`

---

## 📋 Arquitetura Atual

```
┌──────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  WhatsApp        │     │    EVOLUTION API      │────►│   CHATWOOT      │
│  (Usuário)       │◄───►│    v2.3.0 :8080       │     │   v3.3.1 :3000  │
│                  │     │    Instance: alraerp   │     │   Account: 1    │
└──────────────────┘     └──────────┬─────────────┘     └─────────────────┘
                                   │ Webhook
                                   ▼
                         ┌──────────────────────┐
                         │  SUPABASE PROXY      │
                         │  whatsapp-proxy v3   │
                         │  → Salva no Supabase │
                         └──────────┬───────────┘
                                   │
                                   ▼
                         ┌──────────────────────┐
                         │  ERP (React App)     │
                         │  CRM + IA Analysis   │
                         └──────────────────────┘
```

---

## 🔑 Credenciais

| Item | Valor |
|------|-------|
| **Evolution API Key** | `mypassy` |
| **Chatwoot Account ID** | `1` |
| **Chatwoot Token** | `pgh3rRR6ZLirSnzdnuQZbhNV` |
| **Instance Name** | `alraerp` |
| **Chatwoot Login** | `henrico.pierdona@gmail.com` / `Henrico9516` |
| **SSH** | `root@84.247.143.180` / `Henrico9516` |

---

## 🔧 Status dos Serviços

| Serviço | Status | Porta |
|---------|--------|-------|
| Evolution API v2.3.0 | ✅ Online | 8080 |
| Chatwoot v3.3.1 | ✅ Online | 3000 |
| PostgreSQL 15 | ✅ Online | 5432 |
| Redis 6.2 | ✅ Online | 6379 |

---

## ⚙️ Configuração da Instância `alraerp`

### Settings
```json
{
  "syncFullHistory": true,
  "groupsIgnore": true,
  "readMessages": false,
  "readStatus": false,
  "alwaysOnline": false,
  "rejectCall": false
}
```

### Integração Chatwoot (Nativa)
```json
{
  "enabled": true,
  "accountId": "1",
  "token": "pgh3rRR6ZLirSnzdnuQZbhNV",
  "url": "http://rails:3000",
  "signMsg": false,
  "reopenConversation": true,
  "conversationPending": false,
  "importContacts": true,
  "importMessages": true,
  "daysLimitImportMessages": 365,
  "nameInbox": "WhatsApp",
  "mergeBrazilContacts": true,
  "autoCreate": true
}
```

### Webhook (ERP/Supabase)
```json
{
  "url": "https://greotjobqprtmrprptdb.supabase.co/functions/v1/whatsapp-proxy",
  "events": [
    "MESSAGES_UPSERT",
    "MESSAGES_UPDATE",
    "SEND_MESSAGE",
    "CONTACTS_UPSERT",
    "CONTACTS_UPDATE",
    "CONNECTION_UPDATE"
  ]
}
```

---

## 🚀 Como Conectar o WhatsApp

### Pelo ERP (Recomendado)
1. Acesse **Configurações > WhatsApp** no ERP
2. Clique em **"Gerar QR Code"**
3. Escaneie o QR Code com o celular (WhatsApp > Aparelhos Conectados > Conectar)
4. Aguarde a sincronização automática (pode levar alguns minutos para histórico)

### Via API direta
```bash
# Gerar QR Code
curl -s -H "apikey: mypassy" http://84.247.143.180:8080/instance/connect/alraerp

# Verificar status
curl -s -H "apikey: mypassy" http://84.247.143.180:8080/instance/connectionState/alraerp
```

---

## 📥 O que acontece ao conectar

1. **Evolution API** conecta ao WhatsApp via Baileys
2. **`syncFullHistory: true`** → Puxa TODO o histórico de mensagens do celular
3. **Chatwoot Integration** → Automaticamente importa:
   - ✅ Contatos (com merge de números brasileiros)
   - ✅ Mensagens dos últimos 365 dias
   - ✅ Cria inbox "WhatsApp" automaticamente
4. **Webhook → Supabase** → Cada nova mensagem é salva no banco do ERP
   - ✅ Mensagens recebidas (inbound)
   - ✅ Mensagens enviadas (outbound) ← NOVO: agora salva também!
   - ✅ Para análise com IA
   - ✅ Para exibição no CRM do ERP

---

## ⚠️ IMPORTANTE: Correções Aplicadas (13/02/2026)

### 1. Instância unificada como `alraerp`
- **Antes:** ERP usava `erp_USERID` (instância dinâmica por user)
- **Depois:** ERP agora usa `alraerp` (instância fixa com Chatwoot configurado)
- **Arquivos alterados:** `EvolutionContext.tsx`, `whatsapp-proxy/index.ts`, `.env`

### 2. API Key corrigida para `mypassy`
- **Antes:** ERP usava fallback `Henrico9516` (incorreto)
- **Depois:** Usa `mypassy` (API key real da Evolution no Docker)

### 3. `sync_history` implementada no proxy
- **Antes:** O botão "Sincronizar Agora" chamava `sync_history` mas a action não existia
- **Depois:** Implementado: puxa até 100 chats recentes com 50 msgs cada e salva no Supabase

### 4. Mensagens `fromMe` agora salvas
- **Antes:** Webhook ignorava `data.key.fromMe` (mensagens enviadas perdidas)
- **Depois:** Salva ambos inbound e outbound com direction correto

### 5. Webhook atualizado com todos os eventos
- **Antes:** Faltavam `SEND_MESSAGE`, `CONTACTS_UPSERT`, `CONTACTS_UPDATE`
- **Depois:** Todos os 6 eventos configurados

---

## 🚫 N8N (Desativado)

O N8N foi removido do fluxo para evitar duplicação de mensagens.
A integração nativa Evolution→Chatwoot substitui completamente o workflow N8N.

---

## 🔧 Docker Compose Path
```
/opt/chatwoot_stack/docker-compose.yml
```

## 📜 Comandos de Manutenção

```bash
# SSH
sshpass -p 'Henrico9516' ssh root@84.247.143.180

# Verificar containers
docker ps --format '{{.Names}}\t{{.Status}}'

# Reiniciar Evolution apenas
cd /opt/chatwoot_stack && docker compose up -d evolution

# Logs da Evolution
docker logs -f chatwoot_stack-evolution-1 --tail 50

# Logs do Chatwoot
docker logs -f chatwoot_stack-rails-1 --tail 50

# Status da instância via API
curl -s -H "apikey: mypassy" http://84.247.143.180:8080/instance/connectionState/alraerp

# Verificar mensagens no Chatwoot via API
curl -s -H "api_access_token: pgh3rRR6ZLirSnzdnuQZbhNV" 'http://84.247.143.180:3000/api/v1/accounts/1/conversations?page=1'
```

## 🔑 Variáveis de Ambiente (.env do ERP)

```env
# Evolution API (WhatsApp)
VITE_EVOLUTION_API_URL=http://84.247.143.180:8080
VITE_EVOLUTION_API_KEY=mypassy
VITE_EVOLUTION_INSTANCE=alraerp
```
