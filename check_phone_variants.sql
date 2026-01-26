-- Check phone number variations used in messages for both inbound and outbound
SELECT contact_phone, direction, COUNT(*) as total
FROM whatsapp_messages
WHERE contact_phone LIKE '%519915326%' 
GROUP BY contact_phone, direction
ORDER BY contact_phone, direction;
