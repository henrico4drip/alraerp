-- Drop existing policies to avoid conflict
DROP POLICY IF EXISTS "Users can view their own whatsapp messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Users can insert their own whatsapp messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Users can update their own whatsapp messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Users can delete their own whatsapp messages" ON public.whatsapp_messages;

-- Also drop potential alternate names users might have created
DROP POLICY IF EXISTS "Users can view their own messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.whatsapp_messages;

-- Enable RLS
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Re-create policies correctly
CREATE POLICY "Users can view their own message_fix"
ON public.whatsapp_messages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own message_fix"
ON public.whatsapp_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own message_fix"
ON public.whatsapp_messages FOR UPDATE
USING (auth.uid() = user_id);
