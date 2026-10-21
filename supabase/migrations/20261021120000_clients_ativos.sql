-- Gestão Mensal (TI Organizado e Empresas): o cliente tem ativos? Se sim, desde quando.
-- Decide se existe a tarefa mensal "Depreciações" (declaração de depreciações).
alter table public.clients
  add column if not exists ativos boolean,
  add column if not exists ativos_desde date;

comment on column public.clients.ativos is 'Tem ativos (sim/não) — implica a tarefa Depreciações na Gestão Mensal';
comment on column public.clients.ativos_desde is 'Data desde quando o cliente tem ativos';
