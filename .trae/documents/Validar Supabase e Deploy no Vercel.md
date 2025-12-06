## Objetivos da Validação
- Garantir que o front em Vercel está usando o projeto Supabase correto e as variáveis de ambiente estão setadas.
- Confirmar que o fluxo de login/social e trial funciona em produção.
- Verificar Stripe (Checkout, Portal e Webhook) e redirecionamentos.
- Checar políticas e configuração do Supabase (RLS, Site URL, Providers).

## Checagens de Ambiente (Vercel)
- Confirmar variáveis:
  - `VITE_SUPABASE_URL` = `https://<ref>.supabase.co` do projeto correto.
  - `VITE_SUPABASE_ANON_KEY` = chave ANON do mesmo projeto Supabase.
  - `VITE_API_URL` = URL do backend (Render).
  - `VITE_STRIPE_PUBLISHABLE_KEY` = `pk_live_...`.
- Executar redeploy no Vercel após salvar envs.
- Verificar que `vercel.json` contém rewrite SPA (já adicionado): fallback para `/`.

## Supabase Configurações
- URL Configuration:
  - `Site URL` = domínio de produção (Vercel).
  - `Additional Redirect URLs`: incluir o domínio de produção e rotas relevantes (ex.: `/dashboard`).
- Providers (Google/Facebook/Apple):
  - Habilitar e preencher credenciais.
  - Incluir `https://<ref>.supabase.co/auth/v1/callback` nos consoles dos provedores.
- RLS & Policies:
  - Confirmar políticas como `sales_update_own` (linha citada) aplicadas e em conformidade com o schema.
  - Verificar que as tabelas e schemas existem no projeto atual do Supabase.

## Fluxos do Frontend
- Login:
  - Email/Senha: campos em branco; login leva a `/dashboard`.
  - Social (Google/Apple/Facebook): fluxo OAuth retorna autenticado para `/dashboard`.
- Trial:
  - Cadastro redireciona para `/trial`.
  - Botão “Liberar Meu Acesso” abre Checkout com `trial_period_days: 7` e coleta cartão; sucesso vai para `/dashboard`.
  - Guard `RequireSubscription` permite `trialing` e redireciona não assinados para `/trial`.
- Settings:
  - Botão “Cancelar/Alterar Assinatura” abre Stripe Billing Portal (via e-mail).
  - “Upgrade para Anual” inicia Checkout com plano anual.
- Admin bypass:
  - `henrico.pierdona@gmail.com` não é bloqueado por assinatura.

## Stripe Backend
- Checar Render env:
  - `STRIPE_SECRET_KEY`, `APP_URL`, `STRIPE_WEBHOOK_SECRET` definidos.
- Endpoints:
  - Checkout assinatura (mensal/anual), pagamento avulso e trial (`/create-trial-session`).
  - Portal por e-mail (`/create-portal-session-by-email`).
  - Webhook `/stripe/webhook` com verificação de assinatura.
- Validação de eventos:
  - Stripe Dashboard → Developers → Events: confirmar `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.*`.

## Verificações Finais
- Acessar produção (Vercel) e realizar:
  - Login com admin para garantir bypass.
  - Cadastro novo → `/trial` → confirmar Checkout trial e retorno.
  - Login social com provider habilitado.
  - Abrir Settings e testar Portal e Upgrade.

## Caso encontremos erros
- Se build falhar, ajustar envs no Vercel e revisar logs.
- Se OAuth falhar, revisar Providers e callbacks.
- Se webhook não registrar eventos, revisar `STRIPE_WEBHOOK_SECRET` e endpoint na Stripe.

Confirma que posso executar essas validações e, se necessário, ajustar configurações (envs) e arquivos relacionados?