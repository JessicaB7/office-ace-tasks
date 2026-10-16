-- Análise financeira: notas internas por cliente e ano (não aparecem no PDF exportado).
ALTER TABLE public.client_financial_settings ADD COLUMN IF NOT EXISTS notas text;
