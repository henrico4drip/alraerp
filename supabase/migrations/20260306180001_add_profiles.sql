-- Products: add promo_price for promotional display
alter table public.products add column if not exists promo_price numeric;
alter table public.products drop constraint if exists products_promo_price_nonnegative;
alter table public.products add constraint products_promo_price_nonnegative check (promo_price is null or promo_price >= 0);

-- Profiles: user-facing metadata linked to Supabase auth.users
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  created_date timestamptz default now()
);

alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists subscription_status text default 'inactive' check (subscription_status in ('inactive','trialing','active','past_due','canceled'));
alter table public.profiles add column if not exists subscription_end_date timestamptz;
alter table public.profiles add column if not exists trial_until timestamptz;
alter table public.profiles add column if not exists onboarding_completed boolean default false;

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists profiles_stripe_customer_id_idx on public.profiles (stripe_customer_id);

-- RLS and policies
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self" on public.profiles for select using (user_id = auth.uid());
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update using (user_id = auth.uid());
