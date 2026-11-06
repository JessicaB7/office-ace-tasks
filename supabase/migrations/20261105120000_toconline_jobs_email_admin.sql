CREATE OR REPLACE FUNCTION public.notify_admin_toconline_jobs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _grp RECORD; _admin RECORD; _quem TEXT; _label TEXT; _clientes TEXT;
BEGIN
  BEGIN
    FOR _grp IN
      SELECT n.requested_by, n.procedure_id, n.reference_month, count(*) AS total,
             (array_agg(COALESCE(c.name, '—') ORDER BY c.name))[1:10] AS nomes,
             md5(string_agg(n.id::text, ',' ORDER BY n.id)) AS chave
      FROM novas n LEFT JOIN public.clients c ON c.id = n.client_id
      WHERE n.status = 'pendente'
        AND (n.requested_by IS NULL OR NOT public.has_role(n.requested_by, 'admin'::app_role))
      GROUP BY n.requested_by, n.procedure_id, n.reference_month
    LOOP
      SELECT name INTO _quem FROM public.collaborators WHERE user_id = _grp.requested_by LIMIT 1;
      _label := CASE _grp.procedure_id
        WHEN 'ti_rs_vendas' THEN 'Vendas (TI Simplificado)'
        WHEN 'ti_rs_iva_lancar_compras' THEN 'Compras (TI Simplificado)'
        WHEN 'ti_rs_nao_considerar' THEN 'Não considerar da atividade (TI Simplificado)'
        WHEN 'ti_rs_salarios' THEN 'Salários (TI Simplificado)'
        WHEN 'ti_rs_mapa_analise' THEN 'Mapa de análise (TI Simplificado)'
        WHEN 'ti_rs_classificacao_efatura' THEN 'Classificação e-Fatura (TI Simplificado)'
        WHEN 'ti_co_vendas' THEN 'Vendas (TI Organizado)'
        WHEN 'ti_co_lancar_compras' THEN 'Compras (TI Organizado)'
        WHEN 'ti_co_nao_considerar' THEN 'Não considerar da atividade (TI Organizado)'
        WHEN 'ti_co_salarios' THEN 'Salários (TI Organizado)'
        WHEN 'ti_co_mapa_analise' THEN 'Mapa de análise (TI Organizado)'
        WHEN 'ti_co_classificacao_efatura' THEN 'Classificação e-Fatura (TI Organizado)'
        WHEN 'empresas_importar_vendas' THEN 'Vendas (Empresas)'
        WHEN 'empresas_lancar_compras' THEN 'Compras (Empresas)'
        WHEN 'empresas_salarios' THEN 'Salários (Empresas)'
        WHEN 'empresas_mapa_analise' THEN 'Mapa de análise (Empresas)'
        WHEN 'iva_guias_flexibilizacao' THEN 'Guias flexibilização IVA'
        WHEN 'dmr_guia_at' THEN 'Guia DMR AT'
        WHEN 'dmr_guia_ss' THEN 'Guia DMR SS + dívidas'
        ELSE _grp.procedure_id END;
      _clientes := array_to_string(_grp.nomes, ', ')
        || CASE WHEN _grp.total > 10 THEN ' e mais ' || (_grp.total - 10) ELSE '' END;
      FOR _admin IN
        SELECT DISTINCT u.email FROM public.user_roles ur JOIN auth.users u ON u.id = ur.user_id
        WHERE ur.role = 'admin' AND u.email IS NOT NULL
      LOOP
        PERFORM net.http_post(
          url := 'https://unwzlmdwvpxhigmsqvam.supabase.co/functions/v1/send-transactional-email',
          headers := jsonb_build_object('Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')),
          body := jsonb_build_object(
            'templateName', 'task-assignment',
            'recipientEmail', _admin.email,
            'idempotencyKey', 'fila-toconline-' || _grp.chave || '-' || _admin.email,
            'templateData', jsonb_build_object(
              'taskTitle', 'Fila TOConline: ' || _label || ' — ' || _grp.total || CASE WHEN _grp.total = 1 THEN ' cliente' ELSE ' clientes' END,
              'clientName', _clientes,
              'dueDate', to_char(_grp.reference_month, 'MM/YYYY') || ' (mês da tarefa)',
              'category', 'Ativada por ' || COALESCE(_quem, 'equipa') || ' — abrir o Mac / correr /toconline-fila')));
      END LOOP;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Email da Fila TOConline não enviado: %', SQLERRM;
  END;
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.notify_admin_toconline_jobs() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS toconline_jobs_notify_admin ON public.toconline_jobs;
CREATE TRIGGER toconline_jobs_notify_admin AFTER INSERT ON public.toconline_jobs
  REFERENCING NEW TABLE AS novas FOR EACH STATEMENT EXECUTE FUNCTION public.notify_admin_toconline_jobs();
