# Documentação: Integração WhatsApp (WPPConnect & Supabase)

Esta documentação descreve a implementação técnica da integração de WhatsApp no sistema AlraERP, detalhando a jornada de desenvolvimento e a arquitetura final.

## 1. Visão Geral
A integração permite que o AlraERP envie e receba mensagens de WhatsApp em tempo real, gerencie conversas no CRM e automatize notificações de vendas/cashback.

### Stack Tecnológica
- **Frontend:** React + TanStack Query (para gerenciamento de estado e cache).
- **Middleware:** Supabase Edge Functions (Deno) atuando como Proxy Seguro.
- **Backend WhatsApp:** WPPConnect Server rodando em Docker em VPS externa.
- **Banco de Dados:** Supabase (PostgreSQL) para persistência de mensagens e logs.

---

## 2. Arquitetura de Comunicação

### O Proxy (`whatsapp-proxy`)
Para evitar exposição de tokens e permitir comunicação cross-origin (CORS) segura, criamos uma Edge Function no Supabase que:
1. Autentica o usuário via JWT do Supabase.
2. Traduz as requisições do sistema para o formato esperado pelo WPPConnect.
3. Mantém a segurança injetando a `WPPCONNECT_SECRET_KEY` apenas no lado do servidor.

---

## 3. Desafios e Soluções (A Jornada)

Durante a implementação, enfrentamos e resolvemos os seguintes pontos críticos:

### A. Compatibilidade de API (404 Not Found)
**Problema:** Diferentes versões do WPPConnect/Evolution API possuem rotas distintas para configurar Webhooks e listar chats.
**Solução:** Implementamos uma lógica de **"Tenta de Tudo"** (Resilient Fetch). A função de configuração de Webhook tenta 5 rotas diferentes sequencialmente até obter sucesso (Evolution v2 routes -> WPPConnect legacy routes -> Webhook explicit updates).

### B. Tratamento de Estados Legacy
**Problema:** O servidor retornava estados como `QRCODE` ou `NOTLOGGED` que o frontend não reconhecia, resultando em telas travadas.
**Solução:** Mapeamos todos os estados do WPPConnect para o ciclo de vida do componente React, garantindo que o QR Code seja exibido sempre que necessário.

### C. Erros de Formatação (Espaços em URLs)
**Problema:** Bugs sutis de sintaxe injetaram espaços em branco nas URLs de API, causando falhas de conexão intermitentes.
**Solução:** Revisão completa e normalização das `Template Strings` nas chamadas de sistema.

---

## 4. Funcionalidades de Sincronismo

### Webhooks (Sincronismo Passivo)
O sistema configura automaticamente um Webhook no WPPConnect que aponta para o Supabase. Sempre que uma mensagem chega, o WPPConnect avisa o Proxy, que salva a mensagem diretamente na tabela `whatsapp_messages`.

### Auto-Sync Recente (Sincronismo Ativo)
**Inovação:** Implementamos um "Worker" no frontend do CRM que executa a cada **30 segundos**.
- Ele busca apenas os últimos **10 contatos** ativos no WhatsApp.
- Compara com o banco de dados e importa mensagens faltantes.
- Isso garante que, mesmo se o Webhook falhar ou o servidor de WhatsApp cair momentaneamente, o CRM se recupere sozinho.

### Importação de Histórico
Permite ao usuário puxar as últimas 50 conversas completas para popular o CRM na primeira conexão.

---

## 5. Como Manter / Diagnosticar

### Logs de Diagnóstico
Na aba de Configurações do WhatsApp, existe uma seção de logs em tempo real que mostra exatamente o que o Proxy está recebendo do servidor.

### Fluxo de Reconexão
1. Clique em "Reset Total" se a instância travar.
2. Gere um novo QR Code.
3. **Crucial:** Assim que conectar, clique em **"Configurar Webhook Automático"** para garantir o recebimento em tempo real.

---

## 6. Próximos Passos
- Implementação de suporte para envio de imagens.
- Suporte para grupos (atualmente filtrado para foco em CRM individual).
- Dashboard de métricas de mensagens enviadas/recebidas.

---
*Documentação gerada em 31/12/2024 após a estabilização da integração WPPConnect.*
