-- Cronómetro de trabalho por cliente — registos de início/fim para medir
-- quanto tempo cada colaborador passa realmente a tratar de cada cliente
-- (pedido: "Painel — Gestão Mensal", secção "Por colaborador").
--
-- Um registo "em curso" tem ended_at = NULL; um colaborador só pode ter um
-- registo em curso de cada vez (índice único parcial abaixo).

CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  collaborator_id UUID REFERENCES public.collaborators(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT time_entries_ended_after_started CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- Só um cronómetro em curso por colaborador.
CREATE UNIQUE INDEX IF NOT EXISTS idx_time_entries_one_running_per_collaborator
  ON public.time_entries(collaborator_id) WHERE ended_at IS NULL AND collaborator_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_time_entries_client ON public.time_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_collaborator ON public.time_entries(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_started_at ON public.time_entries(started_at DESC);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;

-- Cada colaborador só vê/gere os próprios registos; admin vê e gere tudo
-- (mesma lógica de acesso já usada no Painel — Gestão Mensal).
DO $$ BEGIN
  CREATE POLICY "Colaboradores veem os próprios registos de tempo, admin vê tudo"
    ON public.time_entries FOR SELECT TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR collaborator_id IN (SELECT id FROM public.collaborators WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Colaboradores criam os próprios registos de tempo"
    ON public.time_entries FOR INSERT TO authenticated
    WITH CHECK (
      public.has_role(auth.uid(), 'admin')
      OR collaborator_id IN (SELECT id FROM public.collaborators WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Colaboradores atualizam os próprios registos de tempo"
    ON public.time_entries FOR UPDATE TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR collaborator_id IN (SELECT id FROM public.collaborators WHERE user_id = auth.uid())
    )
    WITH CHECK (
      public.has_role(auth.uid(), 'admin')
      OR collaborator_id IN (SELECT id FROM public.collaborators WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Colaboradores apagam os próprios registos de tempo"
    ON public.time_entries FOR DELETE TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR collaborator_id IN (SELECT id FROM public.collaborators WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
