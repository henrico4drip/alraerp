-- Investigation of duplicates and IDs for a specific phone
SELECT wa_message_id, content, created_at, COUNT(*) as occurrences
FROM whatsapp_messages
WHERE contact_phone LIKE '%519915326%'
GROUP BY wa_message_id, content, created_at
HAVING COUNT(*) > 1
LIMIT 20;
