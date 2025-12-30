-- Add wa_message_id column if it doesn't exist
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS wa_message_id text;

-- Add checking for uniqueness to prevent duplicates if desired, or at least an index for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wa_msg_id ON public.whatsapp_messages(wa_message_id);

-- Reload schema cache happens automatically on DDL in Supabase usually, but this fixes the missing column error.
