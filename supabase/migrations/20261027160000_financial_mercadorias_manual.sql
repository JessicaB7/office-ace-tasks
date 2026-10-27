-- Gastos com mercadorias editáveis no dashboard TI Organizado: valor anual introduzido à mão
-- (null = usa o automático, conta 31 dos mapas/balancetes).
alter table public.client_financial_settings add column if not exists mercadorias_valor numeric;
