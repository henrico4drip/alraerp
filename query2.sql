-- EXECUTE ESTA QUERY DEPOIS DA QUERY 1
-- Query 2: Ver quem é o dono dessas mensagens (user_id)
SELECT user_id, contact_phone, COUNT(*) as total
FROM whatsapp_messages
WHERE contact_phone LIKE '%9915326%' OR contact_phone LIKE '%19915326%'
GROUP BY user_id, contact_phone
ORDER BY total DESC;
