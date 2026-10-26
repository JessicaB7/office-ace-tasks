-- Retenções na fonte / pagamentos por conta (241, incl. 2414): acumulado do ano lido do último balancete
-- importado (coluna Acumulado), para não depender de terem sido importados todos os trimestres.
alter table public.client_financial_settings add column if not exists ret_241_acum numeric;
alter table public.client_financial_settings add column if not exists ret_241_mes integer;
