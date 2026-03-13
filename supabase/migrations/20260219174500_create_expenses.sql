-- Migration to create expenses table
create table if not exists public.expenses (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text,
  amount numeric default 0,
  due_date timestamptz,
  provider text,
  category text,
  status text default 'open',
  recurrence text default 'none',
  installments_count int default 1,
  paid_at timestamptz,
  group_id text,
  created_date timestamptz default now()
);

-- RLS
alter table public.expenses enable row level security;

drop policy if exists "expenses_select_self" on public.expenses;
create policy "expenses_select_self" on public.expenses for select using (user_id = auth.uid());

drop policy if exists "expenses_insert_self" on public.expenses;
create policy "expenses_insert_self" on public.expenses for insert with check (user_id = auth.uid());

drop policy if exists "expenses_update_self" on public.expenses;
create policy "expenses_update_self" on public.expenses for update using (user_id = auth.uid());

drop policy if exists "expenses_delete_self" on public.expenses;
create policy "expenses_delete_self" on public.expenses for delete using (user_id = auth.uid());

-- Indexes
create index if not exists expenses_user_id_idx on public.expenses (user_id);
create index if not exists expenses_due_date_idx on public.expenses (due_date);
