-- Add website URL to settings
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS website_url text;

COMMENT ON COLUMN public.settings.website_url IS 'URL do site/e-commerce da loja para análise da IA';
