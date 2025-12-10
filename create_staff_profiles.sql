-- Tabela de Perfis de Funcionários (Staff)
create table staff_profiles (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  user_id uuid references auth.users not null, -- Vincula a conta principal (Tenant)
  name text not null,
  pin text not null, -- Senha numérica de 4-6 dígitos
  role text default 'staff', -- 'admin' ou 'staff'
  permissions jsonb default '{}'::jsonb -- Objeto JSON com permissões { financial: true, settins: false }
);

-- RLS
alter table staff_profiles enable row level security;

create policy "Users can crud their own staff profiles"
  on staff_profiles for all
  using (auth.uid() = user_id);
