ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS business_area text,
  ADD COLUMN IF NOT EXISTS iva_framework text;