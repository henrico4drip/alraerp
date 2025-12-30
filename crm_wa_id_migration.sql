ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS wa_message_id TEXT;
CREATE INDEX IF NOT EXISTS idx_wa_messages_wa_id ON whatsapp_messages(wa_message_id);
