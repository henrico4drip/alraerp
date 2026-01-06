# ⚜️ Manifesto de Integração: Ecossistema WhatsApp AlraERP+

Este documento consolida a arquitetura, as diretrizes de segurança e os protocolos operacionais da integração de mensageria instantânea do **AlraERP+**, representando o estado da arte na fusão entre CRM, Inteligência Artificial e protocolos de comunicação descentralizados.

---

## 🏛️ 1. Arquitetura do Sistema: "A Ponte"

A integração não é apenas uma conexão direta; é um ecossistema trifásico projetado para alta disponibilidade e resiliência.

### 1.1. O Motor de Comunicação (Backend)
- **Engine**: WPPConnect Server (Custom Engine) operando em ambiente isolado (Docker).
- **Endpoint Primário**: `http://84.247.143.180:21465`
- **Protocolo**: REST API para orquestração e Webhooks (POST) para eventos assíncronos.

### 1.2. O Orquestrador Seguro (Middleware)
Implementado via **Supabase Edge Functions (Deno)**, o `whatsapp-proxy` atua como o cérebro da operação:
- **Segurança Blindada**: Ocultação total de segredos de API do cliente final. Toda comunicação é validada via Contexto de Autenticação Supabase RLS.
- **Normalização de Dados**: Tradução em tempo real de múltiplos schemas de mensagens (WPPConnect, Evolution API v2, Webhooks) para um formato proprietário AlraERP.
- **Resiliência Adaptativa**: Mecanismos de `Auto-Recovery` para timeouts (504) e renovação automática de sessões via UUID persistente.

### 1.3. A Camada de Interface (Frontend)
- **Realtime Sync**: Subscrição direta via Supabase Realtime, permitindo uma experiência de conversação "Zero Latency".
- **Estado Reativo**: Gerenciamento de cache global via TanStack Query, garantindo que o histórico de mensagens seja preservado entre navegações com custo mínimo de rede.

---

## 🔒 2. Camada de Privacidade 2.0 (Privacy Layer)

A privacidade do usuário é tratada como prioridade arquitetural, indo além de simples ocultação visual.

### 2.1. Filtros de Relevância
O sistema purifica o fluxo de informações, removendo ruído:
- **Exclusão de Grupos & Broadcasts**: Foco total no atendimento 1:1.
- **Detecção de Chats Trancados**: Integração com a funcionalidade de "Locked Chats" do WhatsApp nativo.

### 2.2. Ocultamento Dinâmico (Hide Mode)
O recurso **"Ocultar do CRM"** implementa uma "quarentena de dados":
- **Blacklist via Settings**: Números ocultados são armazenados no array de segurança do usuário.
- **Expurgo Ativo**: Uma vez ocultado, o Proxy executa um comando de `DELETE` imediato e recorrente em mensagens associadas àquele telefone, garantindo que dados confidenciais não persistam no servidor de CRM.

### 3. Intelligence Layer (IA Engine)

Cada mensagem recebida é processada por uma camada de inteligência baseada em **LLM (Gemini 1.5 Pro)**.

1.  **Ingestão de Lead**: Novos números são automaticamente convertidos em Leads no banco de dados.
2.  **Scoring Predictivo**: Análise de sentimento e intenção de compra geram um score de 0 a 100.
3.  **Sugestão de Resposta (Edit-Before-Send)**: A IA gera uma mensagem personalizada. O sistema utiliza um fluxo de "Cópia para Edição", onde o atendente clica em **"Enviar agora"** e a sugestão é carregada no input do chat (agora com redimensionamento automático para textos longos) para revisão humana final, evitando envios automáticos indesejados.

---

## 🛰️ 4. Fluxo Cross-Page e Convergência de Dados

### 4.1. Integração com Marketing (Recall)
O módulo de Marketing agora atua como um gerador de demanda ativo para o CRM:
- **Botões de Ação Direta**: Cards de oportunidades (Cashback/Inatividade) possuem botões que levam diretamente ao CRM.
- **Deep Linking**: A navegação transporta a intenção (Telefone + Mensagem de Lembrete Personalizada) para dentro da interface do chat.

### 4.2. Conversas Virtuais (Virtual Conversations)
Para resolver o "Cold Start Problem" (quando um cliente do Marketing nunca interagiu no WhatsApp):
- **Injeção de Contexto**: Se o CRM recebe uma solicitação de chat para um telefone sem histórico de mensagens, ele cria uma **Conversa Virtual Temporária**.
- **Identificação Imediata**: O sistema cruza o telefone com a base de clientes do ERP para exibir Nome, Foto e Dados de Vendas instantaneamente, eliminando a experiência de "Número Desconhecido".

### 4.3. Mapeamento Canônico
O CRM possui um resolvedor de identidade que traduz variações de números (com/sem 9º dígito) para garantir que a conversa correta seja carregada, independente do formato armazenado no cadastro do cliente.

---

## 🛠️ 5. Protocolo de Manutenção e Diagnóstico

### 5.1. Diagnóstico de Saúde (Health Check)
O sistema mantém logs auditáveis diretamente na porta segura do Proxy. Para verificar a saúde do sistema:
- Acessar o Painel de **Configurações > WhatsApp**.
- Consultar o **Log de Diagnóstico do Proxy** para visualizar timestamps de sucesso/erro de cada requisição.

### 5.2. Recuperação de Sessão
Em caso de desconexão (Status `NOTLOGGED`):
- O sistema tentará o `Auto-Reconnect` 3 vezes com segredos alternativos.
- Se persistir, o usuário deve utilizar o **Reset Total da Instância** para limpar o cache de sessão e gerar um novo QR Code baseado em sua identidade UUID única.

---

## 📈 6. Roadmap de Evolução
- [x] **v1.0 (Lançada)**: Sincronismo estável, Realtime e CRM Básico.
- [x] **v1.1 (Atual)**: Camada de Privacidade Premium, IA Lead Scoring e Dashboard de Configuração.
- [x] **v1.2 (Implementada)**: Integração Marketing-CRM, Interface de Chat Expansiva e Fluxo de Ranking de Leads.
- [ ] **v1.3 (Próxima)**: Suporte a arquivos multimídia e mensagens de voz transcritas por IA.
- [ ] **v1.5**: Automação total de pós-venda via fluxos conversacionais.

---
> **Audit Trail**: *Atualizado em 05 de Janeiro de 2026. Integração completa Marketing > CRM e UX aprimorada.*
