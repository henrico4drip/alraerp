-- Adiciona suporte a SLUG na tabela de configurações para URL personalizada
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'slug') THEN
        ALTER TABLE settings ADD COLUMN slug text UNIQUE;
        CREATE INDEX idx_settings_slug ON settings(slug);
    END IF;
END $$;

-- Função segura para login do cliente (RPC)
-- FIX: Usando alias 's' para evitar ambiguidade da coluna logo_url com o parametro de saida
CREATE OR REPLACE FUNCTION get_customer_balance(
  p_slug text,
  p_cpf text,
  p_phone text
)
RETURNS TABLE (
  customer_name text,
  cashback_balance numeric,
  cashback_expires_at timestamptz,
  store_name text,
  logo_url text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id text; -- Alterado de uuid para text para bater com o schema atual
  v_store_name text;
  v_logo_url text;
BEGIN
  -- 1. Achar o dono da loja pelo slug
  -- Alias 's' resolve conflito de nome
  SELECT s.user_id, s.erp_name, s.logo_url INTO v_user_id, v_store_name, v_logo_url
  FROM settings s
  WHERE s.slug = p_slug
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN; -- Loja não encontrada
  END IF;

  -- 2. Buscar cliente que bate com cpf E telefone para esse user_id
  -- Remove caracteres não numéricos para comparação flexível
  RETURN QUERY
  SELECT 
    c.name,
    c.cashback_balance,
    c.cashback_expires_at,
    v_store_name,
    v_logo_url
  FROM customers c
  WHERE c.user_id = v_user_id
    AND (
         (p_cpf <> '' AND regexp_replace(c.cpf, '\D','','g') = regexp_replace(p_cpf, '\D','','g'))
         OR 
         (p_phone <> '' AND regexp_replace(c.phone, '\D','','g') LIKE '%' || regexp_replace(p_phone, '\D','','g'))
    )
    AND CASE 
      WHEN p_cpf <> '' THEN regexp_replace(c.cpf, '\D','','g') = regexp_replace(p_cpf, '\D','','g')
      ELSE regexp_replace(c.phone, '\D','','g') LIKE '%' || regexp_replace(p_phone, '\D','','g')
    END
  LIMIT 1;
END;
$$;

-- Permissao de execucao
GRANT EXECUTE ON FUNCTION get_customer_balance TO anon, authenticated, service_role;
