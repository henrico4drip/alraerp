-- Migration to create staff_profiles table
create table if not exists public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  permissions jsonb default '{}'::jsonb,
  active boolean default true,
  created_date timestamptz default now()
);

-- RLS
alter table public.staff_profiles enable row level security;

drop policy if exists "staff_select_self" on public.staff_profiles;
create policy "staff_select_self" on public.staff_profiles for select using (user_id = auth.uid());

drop policy if exists "staff_insert_self" on public.staff_profiles;
create policy "staff_insert_self" on public.staff_profiles for insert with check (user_id = auth.uid());

drop policy if exists "staff_update_self" on public.staff_profiles;
create policy "staff_update_self" on public.staff_profiles for update using (user_id = auth.uid());

drop policy if exists "staff_delete_self" on public.staff_profiles;
create policy "staff_delete_self" on public.staff_profiles for delete using (user_id = auth.uid());

-- Index
create index if not exists staff_user_id_idx on public.staff_profiles (user_id);
