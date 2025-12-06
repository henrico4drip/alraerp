## Diagnóstico do erro
- O log `net::ERR_ABORTED http://localhost:5174/src/pages/Login.jsx?...` ocorre quando a navegação ou o fluxo OAuth cancela uma requisição do dev server (HMR). É benigno e esperado ao redirecionar para provedores (Google/Apple/Facebook) ou ao trocar de rota.
- Confirmar em Network: o erro aparece no momento do clique de OAuth; após retorno, a tela carrega normalmente.

## Correções na tela de Login
- Remover imports duplicados em `src/pages/Login.jsx` (linhas com `useAuth` e `useNavigate` repetidas).
- Remover segunda declaração de `const navigate = useNavigate()` (existe novamente em `src/pages/Login.jsx:38`).
- Trocar estados iniciais de `email` e `password` para vazios (`''`) e desativar autocompletar:
  - `const [email, setEmail] = useState('')`
  - `const [password, setPassword] = useState('')`
  - No `<form>` usar `autoComplete="off"`; no input de senha usar `autoComplete="new-password"`.
- Substituir o uso de `document.querySelector(...).addEventListener('click', ...)` por handlers React nos botões sociais:
  - `<button className="social-btn" title="Google" onClick={() => oauthLogin('google')}>...` (idem para Facebook/Apple).
- Implementar `oauthLogin(provider)` com `supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin + '/dashboard' } })` e tratamento de erro.
- Manter o fluxo atual de login e cadastro por e‑mail/senha inalterado (apenas sem valores pré-preenchidos).

## Configuração dos provedores no Supabase
- Supabase Dashboard → Authentication → Providers:
  - Google: ativar e inserir Client ID/Secret do Google Cloud; configurar URIs de redirect.
  - Facebook: ativar e inserir App ID/Secret do Facebook Developers; configurar URIs de redirect.
  - Apple: ativar com Service ID, Team ID, Key ID e chave `.p8`; configurar domínio/redirect exigidos pela Apple.
- Garantir que o domínio de produção esteja autorizado nos provedores e no Supabase.

## Validação
- Testar login por e‑mail/senha: campos sem preenchimento automático, sem necessidade de apagar valores.
- Testar Google/Apple/Facebook: clicar, completar OAuth, retornar autenticado e redirecionar para `/dashboard`.
- O log `ERR_ABORTED` deve surgir apenas no momento do redirecionamento e não impactar o funcionamento.

## Entrega
- Commit único: "Login: OAuth Google/Apple/Facebook, remover pré-preenchidos, corrigir imports e handlers".
- Sem mudanças no backend necessárias. Se aprovado, aplico as alterações e faço o commit/push.