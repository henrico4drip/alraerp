-- Create whatsapp_messages table
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    contact_phone TEXT NOT NULL,
    contact_name TEXT,
    content TEXT,
    media_url TEXT,
    direction TEXT CHECK (direction IN ('inbound', 'outbound')),
    status TEXT DEFAULT 'sent', -- sent, delivered, read, received
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster querying of conversations
CREATE INDEX IF NOT EXISTS idx_wa_messages_user_phone ON whatsapp_messages(user_id, contact_phone);
CREATE INDEX IF NOT EXISTS idx_wa_messages_created_at ON whatsapp_messages(created_at);

-- RLS Policies
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages"
    ON whatsapp_messages FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages"
    ON whatsapp_messages FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages"
    ON whatsapp_messages FOR UPDATE
    USING (auth.uid() = user_id);
