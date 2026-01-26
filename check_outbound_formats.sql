-- Check outbound messages phone formats
SELECT contact_phone, COUNT(*)
FROM whatsapp_messages
WHERE direction = 'outbound'
GROUP BY contact_phone
ORDER BY 2 DESC
LIMIT 20;
