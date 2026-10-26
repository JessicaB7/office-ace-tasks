-- Tratamento no contrato (TI: o/a cliente; Empresa: sócio/sócia-gerente). 'f' = Segunda Outorgante, 'm' = Segundo Outorgante.
alter table public.client_onboardings add column if not exists genero text check (genero in ('f', 'm'));
