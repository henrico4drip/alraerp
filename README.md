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

## Deploy (Produção)

### Frontend (Vercel)
- Framework: Vite (React)
- Build: `npm run build`
- Output: `dist`
- Variáveis de ambiente:
  - `VITE_API_URL` → URL pública do backend (Render)
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_STRIPE_PUBLISHABLE_KEY`

### Backend (Render)
- Serviço Web apontando para `server/index.js`
- Build: `npm ci`
- Start: `node server/index.js`
- Health check: `GET /health`
- Variáveis de ambiente:
  - `STRIPE_SECRET_KEY`
  - `APP_URL` → URL pública do frontend (Vercel)

### Integração
- O frontend consome o backend via `VITE_API_URL`:
  - Status de assinatura: `GET /subscription-status?email=...`
  - Checkout recorrente: `POST /create-checkout-session`
  - Pagamento avulso (Pix/Boleto/Cartão): `POST /create-payment-session`

### PWA
- Manifesto: `public/manifest.webmanifest`
- `index.html` inclui `theme-color` e `<link rel="manifest">`
- Botão "Instalar" no cabeçalho aparece quando disponível e some em modo app

## Segurança
- Nunca commite suas chaves no repositório.
- Ative webhooks no backend para atualizar status de pagamentos em produção.

## Variáveis (Desenvolvimento)
Crie `.env.local` com:

```
VITE_API_URL=http://localhost:4242
```

Backend local em `4242` (`node server/index.js`) e frontend em `5174` (`npm run dev`).

## Licença
Sem licença definida. Solicite se desejar publicar como open-source.
