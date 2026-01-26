-- EXECUTE ESTA QUERY PRIMEIRO
-- Query 1: Ver todas as variações de número que existem no banco
SELECT DISTINCT contact_phone, COUNT(*) as total
FROM whatsapp_messages
WHERE contact_phone LIKE '%9915326%' OR contact_phone LIKE '%19915326%'
GROUP BY contact_phone
ORDER BY total DESC;
