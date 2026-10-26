-- Notas IRS (só TI RS / TI CO): notas internas da análise, não aparecem no PDF exportado.
alter table public.client_financial_settings add column if not exists notas_irs text;
