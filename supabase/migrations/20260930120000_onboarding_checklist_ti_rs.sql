-- Checklist de novos clientes TI Simplificado: novos passos "Pasta Drive" e
-- "Resumo da sessão" (a seguir à sessão de onboarding).
ALTER TABLE public.client_onboardings
  ADD COLUMN IF NOT EXISTS pasta_drive BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resumo_sessao BOOLEAN NOT NULL DEFAULT false;
