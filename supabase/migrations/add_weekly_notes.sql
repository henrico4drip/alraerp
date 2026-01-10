-- Add weekly notes field to marketing_plans
ALTER TABLE public.marketing_plans 
ADD COLUMN IF NOT EXISTS weekly_notes jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.marketing_plans.weekly_notes IS 'Resumo semanal do que foi feito (formato: {"1": "texto semana 1", "2": "...", ...})';
