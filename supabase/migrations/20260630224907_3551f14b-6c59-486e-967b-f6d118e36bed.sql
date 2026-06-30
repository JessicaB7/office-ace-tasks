
INSERT INTO public.financial_accounts (code, name, section, display_order) VALUES
  ('2436', 'IVA Apuramento - a pagar', 'iva_vendas', 900),
  ('2437', 'IVA Apuramento - a recuperar', 'iva_compras', 901)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.client_financial_settings
  ADD COLUMN IF NOT EXISTS irs_retencoes numeric NOT NULL DEFAULT 0;
