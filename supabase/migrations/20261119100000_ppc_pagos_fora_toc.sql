-- Pagamentos por conta de IRS pagos que não estão lançados no TOConline (somam à conta 241 na análise TI).
alter table public.client_financial_settings
  add column if not exists ppc_pagos_fora_toc numeric not null default 0;
