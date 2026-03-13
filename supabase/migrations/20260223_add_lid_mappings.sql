-- Create table for LID mappings
CREATE TABLE IF NOT EXISTS wa_lid_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lid TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_wa_lid_mappings_lid ON wa_lid_mappings(lid);
CREATE INDEX IF NOT EXISTS idx_wa_lid_mappings_phone ON wa_lid_mappings(phone);
