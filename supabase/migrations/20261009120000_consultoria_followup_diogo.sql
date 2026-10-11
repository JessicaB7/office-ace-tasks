CREATE OR REPLACE FUNCTION public.sync_consultoria_followup_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_collab uuid;
  v_task uuid;
BEGIN
  SELECT id INTO v_collab FROM public.collaborators
   WHERE active AND name ILIKE 'Diogo%' ORDER BY created_at LIMIT 1;

  SELECT id INTO v_task FROM public.tasks WHERE lead_id = NEW.id LIMIT 1;

  IF NEW.segment = 'consultoria'
     AND NEW.next_followup IS NOT NULL
     AND NEW.stage NOT IN ('mensal_sim','mensal_nao')
     AND v_collab IS NOT NULL THEN
    IF v_task IS NULL THEN
      INSERT INTO public.tasks (title, due_date, category, priority, status, collaborator_id, lead_id)
      VALUES ('Follow up consultoria — ' || NEW.name, NEW.next_followup, 'outro', 'media', 'pendente', v_collab, NEW.id);
    ELSE
      UPDATE public.tasks
         SET title = 'Follow up consultoria — ' || NEW.name,
             due_date = NEW.next_followup,
             collaborator_id = v_collab,
             status = CASE WHEN status IN ('concluida','cancelada') THEN 'pendente'::task_status ELSE status END
       WHERE id = v_task;
    END IF;
  ELSE
    IF v_task IS NOT NULL THEN
      DELETE FROM public.tasks WHERE id = v_task;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_consultoria_followup_task ON public.leads;
CREATE TRIGGER sync_consultoria_followup_task
AFTER INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.sync_consultoria_followup_task();

REVOKE ALL ON FUNCTION public.sync_consultoria_followup_task() FROM anon, authenticated, PUBLIC;

-- Follow ups de consultoria ainda em aberto passam para o Diogo (concluídas mantêm o histórico).
UPDATE public.tasks
   SET collaborator_id = (SELECT id FROM public.collaborators
                           WHERE active AND name ILIKE 'Diogo%' ORDER BY created_at LIMIT 1)
 WHERE lead_id IS NOT NULL
   AND status NOT IN ('concluida','cancelada')
   AND EXISTS (SELECT 1 FROM public.collaborators WHERE active AND name ILIKE 'Diogo%');
