-- Outros rendimentos (TI): valor manual que soma ao rendimento coletável no cálculo do IRS.
alter table public.client_financial_settings
  add column if not exists outros_rendimentos_valor numeric not null default 0;
