CREATE OR REPLACE VIEW distinct_chats AS
SELECT DISTINCT ON (contact_phone)
    contact_phone,
    contact_name,
    content,
    created_at,
    status,
    direction
FROM whatsapp_messages
ORDER BY contact_phone, created_at DESC;
