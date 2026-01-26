-- Check if conversations are split into multiple phone variants
SELECT 
    RIGHT(contact_phone, 8) as base_8,
    ARRAY_AGG(DISTINCT contact_phone) as phones,
    COUNT(DISTINCT contact_phone) as variants_count,
    MAX(created_at) as last_msg
FROM whatsapp_messages
GROUP BY 1
HAVING COUNT(DISTINCT contact_phone) > 1
ORDER BY last_msg DESC;
