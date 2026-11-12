-- Histórico de contactos por cliente (client_contacts) + linha do tempo (client_timeline).
-- Um contacto com "seguimento_em" cria uma tarefa para quem o registou, com esse prazo.

CREATE TABLE IF NOT EXISTS public.client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  collaborator_id UUID REFERENCES public.collaborators(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('email', 'chamada', 'whatsapp', 'reuniao', 'pedido_documentos', 'outro')),
  data DATE NOT NULL DEFAULT current_date,
  resumo TEXT NOT NULL,
  seguimento_em DATE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_contacts_client ON public.client_contacts(client_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_client_contacts_tipo ON public.client_contacts(tipo, data);

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_contacts TO authenticated;
GRANT ALL ON public.client_contacts TO service_role;

DO $$ BEGIN
  CREATE POLICY "Equipa vê contactos" ON public.client_contacts
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Equipa regista contactos" ON public.client_contacts
    FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Autor ou admin edita contactos" ON public.client_contacts
    FOR UPDATE TO authenticated
    USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Autor ou admin apaga contactos" ON public.client_contacts
    FOR DELETE TO authenticated
    USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seguimento → tarefa para quem registou o contacto.
CREATE OR REPLACE FUNCTION public.client_contact_followup_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_collab UUID;
  v_task UUID;
  v_tipo TEXT;
BEGIN
  IF NEW.seguimento_em IS NULL OR NEW.task_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT name INTO v_name FROM public.clients WHERE id = NEW.client_id;
  v_collab := COALESCE(NEW.collaborator_id,
    (SELECT id FROM public.collaborators WHERE user_id = COALESCE(NEW.created_by, auth.uid()) LIMIT 1));
  v_tipo := CASE NEW.tipo
    WHEN 'email' THEN 'email' WHEN 'chamada' THEN 'chamada' WHEN 'whatsapp' THEN 'WhatsApp'
    WHEN 'reuniao' THEN 'reunião' WHEN 'pedido_documentos' THEN 'pedido de documentos' ELSE 'contacto' END;
  INSERT INTO public.tasks (title, description, due_date, category, priority, status, collaborator_id, client_id)
  VALUES ('Seguimento – ' || COALESCE(v_name, 'cliente'),
          'Seguimento do ' || v_tipo || ' de ' || to_char(NEW.data, 'DD/MM/YYYY') || ': ' || NEW.resumo,
          NEW.seguimento_em, 'outro', 'media', 'pendente', v_collab, NEW.client_id)
  RETURNING id INTO v_task;
  NEW.task_id := v_task;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.client_contact_followup_task() FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS client_contact_followup_task ON public.client_contacts;
CREATE TRIGGER client_contact_followup_task
  BEFORE INSERT OR UPDATE OF seguimento_em ON public.client_contacts
  FOR EACH ROW EXECUTE FUNCTION public.client_contact_followup_task();

-- Linha do tempo do cliente: contactos registados + emails enviados pela app para o email
-- do cliente + mudanças de responsável + notas das obrigações mensais. Mais recentes primeiro.
CREATE OR REPLACE FUNCTION public.client_timeline(p_client_id UUID)
RETURNS TABLE (
  origem TEXT,
  id TEXT,
  quando TIMESTAMPTZ,
  tipo TEXT,
  titulo TEXT,
  resumo TEXT,
  autor TEXT,
  seguimento_em DATE,
  created_by UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH c AS (SELECT id, lower(trim(email)) AS email FROM public.clients WHERE id = p_client_id)
  SELECT * FROM (
    SELECT 'contacto'::text, cc.id::text, (cc.data::timestamp + time '12:00')::timestamptz, cc.tipo,
           NULL::text, cc.resumo, col.name, cc.seguimento_em, cc.created_by
      FROM public.client_contacts cc
      LEFT JOIN public.collaborators col ON col.id = cc.collaborator_id
     WHERE cc.client_id = p_client_id
    UNION ALL
    SELECT 'email', e.message_id, e.created_at, 'email_app',
           COALESCE(e.metadata->>'subject', e.template_name), e.status, NULL, NULL, NULL
      FROM (
        SELECT DISTINCT ON (l.message_id) l.*
          FROM public.email_send_log l, c
         WHERE c.email IS NOT NULL AND c.email <> '' AND lower(l.recipient_email) = c.email
         ORDER BY l.message_id, l.created_at DESC
      ) e
    UNION ALL
    SELECT 'responsavel', a.id::text, a.alterado_em, 'responsavel',
           NULL, COALESCE(a.valor_antigo, 'Sem responsável') || ' → ' || COALESCE(a.valor_novo, 'Sem responsável'),
           (SELECT name FROM public.collaborators WHERE user_id = a.alterado_por LIMIT 1), NULL, NULL
      FROM public.audit_log a
     WHERE a.tabela = 'clients' AND a.registo_id = p_client_id AND a.campo = 'responsavel_id'
    UNION ALL
    SELECT 'nota_obrigacao', mo.id::text, mo.updated_at, 'nota_obrigacao',
           mo.obligation_type || ' · ' || to_char(mo.reference_month, 'MM/YYYY'), mo.notes, NULL, NULL, NULL
      FROM public.monthly_obligations mo
     WHERE mo.client_id = p_client_id AND mo.notes IS NOT NULL AND btrim(mo.notes) <> ''
  ) t
  ORDER BY 3 DESC
  LIMIT 300;
$$;

REVOKE ALL ON FUNCTION public.client_timeline(UUID) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_timeline(UUID) TO authenticated, service_role;
