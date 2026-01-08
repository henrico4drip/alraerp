alter table public.settings add column if not exists block_payables boolean default false; select pg_notify('pgrst', 'reload schema');
