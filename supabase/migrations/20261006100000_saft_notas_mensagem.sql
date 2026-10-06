-- Obrigações SAFT: coluna Notas por cliente (mantém-se de mês para mês)
-- e "Mensagem a enviar" editável no topo da página, guardada por tipo de obrigação.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notas_saft TEXT;

CREATE TABLE IF NOT EXISTS public.obligation_messages (
  obligation_type TEXT PRIMARY KEY,
  message TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.obligation_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obligation_messages TO authenticated;
GRANT ALL ON public.obligation_messages TO service_role;

DO $$ BEGIN
  CREATE POLICY "Utilizadores autenticados gerem mensagens das obrigações"
    ON public.obligation_messages FOR ALL TO authenticated
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
