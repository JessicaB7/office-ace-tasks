-- IRS em conjunto (TI): opção por ano e dados do cônjuge para o quociente conjugal (art. 69.º CIRS).
alter table public.client_financial_settings
  add column if not exists irs_conjunto boolean not null default false,
  add column if not exists conjuge_rendimento numeric not null default 0,
  add column if not exists conjuge_rendimento_tipo text not null default 'bruto_a'
    check (conjuge_rendimento_tipo in ('bruto_a', 'coletavel')),
  add column if not exists conjuge_retencoes numeric not null default 0,
  add column if not exists conjuge_deducoes numeric not null default 250;
