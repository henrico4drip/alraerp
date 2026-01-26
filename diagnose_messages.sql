-- Diagnóstico completo das mensagens do cliente 555199153261
-- Execute este SQL no Supabase SQL Editor

-- 1. Ver todas as variações de número que existem no banco
SELECT DISTINCT contact_phone, COUNT(*) as total
FROM whatsapp_messages
WHERE contact_phone LIKE '%9915326%' OR contact_phone LIKE '%19915326%'
GROUP BY contact_phone
ORDER BY total DESC;

-- 2. Ver quem é o dono dessas mensagens (user_id)
SELECT user_id, contact_phone, COUNT(*) as total
FROM whatsapp_messages
WHERE contact_phone LIKE '%9915326%' OR contact_phone LIKE '%19915326%'
GROUP BY user_id, contact_phone
ORDER BY total DESC;

-- 3. Ver as 5 mensagens mais recentes (para confirmar que existem)
SELECT id, contact_phone, user_id, content, direction, created_at
FROM whatsapp_messages
WHERE contact_phone LIKE '%9915326%' OR contact_phone LIKE '%19915326%'
ORDER BY created_at DESC
LIMIT 5;

-- 4. Ver o user_id do usuário logado (você)
SELECT id, email FROM auth.users LIMIT 1;
