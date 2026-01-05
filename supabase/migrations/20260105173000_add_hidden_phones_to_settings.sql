-- Migration: Add whatsapp_hidden_phones to settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS whatsapp_hidden_phones text[] DEFAULT '{}';
