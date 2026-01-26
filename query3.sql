-- EXECUTE ESTA QUERY POR ÚLTIMO
-- Query 3: Ver as 5 mensagens mais recentes (para confirmar que existem)
SELECT id, contact_phone, user_id, content, direction, created_at
FROM whatsapp_messages
WHERE contact_phone LIKE '%9915326%' OR contact_phone LIKE '%19915326%'
ORDER BY created_at DESC
LIMIT 5;
