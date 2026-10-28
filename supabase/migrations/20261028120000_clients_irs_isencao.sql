-- Benefício de IRS por cliente (ex.: Programa Regressar 50%, IRS Jovem): fração do rendimento
-- isenta de IRS, aplicada ao rendimento coletável nos dashboards TI (simplificado e organizado).
alter table public.clients add column if not exists irs_isencao_pct numeric not null default 0
  check (irs_isencao_pct >= 0 and irs_isencao_pct <= 1);
