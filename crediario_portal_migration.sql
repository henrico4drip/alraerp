-- ====================================================================
-- MIGRAÇÃO: Portal do Cliente com Crediário + Colunas faltantes do Settings
-- Execute este SQL inteiro no Supabase SQL Editor
-- ====================================================================

-- 0. Adiciona colunas faltantes em settings (para que as Config salvem sem erro)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'ai_api_key') THEN
        ALTER TABLE settings ADD COLUMN ai_api_key text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'ai_provider') THEN
        ALTER TABLE settings ADD COLUMN ai_provider text DEFAULT 'google';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'pix_gateway') THEN
        ALTER TABLE settings ADD COLUMN pix_gateway text DEFAULT 'none';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'asaas_api_key') THEN
        ALTER TABLE settings ADD COLUMN asaas_api_key text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'mp_access_token') THEN
        ALTER TABLE settings ADD COLUMN mp_access_token text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'pricing_base') THEN
        ALTER TABLE settings ADD COLUMN pricing_base text DEFAULT 'pix';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'card_surcharge_percentage') THEN
        ALTER TABLE settings ADD COLUMN card_surcharge_percentage numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'pix_discount_percentage') THEN
        ALTER TABLE settings ADD COLUMN pix_discount_percentage numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'surcharge_methods') THEN
        ALTER TABLE settings ADD COLUMN surcharge_methods jsonb DEFAULT '["Cartão de Crédito", "Cartão de Débito"]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'discount_methods') THEN
        ALTER TABLE settings ADD COLUMN discount_methods jsonb DEFAULT '["PIX", "Dinheiro"]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'instagram_handle') THEN
        ALTER TABLE settings ADD COLUMN instagram_handle text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'website_url') THEN
        ALTER TABLE settings ADD COLUMN website_url text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'brand_voice') THEN
        ALTER TABLE settings ADD COLUMN brand_voice text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'target_audience') THEN
        ALTER TABLE settings ADD COLUMN target_audience text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'main_products') THEN
        ALTER TABLE settings ADD COLUMN main_products text;
    END IF;
    -- Colunas Fiscais (NFCe)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'focus_environment') THEN
        ALTER TABLE settings ADD COLUMN focus_environment text DEFAULT 'homologacao';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'focus_company_id') THEN
        ALTER TABLE settings ADD COLUMN focus_company_id text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'fiscal_csc_id') THEN
        ALTER TABLE settings ADD COLUMN fiscal_csc_id text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'fiscal_csc_token') THEN
        ALTER TABLE settings ADD COLUMN fiscal_csc_token text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'fiscal_series') THEN
        ALTER TABLE settings ADD COLUMN fiscal_series integer DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'fiscal_next_number') THEN
        ALTER TABLE settings ADD COLUMN fiscal_next_number integer;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'fiscal_regime') THEN
        ALTER TABLE settings ADD COLUMN fiscal_regime text DEFAULT '1';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'fiscal_ncm_default') THEN
        ALTER TABLE settings ADD COLUMN fiscal_ncm_default text DEFAULT '00000000';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'fiscal_cfop_default') THEN
        ALTER TABLE settings ADD COLUMN fiscal_cfop_default text DEFAULT '5102';
    END IF;
END $$;

DROP FUNCTION IF EXISTS get_customer_balance(text, text, text);

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
  logo_url text,
  pix_key text,
  company_city text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id text;
  v_store_name text;
  v_logo_url text;
  v_pix_key text;
  v_company_city text;
BEGIN
  SELECT s.user_id, s.erp_name, s.logo_url, s.pix_key, s.company_city
  INTO v_user_id, v_store_name, v_logo_url, v_pix_key, v_company_city
  FROM settings s
  WHERE s.slug = lower(p_slug)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    c.name,
    c.cashback_balance,
    c.cashback_expires_at,
    v_store_name,
    v_logo_url,
    v_pix_key,
    v_company_city
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

GRANT EXECUTE ON FUNCTION get_customer_balance TO anon, authenticated, service_role;

-- 2. Atualiza get_customer_sales para incluir campo payments (parcelas do carnê)
DROP FUNCTION IF EXISTS get_customer_sales(text, text, text);

CREATE OR REPLACE FUNCTION get_customer_sales(
  p_slug text,
  p_cpf text,
  p_phone text
)
RETURNS TABLE (
  sale_id text,
  sale_number text,
  sale_date timestamptz,
  total_amount numeric,
  cashback_earned numeric,
  cashback_used numeric,
  items jsonb,
  payments jsonb
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id text;
  v_customer_id text;
BEGIN
  SELECT s.user_id INTO v_user_id
  FROM settings s
  WHERE s.slug = lower(p_slug)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT c.id INTO v_customer_id
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

  IF v_customer_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    sa.id,
    sa.sale_number,
    sa.sale_date,
    sa.total_amount,
    sa.cashback_earned,
    sa.cashback_used,
    sa.items,
    sa.payments
  FROM sales sa
  WHERE sa.user_id = v_user_id
    AND sa.customer_id = v_customer_id
  ORDER BY sa.sale_date DESC
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION get_customer_sales TO anon, authenticated, service_role;

-- Forçar reload do cache do PostgREST
SELECT pg_notify('pgrst', 'reload schema');
