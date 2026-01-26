-- Migração para reduzir uso de CPU (Índices e Otimização)
-- Execute isso no SQL Editor do seu Supabase

-- 1. Índice Parcial para mensagens recebidas (Otimiza o contador do menu lateral)
CREATE INDEX IF NOT EXISTS idx_wa_messages_inbound_unread 
ON whatsapp_messages (user_id, created_at DESC) 
WHERE direction = 'inbound';

-- 2. Índice para acelerar o agrupamento de conversas
CREATE INDEX IF NOT EXISTS idx_wa_messages_conversation_lookup
ON whatsapp_messages (user_id, contact_phone, created_at DESC);

-- 3. Otimização da View de Chats para ser mais leve
CREATE OR REPLACE VIEW distinct_chats AS
SELECT DISTINCT ON (user_id, contact_phone)
    user_id,
    contact_phone,
    contact_name,
    content,
    created_at,
    status,
    direction
FROM whatsapp_messages
ORDER BY user_id, contact_phone, created_at DESC;

-- 4. Notificar o sistema sobre a mudança
NOTIFY pgrst, 'reload schema';
