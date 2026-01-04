-- Add AI suggested message column to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS ai_suggested_message TEXT;

COMMENT ON COLUMN customers.ai_suggested_message IS 'AI-generated personalized message to persuade customer for next purchase';
