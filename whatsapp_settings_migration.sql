ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_auto_send_cashback boolean DEFAULT false;
