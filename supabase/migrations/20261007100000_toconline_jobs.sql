-- Fila de tarefas TOConline: a equipa ativa procedimentos (ex.: "Importar as
-- vendas") por cliente e mês; o Claude (Claude in Chrome, no Mac da Jéssica)
-- executa-os no TOConline e regista aqui o resultado.
--
-- Estados: pendente → em_curso → concluida | bloqueada | erro; cancelada.
-- Uma tarefa por procedimento × cliente × mês (reativar repõe o estado).

CREATE TABLE IF NOT EXISTS public.toconline_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'em_curso', 'concluida', 'bloqueada', 'erro', 'cancelada')),
  result_notes TEXT,
  requested_by UUID,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT toconline_jobs_unique UNIQUE (procedure_id, client_id, reference_month)
);

CREATE INDEX IF NOT EXISTS idx_toconline_jobs_status ON public.toconline_jobs(status);
CREATE INDEX IF NOT EXISTS idx_toconline_jobs_month ON public.toconline_jobs(reference_month);

DROP TRIGGER IF EXISTS update_toconline_jobs_updated_at ON public.toconline_jobs;
CREATE TRIGGER update_toconline_jobs_updated_at
  BEFORE UPDATE ON public.toconline_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.toconline_jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.toconline_jobs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toconline_jobs TO authenticated;
GRANT ALL ON public.toconline_jobs TO service_role;

DO $$ BEGIN
  CREATE POLICY "Equipa vê a fila TOConline" ON public.toconline_jobs
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Equipa ativa tarefas TOConline" ON public.toconline_jobs
    FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Equipa atualiza tarefas TOConline" ON public.toconline_jobs
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admin apaga tarefas TOConline" ON public.toconline_jobs
    FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
