-- Visão geral → Controlo de dívidas CRM: estado da dívida à AT (Finanças) e descrição, por cliente.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS divida_at TEXT NOT NULL DEFAULT 'por_verificar'
    CHECK (divida_at IN ('por_verificar', 'sem_divida', 'com_divida')),
  ADD COLUMN IF NOT EXISTS divida_descricao TEXT;
