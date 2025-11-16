# ERP Frontend

Aplicação ERP com integração Stripe (assinaturas e pagamentos únicos) e Supabase para autenticação/dados.

## Requisitos
- Node.js 18+
- NPM ou Yarn
- Stripe (chaves `pk_*` e `sk_*`)
- Supabase (URL e ANON KEY)

## Configuração
Crie um arquivo `.env` na raiz seguindo `.env.example` e configure suas chaves:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
APP_URL=http://localhost:5174
VITE_ADMIN_EMAILS=seu-admin@dominio.com
VITE_TEST_EMAILS=qa@dominio.com
```

> Nota: o arquivo `.env` está ignorado pelo git via `.gitignore` para evitar expor segredos.

## Desenvolvimento
Frontend:
```
npm install
npm run dev -- --port 5174
```
Backend Stripe:
```
node server/index.js
```

Acesse `http://localhost:5174`.

## Deploy
- Gere chaves live no Stripe Dashboard e atualize `.env`.
- Configure variáveis de ambiente no seu provedor (Vercel, Netlify, etc.).

## Segurança
- Nunca commite suas chaves no repositório.
- Ative webhooks no backend para atualizar status de pagamentos em produção.

## Licença
Sem licença definida. Solicite se desejar publicar como open-source.