-- Add unique constraint to wa_message_id to avoid duplicates
ALTER TABLE whatsapp_messages DROP CONSTRAINT IF EXISTS whatsapp_messages_wa_message_id_key;
ALTER TABLE whatsapp_messages ADD CONSTRAINT whatsapp_messages_wa_message_id_key UNIQUE (wa_message_id);

-- Also add media_type if not exists
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_type TEXT;
