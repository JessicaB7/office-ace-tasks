-- Preparação automática do contrato (serviço local no Mac da admin): pasta no OneDrive + contrato Word
-- preenchido a partir do formulário. A app mostra o estado no processo do novo cliente.
alter table public.client_onboardings add column if not exists contrato_preparado_at timestamptz;
alter table public.client_onboardings add column if not exists contrato_ficheiro text;
alter table public.client_onboardings add column if not exists contrato_erro text;
