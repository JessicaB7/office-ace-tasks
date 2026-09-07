ALTER TABLE public.client_financial_settings
  ADD COLUMN IF NOT EXISTS despesas_nao_aceites numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ta_base_nao_doc numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ta_base_viaturas numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ta_rate_viaturas numeric NOT NULL DEFAULT 0.10;