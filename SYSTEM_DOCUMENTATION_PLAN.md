# 🗺️ Plano Mestre de Documentação do Sistema AlraERP+

Este documento esboça a estrutura da documentação completa do sistema, visando cobrir todos os módulos críticos além da integração com WhatsApp (já documentada).

---

## 📚 Estrutura Proposta

### 1. 📦 Gestão de Estoque (Inventory & Stock)
**Arquivo:** `INVENTORY_LOGIC.md`
- **Fluxo de Movimentação**: Lógica de Entrada/Saída e ajustes manuais.
- **Precificação**: Regras de Markup, Custo Médio e Preço de Venda.
- **Cadastro de Produtos**: Campos obrigatórios, sistema de códigos de barra e categorias.
- **Relatórios**: Lógica de cálculo de valor de estoque e itens parados.

### 2. 💰 Ponto de Venda e Vendas (Sales & POS)
**Arquivo:** `POS_AND_SALES.md`
- **Fluxo do Caixa**: Abertura, Sangria e Fechamento de caixa.
- **Processamento de Venda**:
    - Adição de itens ao carrinho.
    - Regras de desconto (Atacado vs Varejo).
    - Métodos de Pagamento e integrações (e.g., InfinitePay InfiniteTap).
- **Emissão**: Geração de comprovantes e integração com impressoras térmicas (se houver).

### 3. 📊 Dashboard Financeiro (Financial Core)
**Arquivo:** `FINANCIAL_CORE.md`
- **Cálculo de Receita**: Agregação de vendas diárias, semanais e mensais.
- **Gestão de Despesas**: Categorização de custos fixos e variáveis.
- **Lógica de Fechamento**: Como o sistema calcula o Lucro Líquido e o "Salário" dos sócios/proprietários.
- **Indicadores (KPIs)**: Fórmulas para Ticket Médio, CAC (se aplicável) e ROI.

### 4. 👥 Portal do Cliente e Fidelidade (Loyalty)
**Arquivo:** `CUSTOMER_PORTAL.md`
- **Engine de Cashback**: 
    - Regras de acúmulo (% por venda).
    - Regras de resgate e expiração.
- **Área do Cliente**:
    - Fluxo de Login (CPF/Telefone).
    - Visualização de saldo e histórico de compras.

### 5. ⚙️ Administração e Infraestrutura
**Arquivo:** `ADMIN_INFRA.md`
- **Autenticação**: RBAC (Role-Based Access Control) e gestão de usuários via Supabase.
- **Deploy**: Pipeline de CI/CD (GitHub > Vercel).
- **Banco de Dados**: Visão geral do Schema (Tabelas Relacionais Supabase).
- **Variáveis de Ambiente**: Lista de chaves críticas e seus propósitos.

---

## 🗓️ Cronograma de Execução

1.  **Fase 1 (Prioridade Alta)**: Documentar **Ponto de Venda e Vendas (`POS_AND_SALES.md`)** e **Dashboard Financeiro (`FINANCIAL_CORE.md`)**, pois são o coração do negócio.
2.  **Fase 2 (Médio Prazo)**: Documentar **Gestão de Estoque** e **Portal do Cliente**.
3.  **Fase 3 (Longo Prazo)**: Documentação técnica de **Infraestrutura** para novos desenvolvedores.

---
> *Este plano serve como guia vivo para garantir que o conhecimento do sistema não se perca e facilite a on-boarding de futuros colaboradores.*
