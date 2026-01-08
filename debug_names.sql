
-- Check for the most frequent contact names in recent messages
SELECT contact_name, COUNT(DISTINCT contact_phone) as phone_count
FROM whatsapp_messages
GROUP BY contact_name
HAVING COUNT(DISTINCT contact_phone) > 1
ORDER BY phone_count DESC
LIMIT 10;

-- Check if there's a customer with a "generic" phone that might be matching many
SELECT id, name, phone
FROM customers
WHERE LENGTH(REGEXP_REPLACE(phone, '\D', '', 'g')) < 8 OR phone IS NULL;
