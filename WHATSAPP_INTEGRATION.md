# Documentação: Integração WhatsApp (WPPConnect & Supabase)

Esta documentação descreve a implementação técnica da integração de WhatsApp no sistema AlraERP, detalhando a jornada de desenvolvimento e a arquitetura final.

## 1. Visão Geral
A integração permite que o AlraERP envie e receba mensagens de WhatsApp em tempo real, gerencie conversas no CRM e automatize notificações de vendas/cashback.

### Stack Tecnológica
- **Frontend:** React + TanStack Query (gerenciamento de estado, cache e invalidação em tempo real).
- **Middleware:** Supabase Edge Functions (Deno) atuando como Proxy Seguro e Orquestrador de IA.
- **Backend WhatsApp:** WPPConnect Server rodando em Docker em VPS externa (Porta 21465).
- **Banco de Dados:** Supabase (PostgreSQL) com Realtime habilitado para mensagens.

---

## 2. Arquitetura de Comunicação

### O Proxy (`whatsapp-proxy`)
Para evitar exposição de tokens e permitir comunicação cross-origin (CORS) segura, a Edge Function:
1.  **Autenticação**: Valida o usuário via JWT do Supabase.
2.  **Segurança**: Injeta segredos (`WPPCONNECT_SECRET_KEY`) apenas no lado do servidor.
3.  **Resiliência**: Implementa timeouts internos e suporte híbrido a múltiplas APIs (WPPConnect e Evolution API).
4.  **Deduplicação**: Garante que mensagens idênticas (pelo ID do WhatsApp) não sejam salvas duas vezes.

### Realtime (Tempo Real)
O CRM utiliza o **Supabase Realtime** para escutar a tabela `whatsapp_messages`.
- Quando um Webhook insere uma mensagem, o Frontend recebe um sinal instantâneo.
- Isso elimina a necessidade de o usuário clicar em "Atualizar" para ver novas mensagens.

---

## 3. Desafios Superados (A Jornada)

Durante a implementação, resolvemos os seguintes pontos críticos:

### A. Porta de Serviço e IP (Jan/2026)
**Problema:** O servidor estava configurado para a porta 8080 (Evolution API), mas o serviço ativo era o WPPConnect na porta 21465.
**Solução:** Reconfiguração das variáveis de ambiente no Supabase e restauração da lógica compatível com a porta 21465.

### B. Estabilização de Timeouts (Erro 504)
**Problema:** Tentativas de gerar tokens com segredos errados faziam a função "travar", causando erros 504 (Gateway Timeout).
**Solução:** Implementação de `AbortController` com timeout de 5 segundos por tentativa de segredo e redução do limite de busca inicial de conversas.

### C. Privacidade e Filtros
**Problema:** Conversas trancadas (locked) e grupos poluíam o CRM.
**Solução:** Implementação de filtros inteligentes que detectam os campos `isLocked`, `archive` e `isGroup` diretamente na origem dos dados.

---

## 4. Funcionalidades Avançadas

### Camada de Privacidade (Locked Chats)
- **Hiding**: O sistema detecta chats marcados como "Locked" ou "Trancados" no celular.
- **Auto-Deletion**: Durante cada ciclo de sincronismo (30s), o Proxy identifica esses números e **remove** permanentemente qualquer mensagem deles do banco de dados do CRM, garantindo que não apareçam na lista.

### Auto-Lead e Análise de IA
Sempre que uma mensagem de um novo número chega:
1.  **Registro Automático**: O sistema cria um cliente como "Lead (Auto)" no CRM.
2.  **Análise de Sentimento/IA**: Dispara uma análise via Gemini para classificar a urgência e o interesse do cliente.

### Gestão via Terminal
O sistema agora possui capacidade de diagnóstico direto no servidor VPS via SSH, permitindo:
- Verificar status do Docker.
- Reiniciar o serviço `wpp-server`.
- Consultar logs de conexão diretamente no motor do WhatsApp.

---

## 5. Como Manter / Diagnosticar

### Procedimento de Reconexão
1.  Se o status marcar "Desconectado", clique em **Conectar**.
2.  Escaneie o QR Code. O nome da sessão agora utiliza o UUID completo do usuário para garantir isolamento total e segurança RLS.
3.  Use o botão **"Configurar Webhook"** após cada nova conexão para garantir o tempo real.

### Variáveis Críticas (Supabase Secrets)
- `WPPCONNECT_URL`: `http://84.247.143.180:21465`
- `WPPCONNECT_SECRET_KEY`: `THISISMYSECURETOKEN`

---

## 6. Próximos Passos
- [ ] Envio de anexos (PDF/Imagens).
- [ ] Listagem de contatos bloqueados.
- [ ] Dashboard de performance de atendimento.

---
*Documentação atualizada em 05/01/2026 para refletir a estabilização completa do motor de sincronismo.*
