-- Painel de erros das automações TOConline.
-- "Repetir" uma tarefa com erro/bloqueada: como toconline_jobs só admite uma linha por
-- procedimento × cliente × mês (usado pelo upsert da ativação e pela skill /toconline-fila),
-- a tentativa falhada é guardada em toconline_job_attempts e a tarefa volta a "pendente".

CREATE TABLE IF NOT EXISTS public.toconline_job_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.toconline_jobs(id) ON DELETE CASCADE,
  procedure_id TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  reference_month DATE,
  status TEXT NOT NULL,
  result_notes TEXT,
  result_data JSONB,
  requested_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  archived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_toconline_job_attempts_job ON public.toconline_job_attempts(job_id, archived_at DESC);

ALTER TABLE public.toconline_job_attempts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.toconline_job_attempts TO authenticated;
GRANT ALL ON public.toconline_job_attempts TO service_role;

DO $$ BEGIN
  CREATE POLICY "Equipa vê tentativas TOConline" ON public.toconline_job_attempts
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.toconline_job_retry(p_job_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n INTEGER;
BEGIN
  IF auth.uid() IS NULL OR NOT (
       public.has_role(auth.uid(), 'admin')
       OR EXISTS (SELECT 1 FROM public.collaborators c WHERE c.user_id = auth.uid() AND c.active)) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  INSERT INTO public.toconline_job_attempts
    (job_id, procedure_id, client_id, reference_month, status, result_notes, result_data, requested_at, started_at, finished_at, archived_by)
  SELECT j.id, j.procedure_id, j.client_id, j.reference_month, j.status, j.result_notes, j.result_data,
         j.requested_at, j.started_at, j.finished_at, auth.uid()
    FROM public.toconline_jobs j
   WHERE j.id = ANY(p_job_ids) AND j.status IN ('erro', 'bloqueada');

  UPDATE public.toconline_jobs
     SET status = 'pendente', result_notes = NULL, result_data = NULL,
         started_at = NULL, finished_at = NULL, requested_by = auth.uid(), requested_at = now()
   WHERE id = ANY(p_job_ids) AND status IN ('erro', 'bloqueada');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.toconline_job_retry(UUID[]) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.toconline_job_retry(UUID[]) TO authenticated;
