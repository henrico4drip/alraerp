-- Verificar e corrigir números de telefone duplicados na tabela customers
-- Isso pode causar envio de mensagens duplicadas

-- 1. Adicionar coluna phone_normalized se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customers' AND column_name = 'phone_normalized') THEN
        ALTER TABLE customers ADD COLUMN phone_normalized TEXT;
    END IF;
END $$;

-- 2. Popular phone_normalized para registros existentes (removendo caracteres não numéricos)
UPDATE customers 
SET phone_normalized = regexp_replace(phone, '\D', '', 'g')
WHERE phone IS NOT NULL 
  AND phone != ''
  AND (phone_normalized IS NULL OR phone_normalized = '');

-- 3. Remover duplicados mantendo apenas o registro mais recente
-- Primeiro, identificar duplicados por user_id + phone_normalized
DELETE FROM customers
WHERE id IN (
    SELECT id FROM (
        SELECT 
            c1.id,
            ROW_NUMBER() OVER (
                PARTITION BY c1.user_id, c1.phone_normalized 
                ORDER BY COALESCE(c1.created_date, '1970-01-01') DESC, c1.id DESC
            ) as rn
        FROM customers c1
        WHERE c1.phone_normalized IS NOT NULL 
          AND c1.phone_normalized != ''
    ) sub
    WHERE sub.rn > 1
);

-- 4. Criar índice único para evitar duplicatas futuras
DROP INDEX IF EXISTS idx_customers_user_phone_normalized;
CREATE UNIQUE INDEX idx_customers_user_phone_normalized 
ON customers(user_id, phone_normalized) 
WHERE phone_normalized IS NOT NULL AND phone_normalized != '';

-- 5. Criar/atualizar função trigger para manter phone_normalized sincronizado
CREATE OR REPLACE FUNCTION normalize_customer_phone()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.phone IS NOT NULL THEN
        NEW.phone_normalized = regexp_replace(NEW.phone, '\D', '', 'g');
    ELSE
        NEW.phone_normalized = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Remover trigger existente se houver e recriar
DROP TRIGGER IF EXISTS trigger_normalize_customer_phone ON customers;

CREATE TRIGGER trigger_normalize_customer_phone
    BEFORE INSERT OR UPDATE OF phone ON customers
    FOR EACH ROW
    EXECUTE FUNCTION normalize_customer_phone();
