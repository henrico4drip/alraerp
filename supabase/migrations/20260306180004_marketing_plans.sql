-- Marketing Plans: Planejamento Estratégico de Longo Prazo
create table if not exists public.marketing_plans (
  id text primary key,
  user_id text not null,
  month integer not null check (month >= 1 and month <= 12),
  year integer not null,
  plan_data jsonb not null, -- Estrutura completa do plano (monthly_strategy + weeks)
  revenue_goal numeric default 0,
  actual_revenue numeric default 0,
  completion_rate numeric default 0, -- % de itens executados
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint unique_plan_per_month unique(user_id, month, year)
);

-- Marketing Executions: Registro do que foi feito
create table if not exists public.marketing_executions (
  id text primary key,
  user_id text not null,
  plan_id text references public.marketing_plans(id) on delete cascade,
  week_number integer,
  item_type text, -- 'feed_post', 'story_sequence'
  item_index integer,
  executed_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

-- RLS
alter table public.marketing_plans enable row level security;
alter table public.marketing_executions enable row level security;

-- Policies
create policy "marketing_plans_select" on public.marketing_plans for select 
using (user_id::text = auth.uid()::text);

create policy "marketing_plans_insert" on public.marketing_plans for insert 
with check (user_id::text = auth.uid()::text);

create policy "marketing_plans_update" on public.marketing_plans for update 
using (user_id::text = auth.uid()::text);

create policy "marketing_plans_delete" on public.marketing_plans for delete 
using (user_id::text = auth.uid()::text);

create policy "marketing_executions_select" on public.marketing_executions for select 
using (user_id::text = auth.uid()::text);

create policy "marketing_executions_insert" on public.marketing_executions for insert 
with check (user_id::text = auth.uid()::text);

create policy "marketing_executions_update" on public.marketing_executions for update 
using (user_id::text = auth.uid()::text);

create policy "marketing_executions_delete" on public.marketing_executions for delete 
using (user_id::text = auth.uid()::text);

-- Notificar reload
select pg_notify('pgrst', 'reload schema');
