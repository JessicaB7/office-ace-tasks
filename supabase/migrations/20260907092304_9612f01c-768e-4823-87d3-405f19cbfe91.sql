ALTER TABLE public.client_financial_settings
  ADD COLUMN IF NOT EXISTS relatorio_q1_entregue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS relatorio_q2_entregue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS relatorio_q3_entregue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS relatorio_q4_entregue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS relatorio_q1_data date,
  ADD COLUMN IF NOT EXISTS relatorio_q2_data date,
  ADD COLUMN IF NOT EXISTS relatorio_q3_data date,
  ADD COLUMN IF NOT EXISTS relatorio_q4_data date;