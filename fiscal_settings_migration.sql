-- Add fiscal settings columns for Focus NFe integration
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS focus_company_id text,
ADD COLUMN IF NOT EXISTS focus_environment text DEFAULT 'homologacao', -- 'homologacao' or 'producao'
ADD COLUMN IF NOT EXISTS fiscal_csc_id text,
ADD COLUMN IF NOT EXISTS fiscal_csc_token text,
ADD COLUMN IF NOT EXISTS fiscal_series integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS fiscal_next_number integer,
ADD COLUMN IF NOT EXISTS fiscal_regime text, -- '1': Simples Nacional, '3': Regime Normal
ADD COLUMN IF NOT EXISTS fiscal_ncm_default text,
ADD COLUMN IF NOT EXISTS fiscal_cfop_default text;

-- Index for querying by focus company id if needed
CREATE INDEX IF NOT EXISTS idx_settings_focus_company_id ON settings(focus_company_id);
