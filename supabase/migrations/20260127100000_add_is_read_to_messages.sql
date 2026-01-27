-- 1. Add column if not exists
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- 2. CRITICAL FIX: Mark ALL existing inbound messages as UNREAD (to fix the sync issue)
-- This will "resurrect" messages that were incorrectly marked as read
UPDATE whatsapp_messages 
SET is_read = FALSE 
WHERE direction = 'inbound' 
  AND (is_read IS NULL OR is_read = TRUE)
  AND created_at > NOW() - INTERVAL '7 days'; -- Only last 7 days to avoid overwhelming

-- 3. Mark outbound messages as read
UPDATE whatsapp_messages 
SET is_read = TRUE 
WHERE direction = 'outbound' AND is_read IS NULL;

-- 4. Correct Realtime Activation Syntax
ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;

-- 5. Re-create View
DROP VIEW IF EXISTS distinct_chats;
CREATE VIEW distinct_chats AS
SELECT DISTINCT ON (user_id, contact_phone)
    id,
    user_id,
    contact_phone,
    contact_name,
    content,
    created_at,
    status,
    direction,
    is_read
FROM whatsapp_messages
ORDER BY user_id, contact_phone, created_at DESC;

-- 6. Ensure Publication exists for realtime
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE whatsapp_messages;

-- 7. Add index for fast unread queries
CREATE INDEX IF NOT EXISTS idx_wa_messages_unread 
ON whatsapp_messages (user_id, direction, is_read) 
WHERE direction = 'inbound' AND is_read = FALSE;
