-- IVA entregue → avisar a administração (em vez de criar logo a tarefa).
-- Quando um colaborador marca o IVA Periódica de Mar/Jun/Set/Dez como "Entregue", cada admin
-- recebe uma notificação com o botão "Ativar Mapa de análise"; a tarefa só entra na Fila
-- TOConline quando a admin a ativa. Só clientes ativos, com regime conhecido e sem o balancete
-- desse trimestre já importado. Se o IVA for desmarcado, as notificações por ler são apagadas.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS data jsonb;

CREATE OR REPLACE FUNCTION public.sync_mapa_analise_job_after_iva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client record;
  v_proc text;
  v_mes int;
  v_ano int;
  v_tri int;
  v_month date;
  v_quem text;
BEGIN
  IF NEW.obligation_type <> 'IVA' THEN
    RETURN NULL;
  END IF;
  v_mes := extract(month FROM NEW.reference_month)::int;
  IF v_mes NOT IN (3, 6, 9, 12) THEN
    RETURN NULL;
  END IF;
  v_ano := extract(year FROM NEW.reference_month)::int;
  v_tri := v_mes / 3;
  v_month := date_trunc('month', NEW.reference_month)::date;

  SELECT id, name, tipo_contabilidade, status INTO v_client FROM public.clients WHERE id = NEW.client_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_proc := CASE v_client.tipo_contabilidade
    WHEN 'SQ' THEN 'empresas_mapa_analise'
    WHEN 'TI CO' THEN 'ti_co_mapa_analise'
    WHEN 'TI RS' THEN 'ti_rs_mapa_analise'
  END;
  IF v_proc IS NULL THEN RETURN NULL; END IF;

  IF NEW.status = 'concluida' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'concluida') THEN
    IF coalesce(v_client.status, 'ativo') <> 'ativo' THEN RETURN NULL; END IF;
    IF EXISTS (SELECT 1 FROM public.client_financial_imports
                WHERE client_id = NEW.client_id AND year = v_ano AND slot = 't' || v_tri) THEN
      RETURN NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM public.toconline_jobs
                WHERE procedure_id = v_proc AND client_id = NEW.client_id AND reference_month = v_month) THEN
      RETURN NULL;
    END IF;

    SELECT name INTO v_quem FROM public.collaborators WHERE user_id = NEW.completed_by LIMIT 1;

    INSERT INTO public.notifications (user_id, title, message, type, data)
    SELECT ur.user_id,
           'IVA entregue · ' || v_client.name,
           coalesce(v_quem, 'Um colaborador') || ' marcou o IVA do ' || v_tri || 'º trimestre ' || v_ano ||
             ' como entregue. Ativar o Mapa de análise?',
           'iva_entregue',
           jsonb_build_object('procedure_id', v_proc, 'client_id', NEW.client_id, 'reference_month', v_month)
      FROM public.user_roles ur
     WHERE ur.role = 'admin'
       AND ur.user_id IS DISTINCT FROM NEW.completed_by;

  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'concluida' AND NEW.status IS DISTINCT FROM 'concluida' THEN
    DELETE FROM public.notifications
     WHERE type = 'iva_entregue' AND read = false
       AND data->>'client_id' = NEW.client_id::text
       AND data->>'reference_month' = v_month::text;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_mapa_analise_job_after_iva() FROM anon, authenticated, PUBLIC;
