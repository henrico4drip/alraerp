-- Adicionando colunas de gateway PIX
ALTER TABLE settings ADD COLUMN IF NOT EXISTS pix_gateway TEXT DEFAULT 'none';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS asaas_api_key TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS mp_access_token TEXT;
