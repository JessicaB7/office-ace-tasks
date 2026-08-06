ALTER TABLE public.client_financial_settings
  ADD COLUMN IF NOT EXISTS iva_regime text NOT NULL DEFAULT 'trimestral',
  ADD COLUMN IF NOT EXISTS iva_monthly jsonb,
  ADD COLUMN IF NOT EXISTS irc_regime text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS irc_coef numeric NOT NULL DEFAULT 0.10;