
DELETE FROM whatsapp_messages 
WHERE LENGTH(REGEXP_REPLACE(contact_phone, '\D', '', 'g')) > 13;
