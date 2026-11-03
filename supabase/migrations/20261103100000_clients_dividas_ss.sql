-- Controlo de dívidas CRM: estado da dívida à Segurança Social (ao lado da AT).
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS divida_ss TEXT NOT NULL DEFAULT 'por_verificar'
    CHECK (divida_ss IN ('por_verificar', 'sem_divida', 'com_divida'));
