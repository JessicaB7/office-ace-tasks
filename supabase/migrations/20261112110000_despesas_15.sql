-- TI Simplificado: despesas justificadas extra (e-Fatura, rendas, 1,5% VPT...) para o teste
-- dos 15% do art. 31.º n.º 13 do CIRS (coeficientes 0,75 e 0,35).
alter table public.client_financial_settings
  add column if not exists despesas_15_extra numeric not null default 0;
