-- Resumo das mensagens por usuário
SELECT 
    user_id, 
    count(*) as qtd_mensagens, 
    max(created_at) as ultima_msg,
    min(created_at) as primeira_msg
FROM whatsapp_messages 
GROUP BY user_id;

-- Listar as 10 últimas mensagens importadas (independente do usuário)
SELECT 
    id, 
    user_id, 
    contact_phone, 
    content, 
    created_at 
FROM whatsapp_messages 
ORDER BY created_at DESC 
LIMIT 10;
