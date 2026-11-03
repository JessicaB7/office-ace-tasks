-- Tarefas: "Atribuída por" preenchido sempre e aviso a quem atribuiu quando a tarefa é concluída.

-- Colaborador da sessão atual. A admin (geral@) não tem colaborador ligado: conta como a Responsável.
CREATE OR REPLACE FUNCTION public.current_collaborator_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT id FROM public.collaborators WHERE user_id = auth.uid() LIMIT 1),
    (SELECT id FROM public.collaborators
      WHERE role = 'Responsável' AND public.has_role(auth.uid(), 'admin')
      ORDER BY created_at LIMIT 1)
  );
$$;

-- Utilizador a avisar para um colaborador (a Responsável sem login próprio recebe na conta da admin).
CREATE OR REPLACE FUNCTION public.collaborator_notify_user(_collaborator_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    c.user_id,
    CASE WHEN c.role = 'Responsável'
      THEN (SELECT user_id FROM public.user_roles WHERE role = 'admin' ORDER BY user_id LIMIT 1)
    END
  )
  FROM public.collaborators c
  WHERE c.id = _collaborator_id;
$$;

-- Ao criar uma tarefa sem autor, regista quem a criou.
CREATE OR REPLACE FUNCTION public.set_task_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Os follow ups de consultoria são criados pela própria app (trigger da lead): ficam sem autor.
  IF NEW.created_by IS NULL AND NEW.title NOT LIKE 'Follow up consultoria%' THEN
    NEW.created_by := public.current_collaborator_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_task_created_by ON public.tasks;
CREATE TRIGGER set_task_created_by
  BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_task_created_by();

-- Tarefa concluída: avisa quem a atribuiu (se não for a mesma pessoa que a fez).
CREATE OR REPLACE FUNCTION public.notify_task_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target uuid;
  _who text;
  _client text;
BEGIN
  IF NEW.status = 'concluida' AND OLD.status IS DISTINCT FROM 'concluida'
     AND NEW.created_by IS NOT NULL
     AND NEW.created_by IS DISTINCT FROM NEW.collaborator_id THEN
    _target := public.collaborator_notify_user(NEW.created_by);
    IF _target IS NULL OR _target = auth.uid() THEN
      RETURN NEW;
    END IF;
    SELECT name INTO _who FROM public.collaborators WHERE id = NEW.collaborator_id;
    SELECT name INTO _client FROM public.clients WHERE id = NEW.client_id;
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (
      _target,
      'Tarefa concluída',
      NEW.title || COALESCE(' — ' || _client, '') || COALESCE(' · por ' || _who, ''),
      'task_completed',
      jsonb_build_object('task_id', NEW.id, 'task_title', NEW.title, 'client_name', _client, 'completed_by', _who)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_task_completed ON public.tasks;
CREATE TRIGGER notify_task_completed
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_completed();

-- Tarefas antigas sem autor (criadas pela admin, que não tinha colaborador ligado): passam para a Responsável.
-- Os follow ups de consultoria são criados automaticamente pela app e ficam sem autor.
UPDATE public.tasks
   SET created_by = (SELECT id FROM public.collaborators WHERE role = 'Responsável' ORDER BY created_at LIMIT 1)
 WHERE created_by IS NULL
   AND title NOT LIKE 'Follow up consultoria%';
