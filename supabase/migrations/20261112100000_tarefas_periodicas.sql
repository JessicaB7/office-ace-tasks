-- Tarefas periódicas: séries (task_recurrences) que geram tarefas normais em public.tasks.
--  - Cada ocorrência é uma tarefa com tasks.recurrence_id; nunca há mais do que uma aberta por série.
--  - Concluir (ou cancelar) uma ocorrência cria logo a seguinte (trigger).
--  - Job diário (pg_cron) cria a próxima ocorrência lead_days antes do prazo (default 7).
--  - Cálculo das datas igual a src/lib/taskRecurrence.ts.

-- ============================================================================
-- Tabela
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.task_recurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Modelo da tarefa
  title TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  collaborator_id UUID REFERENCES public.collaborators(id) ON DELETE SET NULL,
  category public.task_category NOT NULL DEFAULT 'contabilidade',
  priority public.task_priority NOT NULL DEFAULT 'media',
  -- Regra
  frequency TEXT NOT NULL CHECK (frequency IN ('semanal', 'mensal', 'trimestral', 'anual')),
  interval_n INTEGER NOT NULL DEFAULT 1 CHECK (interval_n BETWEEN 1 AND 52),
  day_mode TEXT NOT NULL DEFAULT 'dia' CHECK (day_mode IN ('dia', 'ultimo_dia_util', 'ultimo_dia')),
  day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31),
  weekday INTEGER CHECK (weekday BETWEEN 1 AND 7), -- ISO: 1 = segunda … 7 = domingo
  start_date DATE NOT NULL,
  end_date DATE,
  lead_days INTEGER NOT NULL DEFAULT 7 CHECK (lead_days BETWEEN 0 AND 90),
  -- Estado
  next_due_date DATE, -- prazo da próxima ocorrência ainda por criar (null = série terminada)
  active BOOLEAN NOT NULL DEFAULT true,
  last_generated_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.collaborators(id) ON DELETE SET NULL DEFAULT public.current_collaborator_id(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_recurrences_next ON public.task_recurrences(next_due_date) WHERE active;

DROP TRIGGER IF EXISTS update_task_recurrences_updated_at ON public.task_recurrences;
CREATE TRIGGER update_task_recurrences_updated_at
  BEFORE UPDATE ON public.task_recurrences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recurrence_id UUID
  REFERENCES public.task_recurrences(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_recurrence_due ON public.tasks(recurrence_id, due_date);

-- ============================================================================
-- RLS: a admin vê todas; cada colaborador vê as que criou ou de que é responsável.
-- ============================================================================
ALTER TABLE public.task_recurrences ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_recurrences TO authenticated;
GRANT ALL ON public.task_recurrences TO service_role;

DO $$ BEGIN
  CREATE POLICY "Ver tarefas periódicas próprias ou admin" ON public.task_recurrences
    FOR SELECT TO authenticated USING (
      public.has_role(auth.uid(), 'admin')
      OR collaborator_id = public.current_collaborator_id()
      OR created_by = public.current_collaborator_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Colaboradores criam tarefas periódicas" ON public.task_recurrences
    FOR INSERT TO authenticated WITH CHECK (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public.collaborators c WHERE c.user_id = auth.uid() AND c.active));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Alterar tarefas periódicas próprias ou admin" ON public.task_recurrences
    FOR UPDATE TO authenticated USING (
      public.has_role(auth.uid(), 'admin')
      OR collaborator_id = public.current_collaborator_id()
      OR created_by = public.current_collaborator_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Apagar tarefas periódicas próprias ou admin" ON public.task_recurrences
    FOR DELETE TO authenticated USING (
      public.has_role(auth.uid(), 'admin')
      OR collaborator_id = public.current_collaborator_id()
      OR created_by = public.current_collaborator_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Cálculo das datas (igual a src/lib/taskRecurrence.ts)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.task_recurrence_occurrence(
  p_freq TEXT, p_interval INTEGER, p_day_mode TEXT, p_dom INTEGER, p_weekday INTEGER, p_start DATE, p_i INTEGER)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  n INTEGER := GREATEST(1, COALESCE(p_interval, 1));
  v_base DATE;
  v_idx INTEGER;
  v_first DATE;
  v_last DATE;
  v_day INTEGER;
BEGIN
  IF p_freq = 'semanal' THEN
    v_base := p_start + ((COALESCE(p_weekday, EXTRACT(ISODOW FROM p_start)::int) - EXTRACT(ISODOW FROM p_start)::int + 7) % 7);
    RETURN v_base + 7 * n * p_i;
  END IF;
  v_idx := EXTRACT(YEAR FROM p_start)::int * 12 + EXTRACT(MONTH FROM p_start)::int - 1
           + p_i * n * CASE p_freq WHEN 'mensal' THEN 1 WHEN 'trimestral' THEN 3 ELSE 12 END;
  v_first := make_date(v_idx / 12, v_idx % 12 + 1, 1);
  v_last := (v_first + interval '1 month' - interval '1 day')::date;
  IF p_day_mode = 'ultimo_dia' THEN
    RETURN v_last;
  ELSIF p_day_mode = 'ultimo_dia_util' THEN
    WHILE EXTRACT(ISODOW FROM v_last) >= 6 LOOP v_last := v_last - 1; END LOOP;
    RETURN v_last;
  END IF;
  v_day := LEAST(GREATEST(1, COALESCE(p_dom, EXTRACT(DAY FROM p_start)::int)), EXTRACT(DAY FROM v_last)::int);
  RETURN v_first + (v_day - 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.task_recurrence_next(
  p_freq TEXT, p_interval INTEGER, p_day_mode TEXT, p_dom INTEGER, p_weekday INTEGER,
  p_start DATE, p_end DATE, p_after DATE, p_inclusive BOOLEAN DEFAULT false)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  n INTEGER := GREATEST(1, COALESCE(p_interval, 1));
  i INTEGER;
  v_occ DATE;
  v_guard INTEGER := 0;
BEGIN
  IF p_freq = 'semanal' THEN
    i := GREATEST(0, floor((p_after - public.task_recurrence_occurrence(p_freq, n, p_day_mode, p_dom, p_weekday, p_start, 0))::numeric / (7 * n))::int - 1);
  ELSE
    i := GREATEST(0, floor(((EXTRACT(YEAR FROM p_after)::int * 12 + EXTRACT(MONTH FROM p_after)::int)
                           - (EXTRACT(YEAR FROM p_start)::int * 12 + EXTRACT(MONTH FROM p_start)::int))::numeric
                          / (n * CASE p_freq WHEN 'mensal' THEN 1 WHEN 'trimestral' THEN 3 ELSE 12 END))::int - 1);
  END IF;
  v_occ := public.task_recurrence_occurrence(p_freq, n, p_day_mode, p_dom, p_weekday, p_start, i);
  WHILE (CASE WHEN p_inclusive THEN v_occ < p_after ELSE v_occ <= p_after END) OR v_occ < p_start LOOP
    i := i + 1;
    v_occ := public.task_recurrence_occurrence(p_freq, n, p_day_mode, p_dom, p_weekday, p_start, i);
    v_guard := v_guard + 1;
    IF v_guard > 1000 THEN RETURN NULL; END IF;
  END LOOP;
  IF p_end IS NOT NULL AND v_occ > p_end THEN RETURN NULL; END IF;
  RETURN v_occ;
END;
$$;

GRANT EXECUTE ON FUNCTION public.task_recurrence_occurrence(TEXT, INTEGER, TEXT, INTEGER, INTEGER, DATE, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.task_recurrence_next(TEXT, INTEGER, TEXT, INTEGER, INTEGER, DATE, DATE, DATE, BOOLEAN) TO authenticated, service_role;

-- ============================================================================
-- Geração de uma ocorrência (interna: sem verificação de permissões)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.task_recurrence_generate(p_id UUID, p_force BOOLEAN DEFAULT false)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.task_recurrences;
  v_today DATE := (now() AT TIME ZONE 'Europe/Lisbon')::date;
  v_task UUID;
  v_due DATE;
  v_target UUID;
  v_client TEXT;
  v_tries INTEGER := 0;
BEGIN
  -- Bloqueia a série: duas gerações em simultâneo não criam duas ocorrências abertas.
  SELECT * INTO r FROM public.task_recurrences WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT r.active THEN RETURN NULL; END IF;

  IF EXISTS (SELECT 1 FROM public.tasks t WHERE t.recurrence_id = p_id
              AND t.status IN ('pendente', 'em_progresso')) THEN
    RETURN NULL;
  END IF;

  WHILE v_task IS NULL AND r.next_due_date IS NOT NULL AND v_tries < 5 LOOP
    v_tries := v_tries + 1;
    v_due := r.next_due_date;
    IF r.end_date IS NOT NULL AND v_due > r.end_date THEN
      r.next_due_date := NULL;
      EXIT;
    END IF;
    IF NOT p_force AND v_due - r.lead_days > v_today THEN
      EXIT;
    END IF;

    INSERT INTO public.tasks (title, description, client_id, collaborator_id, category, priority,
                              status, due_date, created_by, recurrence_id)
    VALUES (r.title, r.description, r.client_id, r.collaborator_id, r.category, r.priority,
            'pendente', v_due, r.created_by, r.id)
    ON CONFLICT (recurrence_id, due_date) DO NOTHING
    RETURNING id INTO v_task;

    r.next_due_date := public.task_recurrence_next(r.frequency, r.interval_n, r.day_mode, r.day_of_month,
                                                   r.weekday, r.start_date, r.end_date, v_due, false);
  END LOOP;

  UPDATE public.task_recurrences
     SET next_due_date = r.next_due_date,
         last_generated_at = CASE WHEN v_task IS NOT NULL THEN now() ELSE last_generated_at END
   WHERE id = p_id;

  -- Aviso no sino (e push) para a responsável, exceto se for quem está a fazer a ação.
  IF v_task IS NOT NULL AND r.collaborator_id IS NOT NULL THEN
    v_target := public.collaborator_notify_user(r.collaborator_id);
    IF v_target IS NOT NULL AND v_target IS DISTINCT FROM auth.uid() THEN
      SELECT name INTO v_client FROM public.clients WHERE id = r.client_id;
      INSERT INTO public.notifications (user_id, title, message, type, data)
      VALUES (v_target, 'Nova tarefa periódica', r.title || COALESCE(' — ' || v_client, ''), 'task_assigned',
              jsonb_build_object('task_id', v_task, 'task_title', r.title, 'client_name', v_client,
                                 'due_date', v_due, 'priority', r.priority,
                                 'assigned_by', (SELECT name FROM public.collaborators WHERE id = r.created_by)));
    END IF;
  END IF;

  RETURN v_task;
END;
$$;
REVOKE ALL ON FUNCTION public.task_recurrence_generate(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.task_recurrence_generate(UUID, BOOLEAN) TO service_role;

-- RPC da app: cria já a ocorrência em aberto (se não houver) — usada ao criar/retomar uma série.
CREATE OR REPLACE FUNCTION public.task_recurrence_start(p_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.task_recurrences r WHERE r.id = p_id AND (
      public.has_role(auth.uid(), 'admin')
      OR r.collaborator_id = public.current_collaborator_id()
      OR r.created_by = public.current_collaborator_id())) THEN
    RAISE EXCEPTION 'Sem permissão para esta tarefa periódica';
  END IF;
  RETURN public.task_recurrence_generate(p_id, true);
END;
$$;
REVOKE ALL ON FUNCTION public.task_recurrence_start(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.task_recurrence_start(UUID) TO authenticated, service_role;

-- ============================================================================
-- Concluir/cancelar uma ocorrência cria a seguinte
-- ============================================================================
CREATE OR REPLACE FUNCTION public.task_recurrence_on_task_done()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.recurrence_id IS NOT NULL
     AND NEW.status IN ('concluida', 'cancelada')
     AND OLD.status NOT IN ('concluida', 'cancelada') THEN
    PERFORM public.task_recurrence_generate(NEW.recurrence_id, true);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.task_recurrence_on_task_done() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS task_recurrence_next_occurrence ON public.tasks;
CREATE TRIGGER task_recurrence_next_occurrence
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.task_recurrence_on_task_done();

-- ============================================================================
-- Job diário: garante a próxima ocorrência lead_days antes do prazo
-- ============================================================================
CREATE OR REPLACE FUNCTION public.run_task_recurrences()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Europe/Lisbon')::date;
  v_n INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.task_recurrences
            WHERE active AND next_due_date IS NOT NULL AND next_due_date - lead_days <= v_today LOOP
    IF public.task_recurrence_generate(r.id, false) IS NOT NULL THEN v_n := v_n + 1; END IF;
  END LOOP;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.run_task_recurrences() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_task_recurrences() TO service_role;

-- Todos os dias às 06:30 UTC (06:30/07:30 em Lisboa), antes dos alertas diários.
SELECT cron.schedule('run-task-recurrences', '30 6 * * *', $cron$ SELECT public.run_task_recurrences(); $cron$);
