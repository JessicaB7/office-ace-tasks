-- A) Saída de clientes: checklist em client_offboardings.
-- B) Acompanhamento dos primeiros 60 dias dos novos clientes (client_onboardings + tarefas).

-- ============================================================================
-- A) SAÍDA DE CLIENTES
-- ============================================================================

-- Último mês de que o escritório trata (cópia do registo de saída, para as vistas
-- de obrigações deixarem de mostrar o cliente nos meses seguintes).
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ultimo_mes_responsabilidade DATE;

CREATE TABLE IF NOT EXISTS public.client_offboardings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  responsavel_id UUID REFERENCES public.collaborators(id) ON DELETE SET NULL,
  data_aviso DATE,
  -- Guardado como o 1.º dia do mês
  ultimo_mes_responsabilidade DATE,
  motivo_saida TEXT CHECK (motivo_saida IN (
    'preco', 'servico', 'mudou_contabilista', 'fechou_atividade', 'empresa_outro_escritorio', 'outro'
  )),
  motivo_detalhe TEXT,
  notas TEXT,
  -- Checklist (cada item com a data em que foi marcado)
  confirmacao_escrita BOOLEAN NOT NULL DEFAULT false,
  confirmacao_escrita_at TIMESTAMPTZ,
  avencas_regularizadas BOOLEAN NOT NULL DEFAULT false,
  avencas_regularizadas_at TIMESTAMPTZ,
  ultimas_declaracoes BOOLEAN NOT NULL DEFAULT false,
  ultimas_declaracoes_at TIMESTAMPTZ,
  documentos_enviados BOOLEAN NOT NULL DEFAULT false,
  documentos_enviados_at TIMESTAMPTZ,
  renuncia_cc BOOLEAN NOT NULL DEFAULT false,
  renuncia_cc_at TIMESTAMPTZ,
  toconline_desativado BOOLEAN NOT NULL DEFAULT false,
  toconline_desativado_at TIMESTAMPTZ,
  crmcontab_desativado BOOLEAN NOT NULL DEFAULT false,
  crmcontab_desativado_at TIMESTAMPTZ,
  drive_arquivada BOOLEAN NOT NULL DEFAULT false,
  drive_arquivada_at TIMESTAMPTZ,
  motivo_registado BOOLEAN NOT NULL DEFAULT false,
  motivo_registado_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_offboardings_completed ON public.client_offboardings(completed_at);

DROP TRIGGER IF EXISTS update_client_offboardings_updated_at ON public.client_offboardings;
CREATE TRIGGER update_client_offboardings_updated_at
  BEFORE UPDATE ON public.client_offboardings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.client_offboardings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_offboardings TO authenticated;
GRANT ALL ON public.client_offboardings TO service_role;

DO $$ BEGIN
  CREATE POLICY "Equipa vê as saídas" ON public.client_offboardings
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Equipa cria saídas" ON public.client_offboardings
    FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Equipa atualiza saídas" ON public.client_offboardings
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admin apaga saídas" ON public.client_offboardings
    FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Datas de cada item + conclusão automática quando os 9 itens estão marcados.
CREATE OR REPLACE FUNCTION public.offboarding_checklist_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_old public.client_offboardings;
BEGIN
  IF TG_OP = 'UPDATE' THEN v_old := OLD; END IF;

  IF NEW.ultimo_mes_responsabilidade IS NOT NULL THEN
    NEW.ultimo_mes_responsabilidade := date_trunc('month', NEW.ultimo_mes_responsabilidade)::date;
  END IF;

  NEW.confirmacao_escrita_at   := CASE WHEN NOT NEW.confirmacao_escrita THEN NULL WHEN v_old.confirmacao_escrita IS TRUE THEN COALESCE(NEW.confirmacao_escrita_at, now()) ELSE now() END;
  NEW.avencas_regularizadas_at := CASE WHEN NOT NEW.avencas_regularizadas THEN NULL WHEN v_old.avencas_regularizadas IS TRUE THEN COALESCE(NEW.avencas_regularizadas_at, now()) ELSE now() END;
  NEW.ultimas_declaracoes_at   := CASE WHEN NOT NEW.ultimas_declaracoes THEN NULL WHEN v_old.ultimas_declaracoes IS TRUE THEN COALESCE(NEW.ultimas_declaracoes_at, now()) ELSE now() END;
  NEW.documentos_enviados_at   := CASE WHEN NOT NEW.documentos_enviados THEN NULL WHEN v_old.documentos_enviados IS TRUE THEN COALESCE(NEW.documentos_enviados_at, now()) ELSE now() END;
  NEW.renuncia_cc_at           := CASE WHEN NOT NEW.renuncia_cc THEN NULL WHEN v_old.renuncia_cc IS TRUE THEN COALESCE(NEW.renuncia_cc_at, now()) ELSE now() END;
  NEW.toconline_desativado_at  := CASE WHEN NOT NEW.toconline_desativado THEN NULL WHEN v_old.toconline_desativado IS TRUE THEN COALESCE(NEW.toconline_desativado_at, now()) ELSE now() END;
  NEW.crmcontab_desativado_at  := CASE WHEN NOT NEW.crmcontab_desativado THEN NULL WHEN v_old.crmcontab_desativado IS TRUE THEN COALESCE(NEW.crmcontab_desativado_at, now()) ELSE now() END;
  NEW.drive_arquivada_at       := CASE WHEN NOT NEW.drive_arquivada THEN NULL WHEN v_old.drive_arquivada IS TRUE THEN COALESCE(NEW.drive_arquivada_at, now()) ELSE now() END;
  NEW.motivo_registado_at      := CASE WHEN NOT NEW.motivo_registado THEN NULL WHEN v_old.motivo_registado IS TRUE THEN COALESCE(NEW.motivo_registado_at, now()) ELSE now() END;

  IF NEW.confirmacao_escrita AND NEW.avencas_regularizadas AND NEW.ultimas_declaracoes
     AND NEW.documentos_enviados AND NEW.renuncia_cc AND NEW.toconline_desativado
     AND NEW.crmcontab_desativado AND NEW.drive_arquivada AND NEW.motivo_registado THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  ELSE
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS offboarding_checklist_dates ON public.client_offboardings;
CREATE TRIGGER offboarding_checklist_dates
  BEFORE INSERT OR UPDATE ON public.client_offboardings
  FOR EACH ROW EXECUTE FUNCTION public.offboarding_checklist_dates();

-- Reflete a saída no cliente: último mês e estado (concluída → inativo; reaberta → a sair).
CREATE OR REPLACE FUNCTION public.offboarding_sync_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.clients
     SET ultimo_mes_responsabilidade = NEW.ultimo_mes_responsabilidade
   WHERE id = NEW.client_id
     AND ultimo_mes_responsabilidade IS DISTINCT FROM NEW.ultimo_mes_responsabilidade;

  IF NEW.completed_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.completed_at IS NULL) THEN
    UPDATE public.clients SET status = 'inativo', active = false WHERE id = NEW.client_id;
  ELSIF NEW.completed_at IS NULL AND TG_OP = 'UPDATE' AND OLD.completed_at IS NOT NULL THEN
    UPDATE public.clients SET status = 'a_sair', active = true WHERE id = NEW.client_id;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.offboarding_sync_client() FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS offboarding_sync_client ON public.client_offboardings;
CREATE TRIGGER offboarding_sync_client
  AFTER INSERT OR UPDATE ON public.client_offboardings
  FOR EACH ROW EXECUTE FUNCTION public.offboarding_sync_client();

-- Cliente passa a "a sair" → abre a checklist de saída.
CREATE OR REPLACE FUNCTION public.client_create_offboarding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'a_sair' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.client_offboardings (client_id, responsavel_id, data_aviso)
    VALUES (NEW.id, NEW.responsavel_id, current_date)
    ON CONFLICT (client_id) DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.client_create_offboarding() FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS clients_create_offboarding ON public.clients;
CREATE TRIGGER clients_create_offboarding
  AFTER INSERT OR UPDATE OF status ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.client_create_offboarding();

-- Clientes que já estão "a sair": abrir a checklist (sem data de aviso, que não se conhece).
INSERT INTO public.client_offboardings (client_id, responsavel_id)
SELECT id, responsavel_id FROM public.clients WHERE status = 'a_sair'
ON CONFLICT (client_id) DO NOTHING;

-- ============================================================================
-- B) ACOMPANHAMENTO DOS PRIMEIROS 60 DIAS
-- ============================================================================

ALTER TABLE public.client_onboardings
  ADD COLUMN IF NOT EXISTS boas_vindas_responsavel BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS boas_vindas_responsavel_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contacto_30_dias BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contacto_30_dias_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contacto_60_dias BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contacto_60_dias_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS feedback_60_dias TEXT;

-- Ligação das tarefas de acompanhamento ao onboarding.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS onboarding_id UUID REFERENCES public.client_onboardings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS onboarding_step TEXT CHECK (onboarding_step IN ('boas_vindas_responsavel', 'contacto_30_dias', 'contacto_60_dias'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_onboarding_step ON public.tasks(onboarding_id, onboarding_step)
  WHERE onboarding_id IS NOT NULL;

-- Datas dos contactos.
CREATE OR REPLACE FUNCTION public.onboarding_followup_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.boas_vindas_responsavel_at := CASE WHEN NOT NEW.boas_vindas_responsavel THEN NULL WHEN OLD.boas_vindas_responsavel THEN COALESCE(NEW.boas_vindas_responsavel_at, now()) ELSE now() END;
  NEW.contacto_30_dias_at := CASE WHEN NOT NEW.contacto_30_dias THEN NULL WHEN OLD.contacto_30_dias THEN COALESCE(NEW.contacto_30_dias_at, now()) ELSE now() END;
  NEW.contacto_60_dias_at := CASE WHEN NOT NEW.contacto_60_dias THEN NULL WHEN OLD.contacto_60_dias THEN COALESCE(NEW.contacto_60_dias_at, now()) ELSE now() END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS onboarding_followup_dates ON public.client_onboardings;
CREATE TRIGGER onboarding_followup_dates
  BEFORE UPDATE ON public.client_onboardings
  FOR EACH ROW EXECUTE FUNCTION public.onboarding_followup_dates();

-- Cria as 3 tarefas de acompanhamento de um onboarding (as que ainda não existem).
-- p_only_future: só cria as que têm prazo hoje ou depois (usado no preenchimento inicial).
CREATE OR REPLACE FUNCTION public.create_onboarding_followup_tasks(p_onboarding_id UUID, p_only_future BOOLEAN DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.client_onboardings;
  v_name TEXT;
  v_resp UUID;
  v_start DATE;
  s RECORD;
BEGIN
  SELECT * INTO o FROM public.client_onboardings WHERE id = p_onboarding_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT c.name, c.responsavel_id INTO v_name, v_resp FROM public.clients c WHERE c.id = o.client_id;
  v_name := COALESCE(v_name, NULLIF(o.answers->>'nome', ''), (SELECT l.name FROM public.leads l WHERE l.id = o.lead_id), 'novo cliente');
  v_resp := COALESCE(o.responsavel_id, v_resp);
  v_start := COALESCE(o.data_inicio, current_date);

  FOR s IN
    SELECT * FROM (VALUES
      ('boas_vindas_responsavel', 'Boas-vindas a ' || v_name, 2, o.boas_vindas_responsavel),
      ('contacto_30_dias', 'Contacto 30 dias – ' || v_name, 30, o.contacto_30_dias),
      ('contacto_60_dias', 'Ponto de situação 60 dias – ' || v_name, 60, o.contacto_60_dias)
    ) AS t(step, title, days, done)
  LOOP
    IF p_only_future AND v_start + s.days < current_date THEN CONTINUE; END IF;
    INSERT INTO public.tasks (title, due_date, category, priority, status, collaborator_id, client_id, onboarding_id, onboarding_step)
    VALUES (s.title, v_start + s.days, 'outro', 'media',
            CASE WHEN s.done THEN 'concluida'::task_status ELSE 'pendente'::task_status END,
            v_resp, o.client_id, o.id, s.step)
    ON CONFLICT (onboarding_id, onboarding_step) WHERE onboarding_id IS NOT NULL DO NOTHING;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.create_onboarding_followup_tasks(UUID, BOOLEAN) FROM anon, authenticated, PUBLIC;

-- Onboarding concluído → cria as tarefas. Contacto marcado/desmarcado no onboarding → acerta a tarefa.
CREATE OR REPLACE FUNCTION public.onboarding_followup_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    PERFORM public.create_onboarding_followup_tasks(NEW.id, false);
  END IF;

  UPDATE public.tasks t
     SET status = CASE
           WHEN (t.onboarding_step = 'boas_vindas_responsavel' AND NEW.boas_vindas_responsavel)
             OR (t.onboarding_step = 'contacto_30_dias' AND NEW.contacto_30_dias)
             OR (t.onboarding_step = 'contacto_60_dias' AND NEW.contacto_60_dias)
           THEN 'concluida'::task_status ELSE 'pendente'::task_status END
   WHERE t.onboarding_id = NEW.id
     AND t.status <> 'cancelada'
     AND (t.status = 'concluida') IS DISTINCT FROM (
           (t.onboarding_step = 'boas_vindas_responsavel' AND NEW.boas_vindas_responsavel)
        OR (t.onboarding_step = 'contacto_30_dias' AND NEW.contacto_30_dias)
        OR (t.onboarding_step = 'contacto_60_dias' AND NEW.contacto_60_dias));
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.onboarding_followup_sync() FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS onboarding_followup_sync ON public.client_onboardings;
CREATE TRIGGER onboarding_followup_sync
  AFTER UPDATE ON public.client_onboardings
  FOR EACH ROW EXECUTE FUNCTION public.onboarding_followup_sync();

-- Tarefa de acompanhamento concluída (ou reaberta) → marca o campo no onboarding.
CREATE OR REPLACE FUNCTION public.task_onboarding_step_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_done BOOLEAN := NEW.status = 'concluida';
BEGIN
  IF NEW.onboarding_id IS NULL OR NEW.onboarding_step IS NULL OR NEW.status = OLD.status THEN
    RETURN NULL;
  END IF;
  IF NEW.onboarding_step = 'boas_vindas_responsavel' THEN
    UPDATE public.client_onboardings SET boas_vindas_responsavel = v_done
     WHERE id = NEW.onboarding_id AND boas_vindas_responsavel IS DISTINCT FROM v_done;
  ELSIF NEW.onboarding_step = 'contacto_30_dias' THEN
    UPDATE public.client_onboardings SET contacto_30_dias = v_done
     WHERE id = NEW.onboarding_id AND contacto_30_dias IS DISTINCT FROM v_done;
  ELSIF NEW.onboarding_step = 'contacto_60_dias' THEN
    UPDATE public.client_onboardings SET contacto_60_dias = v_done
     WHERE id = NEW.onboarding_id AND contacto_60_dias IS DISTINCT FROM v_done;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.task_onboarding_step_sync() FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS task_onboarding_step_sync ON public.tasks;
CREATE TRIGGER task_onboarding_step_sync
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.task_onboarding_step_sync();

-- Onboardings já concluídos com início nos últimos 60 dias: criar só as tarefas ainda dentro do prazo.
SELECT public.create_onboarding_followup_tasks(id, true)
  FROM public.client_onboardings
 WHERE completed_at IS NOT NULL
   AND COALESCE(data_inicio, completed_at::date) >= current_date - 60;
