-- Enable RLS on the table to ensure policies apply
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT
DROP POLICY IF EXISTS "Users can view their own whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Users can view their own whatsapp messages"
ON public.whatsapp_messages
FOR SELECT
USING (auth.uid() = user_id);

-- Policy for INSERT
DROP POLICY IF EXISTS "Users can insert their own whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Users can insert their own whatsapp messages"
ON public.whatsapp_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy for UPDATE
DROP POLICY IF EXISTS "Users can update their own whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Users can update their own whatsapp messages"
ON public.whatsapp_messages
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy for DELETE
DROP POLICY IF EXISTS "Users can delete their own whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Users can delete their own whatsapp messages"
ON public.whatsapp_messages
FOR DELETE
USING (auth.uid() = user_id);
