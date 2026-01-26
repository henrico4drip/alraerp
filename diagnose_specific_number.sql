-- Diagnose specific contact messages
SELECT id, contact_phone, content, created_at, wa_message_id, direction
FROM whatsapp_messages
WHERE contact_phone IN ('5199153261', '555199153261', '51999153261', '5551999153261')
ORDER BY created_at DESC;
