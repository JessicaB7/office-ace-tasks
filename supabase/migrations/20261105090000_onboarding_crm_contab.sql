-- Checklist dos novos clientes: «CRM Contab» (cliente registado no CRM Contab).
ALTER TABLE public.client_onboardings ADD COLUMN IF NOT EXISTS crm_contab BOOLEAN NOT NULL DEFAULT false;
