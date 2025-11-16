-- Tabelas principais
create table if not exists public.users (
  id text primary key,
  email text,
  name text,
  role text,
  created_date timestamptz default now(),
  user_id text -- auto-preenchido pelo próprio id
);

create table if not exists public.settings (
  id text primary key,
  user_id text not null,
  erp_name text,
  cashback_percentage numeric,
  logo_url text,
  created_date timestamptz default now()
);
-- Campo adicional para métodos de pagamento personalizados
alter table public.settings add column if not exists payment_methods jsonb default '[]'::jsonb;
-- Dias de validade do cashback
alter table public.settings add column if not exists cashback_expiration_days integer default 30;
-- Chave PIX para geração de QR
alter table public.settings add column if not exists pix_key text;
-- Dados do estabelecimento
alter table public.settings add column if not exists company_cnpj text;
alter table public.settings add column if not exists company_address text;
alter table public.settings add column if not exists company_city text;
alter table public.settings add column if not exists company_state text;
alter table public.settings add column if not exists company_zip text;
-- Contato
alter table public.settings add column if not exists contact_email text;
-- Garantir que linhas existentes tenham um array
update public.settings set payment_methods = coalesce(payment_methods, '[]'::jsonb);
-- Forçar reload do cache do PostgREST
select pg_notify('pgrst', 'reload schema');

create table if not exists public.customers (
  id text primary key,
  user_id text not null,
  name text,
  phone text,

  cpf text,
  created_date timestamptz default now()
);
-- Campos adicionais esperados pelo app
alter table public.customers add column if not exists cashback_balance numeric default 0;
alter table public.customers add column if not exists total_spent numeric default 0;
alter table public.customers add column if not exists total_purchases integer default 0;
alter table public.customers add column if not exists cashback_expires_at timestamptz;

create table if not exists public.products (
  id text primary key,
  user_id text not null,
  name text,
  barcode text,
  price numeric,
  cost numeric,
  stock numeric,
  category text,
  created_date timestamptz default now()
);

create table if not exists public.sales (
  id text primary key,
  user_id text not null,
  sale_number text,
  customer_id text,
  customer_name text,
  items jsonb,
  total_amount numeric,
  payment_method text,
  sale_date timestamptz,
  created_date timestamptz default now()
);
-- Campos adicionais esperados pelo app
alter table public.sales add column if not exists cashback_earned numeric default 0;
alter table public.sales add column if not exists cashback_used numeric default 0;
alter table public.sales add column if not exists discount_amount numeric default 0;
alter table public.sales add column if not exists discount_percent numeric default 0;
alter table public.sales add column if not exists observations text;
alter table public.sales add column if not exists payments jsonb;

-- Geração automática de sale_number quando ausente
create sequence if not exists public.sale_number_seq start with 100 increment by 1 minvalue 100;
create or replace function public.set_sale_number_if_null()
returns trigger as $$
begin
  if new.sale_number is null or new.sale_number = '' then
    new.sale_number := nextval('public.sale_number_seq')::text;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_sale_number on public.sales;
create trigger trg_set_sale_number
before insert on public.sales
for each row execute function public.set_sale_number_if_null();

-- Índice único por usuário + número, ignorando valores nulos
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'uniq_sales_user_sale_number'
  ) then
    create unique index uniq_sales_user_sale_number
      on public.sales (user_id, sale_number)
      where sale_number is not null;
  end if;
end $$;

-- Backfill de sale_number para registros existentes sem número
update public.sales
set sale_number = nextval('public.sale_number_seq')::text
where sale_number is null or sale_number = '';

-- Row Level Security
alter table public.users enable row level security;
alter table public.settings enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;

-- Políticas: cada usuário só enxerga linhas com seu user_id
-- USERS
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users for select using (auth.uid()::text = user_id);

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own" on public.users for insert with check (auth.uid()::text = user_id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users for update using (auth.uid()::text = user_id);

-- SETTINGS
drop policy if exists "settings_select_own" on public.settings;
create policy "settings_select_own" on public.settings for select using (auth.uid()::text = user_id);

drop policy if exists "settings_insert_own" on public.settings;
create policy "settings_insert_own" on public.settings for insert with check (auth.uid()::text = user_id);

drop policy if exists "settings_update_own" on public.settings;
create policy "settings_update_own" on public.settings for update using (auth.uid()::text = user_id);

-- CUSTOMERS
drop policy if exists "customers_select_own" on public.customers;
create policy "customers_select_own" on public.customers for select using (auth.uid()::text = user_id);

drop policy if exists "customers_insert_own" on public.customers;
create policy "customers_insert_own" on public.customers for insert with check (auth.uid()::text = user_id);

drop policy if exists "customers_update_own" on public.customers;
create policy "customers_update_own" on public.customers for update using (auth.uid()::text = user_id);

-- PRODUCTS
drop policy if exists "products_select_own" on public.products;
create policy "products_select_own" on public.products for select using (auth.uid()::text = user_id);

drop policy if exists "products_insert_own" on public.products;
create policy "products_insert_own" on public.products for insert with check (auth.uid()::text = user_id);

drop policy if exists "products_update_own" on public.products;
create policy "products_update_own" on public.products for update using (auth.uid()::text = user_id);

-- SALES
drop policy if exists "sales_select_own" on public.sales;
create policy "sales_select_own" on public.sales for select using (auth.uid()::text = user_id);

drop policy if exists "sales_insert_own" on public.sales;
create policy "sales_insert_own" on public.sales for insert with check (auth.uid()::text = user_id);

drop policy if exists "sales_update_own" on public.sales;
create policy "sales_update_own" on public.sales for update using (auth.uid()::text = user_id);