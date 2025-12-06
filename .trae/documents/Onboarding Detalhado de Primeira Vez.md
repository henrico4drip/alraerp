## Objetivo
Criar um tutorial guiado, minucioso e contextual que orienta o usuário passo a passo nas ações essenciais (vender no Caixa, cadastrar produtos, imprimir etiquetas, ativar cashback, configurar emissão fiscal e conhecer planos), com persistência entre dispositivos.

## Conteúdo do Tutorial (Proposto)
1. Dashboard – Visão Geral
- Explica painéis de vendas, clientes e cashback
- CTA “Continuar”

2. Vender no Caixa
- Destacar o botão/aba “Caixa” na navegação inferior
- Passos: Abrir Caixa → Buscar/scanear produto → Definir quantidade/preço (se necessário) → Finalizar venda
- Dica: uso de leitor, atalhos de teclado, impressão de comprovante

3. Cadastrar Produto (Estoque)
- Destacar “Estoque”
- Passos: Novo Produto → Nome, Preço, Custo, Estoque → Código de barras (gerado se ausente) → Salvar
- Dica: categorias e impacto no PDV

4. Etiquetas
- No Estoque, abrir “Imprimir Etiquetas”
- Passos: Selecionar produtos → Quantidades → Tipo de folha (58mm/88mm/A4) → Margens → Parcelas → Imprimir
- Dica: layout premium, números do código de barras menores, preview e impressão

5. Cashback
- Destacar “Clientes” e o botão de campanha (ou card de Marketing)
- Explicar como ativar e configurar percentual → impacto na retenção
- Dica: relatórios de engajamento

6. Emissão Fiscal (Configurações)
- Destacar “Opções/Configurações”
- Passos: conectar SEFAZ/NFC-e, preencher dados, testar emissão
- Dica: logs e suporte

7. Planos
- Destacar “Planos”
- Explicar teste grátis de 7 dias sem cartão → assinatura após o trial
- Dica: anual com economia e comparativo

8. Encerramento
- CTA “Concluir” e opção “Pular”
- Link rápido para “Suporte” e WhatsApp

## Implementação Técnica
- Componente Onboarding v2
  - Modelo de passo: `{ id, title, body, selector, placement, nextId }`
  - Overlay semi-transparente + tooltip/acento visual ao redor do elemento alvo (`selector`)
  - Navegação: Próximo/Voltar/Pular/Concluir; indicador de progresso
  - Responsivo (mobile/desktop) e acessível (focus, aria)
- Alvos/Selectores
  - Caixa: `bottomNavItems` (ícone/label “Caixa”) → seletor estável (ex.: `[data-nav="cashier"]`)
  - Estoque, Clientes, Configurações, Planos: adicionar `data-nav` nas entradas para ancoragem
- Persistência
  - Local: `localStorage.onboarding_completed = true`
  - Remota: Supabase `settings.onboarding_completed = boolean`
  - Versão: `settings.onboarding_version = number` para futuras atualizações (mostrar apenas se versão mudou)
- Disparo
  - Renderizar no `Layout` quando `onboarding_completed` local e remoto estiverem falsos
  - Botão “Rever tutorial” em Configurações para resetar (`localStorage.removeItem`) e refazer
- Conteúdo detalhado
  - Escrever textos minuciosos para cada passo (curtos, objetivos, com micro-dicas)
  - Ícones e ilustrações leves para reforço visual
- Métricas
  - Eventos (início, passos, conclusão) para entender adesão (console/logs iniciais; opcional integração futura)

## Ajustes no Banco (Supabase)
- Tabela `public.settings` (do usuário)
  - Adicionar colunas: `onboarding_completed boolean default false`, `onboarding_version integer default 1`
  - Já usamos `trial_until timestamptz`; manter

## Critérios de Aceite
- Tutorial aparece apenas na primeira vez (ou quando atualizado)
- Cada passo aponta para o elemento correto com tooltip claro
- Pular/Concluir grava flags local e Supabase
- Mobile/desktop com legibilidade e sem interferir em ações
- Copy com instruções específicas (ex.: “Para vender, clique em Caixa”) e dicas úteis

## Próximo Passo
Aprovar o plano. Em seguida, implemento:
- Anchors `data-nav` nas entradas de navegação
- Onboarding v2 com passos e tooltips ancorados
- Persistência Supabase + reset em Configurações
- Textos finais dos passos
