ALTER TABLE public.client_financial_settings
  ADD COLUMN IF NOT EXISTS iva_q1 numeric,
  ADD COLUMN IF NOT EXISTS iva_q2 numeric,
  ADD COLUMN IF NOT EXISTS iva_q3 numeric,
  ADD COLUMN IF NOT EXISTS iva_q4 numeric;