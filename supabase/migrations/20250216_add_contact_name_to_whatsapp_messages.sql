-- Migration: Adicionar campo contact_name na tabela whatsapp_messages
-- Isso corrige o problema de nomes faltando no CRM

-- Adicionar coluna contact_name se não existir
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS contact_name TEXT;

-- Criar índice para busca rápida por nome
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_contact_name 
ON public.whatsapp_messages(contact_name);

-- Criar índice único para evitar duplicatas (wa_message_id + user_id)
-- Primeiro verificar se já existe
DO $$
BEGIN
    -- Remover índice antigo se existir (para recriar corretamente)
    DROP INDEX IF EXISTS idx_whatsapp_messages_unique_wa_id;
    
    -- Criar índice único
    CREATE UNIQUE INDEX idx_whatsapp_messages_unique_wa_id 
    ON public.whatsapp_messages(wa_message_id, user_id)
    WHERE wa_message_id IS NOT NULL;
EXCEPTION
    WHEN duplicate_table THEN
        NULL; -- Índice já existe
END $$;
