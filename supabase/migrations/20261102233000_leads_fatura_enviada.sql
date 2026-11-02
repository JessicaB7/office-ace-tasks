-- Consultorias: visto "Fatura enviada" na lead (a fatura emite-se à sexta-feira após a sessão).
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS invoice_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_sent_at timestamptz;
