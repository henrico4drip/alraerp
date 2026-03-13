---
description: Fix Chatwoot LID duplicate contacts by upgrading Evolution API and cleaning frontend workarounds
---

# Fix Chatwoot LID Contacts — Full Refactoring Plan

## Problema
A Evolution API v2.3.0 não resolve corretamente os LIDs (@lid) do WhatsApp para telefones reais,
criando contatos duplicados no Chatwoot (um com o telefone real, outro com o LID como número).

## Solução
1. Atualizar a Evolution API de 2.3.0 para 2.3.7 (fix nativo de LID)
2. Reconfigurar a integração Chatwoot na Evolution API
3. Limpar contatos duplicados existentes no Chatwoot
4. Remover todo código de workaround de LID do frontend ERP

## Etapas

### Etapa 1: Atualizar Evolution API (no servidor 84.247.143.180)
// turbo-all
```bash
# SSH no servidor
ssh root@84.247.143.180

# Verificar como a Evolution API está rodando (Docker ou PM2)
docker ps | grep evolution
# ou
pm2 list

# Se Docker:
docker pull atendai/evolution-api:v2.3.7
docker stop evolution-api
docker rm evolution-api
# Recriar com a mesma config mas nova imagem

# Se PM2/Node:
cd /path/to/evolution-api
git pull
git checkout v2.3.7
npm install
pm2 restart evolution-api
```

### Etapa 2: Reconfigurar Chatwoot na Evolution API
Após atualizar, reconfigurar via API:
```bash
curl -X POST http://84.247.143.180:8080/chatwoot/set/alraerp \
  -H "apikey: mypassy" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "accountId": "1",
    "token": "pgh3rRR6ZLirSnzdnuQZbhNV",
    "url": "http://rails:3000",
    "nameInbox": "WhatsApp",
    "importContacts": true,
    "importMessages": true,
    "daysLimitImportMessages": 365,
    "reopenConversation": true,
    "mergeBrazilContacts": true,
    "autoCreate": true,
    "signMsg": false,
    "conversationPending": false
  }'
```

### Etapa 3: Limpar contatos duplicados no Chatwoot
Pode ser feito via painel admin do Chatwoot ou via API merge.

### Etapa 4: Refatorar código frontend (este passo é feito aqui)
- ChatwootContext.tsx: remover toda lógica de LID (enrichment, merge, mapping)
- Inbox.tsx: simplificar resolução de nomes
- EvolutionContext.tsx: simplificar resolveName (remover LID map)
