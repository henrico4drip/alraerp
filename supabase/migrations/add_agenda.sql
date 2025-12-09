create table if not exists public.agenda (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  title text not null,
  "desc" text,
  time text,
  priority text default 'Média',
  category text default 'Outro',
  done boolean default false,
  created_at timestamptz default now()
);

create index if not exists agenda_user_date_idx on public.agenda (user_id, date);

alter table public.agenda enable row level security;
drop policy if exists "agenda_select_self" on public.agenda;
create policy "agenda_select_self" on public.agenda for select using (user_id = auth.uid());
drop policy if exists "agenda_insert_self" on public.agenda;
create policy "agenda_insert_self" on public.agenda for insert with check (user_id = auth.uid());
drop policy if exists "agenda_update_self" on public.agenda;
create policy "agenda_update_self" on public.agenda for update using (user_id = auth.uid());
drop policy if exists "agenda_delete_self" on public.agenda;
create policy "agenda_delete_self" on public.agenda for delete using (user_id = auth.uid());
