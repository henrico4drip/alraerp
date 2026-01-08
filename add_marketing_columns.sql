ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS instagram_handle TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS brand_voice TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS target_audience TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS main_products TEXT;
SELECT pg_notify('pgrst', 'reload schema');
