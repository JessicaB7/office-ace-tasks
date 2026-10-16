-- Automação: quando o IVA Periódica de um mês de fim de trimestre (Mar/Jun/Set/Dez) é marcado
-- "Entregue" (obligation_type 'IVA', status 'concluida'), cria na Fila TOConline a tarefa
-- "Mapa de análise" do regime do cliente (empresas / TI organizado / TI simplificado), para esse
-- trimestre. Só clientes ativos; não cria se a tarefa já existir ou se o balancete desse trimestre
-- já estiver importado na Análise financeira. Se o IVA for desmarcado e a tarefa ainda estiver
-- pendente, é apagada.
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
  v_slot text;
BEGIN
  IF NEW.obligation_type <> 'IVA' THEN
    RETURN NULL;
  END IF;
  v_mes := extract(month FROM NEW.reference_month)::int;
  IF v_mes NOT IN (3, 6, 9, 12) THEN
    RETURN NULL;
  END IF;

  SELECT id, tipo_contabilidade, status INTO v_client FROM public.clients WHERE id = NEW.client_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_proc := CASE v_client.tipo_contabilidade
    WHEN 'SQ' THEN 'empresas_mapa_analise'
    WHEN 'TI CO' THEN 'ti_co_mapa_analise'
    WHEN 'TI RS' THEN 'ti_rs_mapa_analise'
  END;
  IF v_proc IS NULL THEN RETURN NULL; END IF;

  IF NEW.status = 'concluida' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'concluida') THEN
    IF coalesce(v_client.status, 'ativo') <> 'ativo' THEN RETURN NULL; END IF;
    v_slot := 't' || (v_mes / 3);
    IF EXISTS (SELECT 1 FROM public.client_financial_imports
                WHERE client_id = NEW.client_id
                  AND year = extract(year FROM NEW.reference_month)::int
                  AND slot = v_slot) THEN
      RETURN NULL;
    END IF;
    INSERT INTO public.toconline_jobs (procedure_id, client_id, reference_month, status)
    VALUES (v_proc, NEW.client_id, date_trunc('month', NEW.reference_month)::date, 'pendente')
    ON CONFLICT (procedure_id, client_id, reference_month) DO NOTHING;

  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'concluida' AND NEW.status IS DISTINCT FROM 'concluida' THEN
    DELETE FROM public.toconline_jobs
     WHERE procedure_id = v_proc AND client_id = NEW.client_id
       AND reference_month = date_trunc('month', NEW.reference_month)::date
       AND status = 'pendente';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_mapa_analise_job_after_iva ON public.monthly_obligations;
CREATE TRIGGER sync_mapa_analise_job_after_iva
AFTER INSERT OR UPDATE OF status ON public.monthly_obligations
FOR EACH ROW EXECUTE FUNCTION public.sync_mapa_analise_job_after_iva();

REVOKE ALL ON FUNCTION public.sync_mapa_analise_job_after_iva() FROM anon, authenticated, PUBLIC;
