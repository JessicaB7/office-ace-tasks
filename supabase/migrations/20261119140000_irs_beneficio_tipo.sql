-- Tipo de benefício de IRS do cliente: IRS Jovem (limite 55 × IAS, englobamento para a taxa) ou Programa Regressar.
alter table public.clients
  add column if not exists irs_beneficio text not null default 'jovem'
  check (irs_beneficio in ('jovem', 'regressar'));

-- Clientes com «programa regressar» nas notas do IRS
update public.clients c set irs_beneficio = 'regressar'
where coalesce(c.irs_isencao_pct, 0) > 0
  and exists (select 1 from public.client_financial_settings s where s.client_id = c.id and s.notas_irs ilike '%regressar%');
