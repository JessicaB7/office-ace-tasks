ALTER TABLE public.client_financial_settings
  ADD COLUMN IF NOT EXISTS outras_despesas_label text NOT NULL DEFAULT 'Outras despesas',
  ADD COLUMN IF NOT EXISTS outras_despesas_valor numeric NOT NULL DEFAULT 0;