## Hipóteses prováveis
- Sem novo commit na branch monitorada, o Vercel não dispara build.
- Build falha por dependência ausente (ex.: `react-to-print`) ou configuração incorreta de output (`dist`).
- Variáveis de ambiente de Produção ausentes/erradas (ex.: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`, `VITE_STRIPE_PUBLISHABLE_KEY`).
- Projeto configurado para ignorar deploy (auto deploy desativado, branch diferente, cache corrompido).

## Passos de verificação
- Vercel → Project → Deployments → abrir o último deployment e checar os Logs de build (erros de dependência ou env).
- Vercel → Settings → Git:
  - Confirmar que a branch rastreada é a mesma que você está fazendo push (`main`).
  - Checar “Automatic Deployments” = Enabled.
- Vercel → Settings → Environment Variables:
  - Validar que todas as envs estão definidas na aba “Production” e sem espaços extras.
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`, `VITE_STRIPE_PUBLISHABLE_KEY`.
- Vercel → Settings → General:
  - Framework = Vite (ou automático), Build Command = `npm run build`, Output Directory = `dist`.
  - “Root Directory” correto (não é monorepo).

## Correções propostas
- Se os logs apontarem dependência faltante (ex.: `react-to-print`): adicionar ao `package.json` e push.
- Se envs faltando: preencher na aba Production e redeploy.
- Se a branch não for a rastreada: mudar branch ou reconfigurar.
- Forçar redeploy:
  - Botão “Redeploy” no Vercel; e/ou fazer um commit vazio: `git commit --allow-empty -m "chore: redeploy"` e push.
  - Ativar “Skip Build Cache” no redeploy se necessário.

## Validação final
- Após redeploy, acessar o site e testar:
  - `/login` (email/senha e social), `/trial` (Stripe checkout trial), `/dashboard`, `/settings` (Portal/Upgrade).
- Confirmar que deep links não dão 404 (SPA rewrite presente).

Posso executar essas verificações, ajustar as envs e, se necessário, adicionar a dependência e forçar o redeploy?