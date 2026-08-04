ALTER TABLE public.client_financial_settings
  ADD COLUMN IF NOT EXISTS ta_base_representacao numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ta_base_ajudas_custo numeric NOT NULL DEFAULT 0;