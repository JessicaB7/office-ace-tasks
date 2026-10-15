-- Automação: quando o apuramento do IVA de um TI (TI Simplificado com IVA ou TI Organizado)
-- fica concluído — na Gestão Mensal ou na coluna "Apuramento" do IVA Periódica, que são o
-- mesmo registo — cria a tarefa "Classificação das despesas no e-Fatura" para o responsável
-- do cliente, com prazo de 7 dias. Uma tarefa por cliente e período (identificada pela
-- descrição). Se o apuramento for desmarcado e a tarefa ainda estiver pendente, é apagada.
CREATE OR REPLACE FUNCTION public.sync_efatura_task_after_iva_ti()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client record;
  v_marker text;
  v_periodo text;
  v_mes int;
  v_meses text[] := ARRAY['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
BEGIN
  IF NEW.obligation_type NOT IN ('contabilidade_TI_iva_iva', 'contabilidade_organizada_iva') THEN
    RETURN NULL;
  END IF;

  v_marker := 'Automático: apuramento IVA ' || to_char(NEW.reference_month, 'YYYY-MM');

  IF NEW.status = 'concluida' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'concluida') THEN
    SELECT id, name, iva, responsavel_id INTO v_client FROM public.clients WHERE id = NEW.client_id;
    IF NOT FOUND THEN RETURN NULL; END IF;

    IF EXISTS (SELECT 1 FROM public.tasks WHERE client_id = NEW.client_id AND description = v_marker) THEN
      RETURN NULL;
    END IF;

    v_mes := extract(month FROM NEW.reference_month)::int;
    IF v_client.iva = 'Trimestral' THEN
      v_periodo := ((v_mes - 1) / 3 + 1) || 'º trimestre ' || extract(year FROM NEW.reference_month)::int;
    ELSE
      v_periodo := v_meses[v_mes] || ' ' || extract(year FROM NEW.reference_month)::int;
    END IF;

    INSERT INTO public.tasks (title, description, due_date, category, priority, status, client_id, collaborator_id)
    VALUES ('Classificação das despesas no e-Fatura (' || v_periodo || ')', v_marker,
            current_date + 7, 'contabilidade', 'media', 'pendente', NEW.client_id, v_client.responsavel_id);

  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'concluida' AND NEW.status IS DISTINCT FROM 'concluida' THEN
    DELETE FROM public.tasks
     WHERE client_id = NEW.client_id AND description = v_marker AND status = 'pendente';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_efatura_task_after_iva_ti ON public.monthly_obligations;
CREATE TRIGGER sync_efatura_task_after_iva_ti
AFTER INSERT OR UPDATE OF status ON public.monthly_obligations
FOR EACH ROW EXECUTE FUNCTION public.sync_efatura_task_after_iva_ti();

REVOKE ALL ON FUNCTION public.sync_efatura_task_after_iva_ti() FROM anon, authenticated, PUBLIC;
