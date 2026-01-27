-- Migration: Add whatsapp_instance_name to settings for webhook mapping
ALTER TABLE settings ADD COLUMN IF NOT EXISTS whatsapp_instance_name text;

-- Add index for faster lookup
CREATE INDEX IF NOT EXISTS idx_settings_whatsapp_instance ON settings(whatsapp_instance_name);
