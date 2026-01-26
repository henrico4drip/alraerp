-- Optimize distinct_chats view for better performance and multi-user safety
CREATE OR REPLACE VIEW distinct_chats AS
SELECT DISTINCT ON (user_id, contact_phone)
    user_id,
    contact_phone,
    contact_name,
    content,
    created_at,
    status,
    direction
FROM whatsapp_messages
ORDER BY user_id, contact_phone, created_at DESC;

-- Index to support the optimized view and speed up RLS-filtered queries
CREATE INDEX IF NOT EXISTS idx_wa_messages_user_phone_created_at 
ON whatsapp_messages (user_id, contact_phone, created_at DESC);
