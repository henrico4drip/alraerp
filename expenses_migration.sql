-- Deletar a tabela se ela já existir para garantir que o esquema esteja correto (opcional, mas recomendado se houver erros de tipo)
-- DROP TABLE IF EXISTS public.expenses;

-- Criação da tabela de despesas (expenses) para o contas a pagar
create table if not exists public.expenses (
  id text primary key,
  user_id text not null,
  description text not null,
  amount numeric not null default 0,
  due_date timestamptz not null,
  provider text,
  category text,
  status text default 'open',
  paid_at timestamptz,
  recurrence text default 'none',
  installments_count integer default 1,
  group_id text,
  created_date timestamptz default now()
);

-- Habilitar Row Level Security
alter table public.expenses enable row level security;

-- Políticas de acesso por usuário com CAST duplo para garantir compatibilidade
drop policy if exists "expenses_select_own" on public.expenses;
create policy "expenses_select_own" on public.expenses for select 
using (user_id::text = auth.uid()::text);

drop policy if exists "expenses_insert_own" on public.expenses;
create policy "expenses_insert_own" on public.expenses for insert 
with check (user_id::text = auth.uid()::text);

drop policy if exists "expenses_update_own" on public.expenses;
create policy "expenses_update_own" on public.expenses for update 
using (user_id::text = auth.uid()::text);

drop policy if exists "expenses_delete_own" on public.expenses;
create policy "expenses_delete_own" on public.expenses for delete 
using (user_id::text = auth.uid()::text);

-- Forçar reload do cache do PostgREST
select pg_notify('pgrst', 'reload schema');
