-- Verificar se há duplicação de wa_message_id
SELECT wa_message_id, COUNT(*) as duplicates
FROM whatsapp_messages
WHERE contact_phone = '555199153261'
AND wa_message_id IS NOT NULL
GROUP BY wa_message_id
HAVING COUNT(*) > 1
ORDER BY duplicates DESC
LIMIT 10;
