-- Diagnostic and Fix Script for is_read Issues
-- Run this to check and fix any database-level issues

-- 1. Check if there are any triggers on whatsapp_messages
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'whatsapp_messages';

-- 2. Check current RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'whatsapp_messages';

-- 3. Sample check: Show last 5 inbound messages and their is_read status
SELECT 
    id,
    contact_phone,
    content,
    direction,
    is_read,
    created_at,
    wa_message_id
FROM whatsapp_messages
WHERE direction = 'inbound'
ORDER BY created_at DESC
LIMIT 5;

-- 4. Count of unread inbound messages (this is what the app queries)
SELECT COUNT(*) as unread_count
FROM whatsapp_messages
WHERE direction = 'inbound' AND is_read = FALSE;

-- 5. If you want to manually mark a specific message as unread for testing:
-- UPDATE whatsapp_messages 
-- SET is_read = FALSE 
-- WHERE wa_message_id = 'YOUR_MESSAGE_ID_HERE';
