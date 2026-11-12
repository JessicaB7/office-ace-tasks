-- Alerta diário: pedidos ao cliente da Gestão mensal (monthly_obligations.pedido_cliente_em) há mais de 5 dias,
-- uma notificação por responsável por dia (sem responsável → admins). Tipo 'pedidos_cliente' (push ativo por defeito).
CREATE OR REPLACE FUNCTION public.run_daily_alerts(p_today DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := COALESCE(p_today, (now() AT TIME ZONE 'Europe/Lisbon')::date);
  v_admins UUID[] := ARRAY(SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'admin');
  v_admin_collab UUID := (SELECT c.id FROM public.collaborators c JOIN public.user_roles ur ON ur.user_id = c.user_id
                           WHERE ur.role = 'admin' AND c.active ORDER BY c.created_at LIMIT 1);
  r RECORD;
  u UUID;
  v_days INTEGER;
  v_alert TEXT;
  v_n INTEGER;
  v_rc INTEGER;
  v_ss INTEGER := 0;
  v_tasks INTEGER := 0;
  v_mapas INTEGER := 0;
  v_err INTEGER := 0;
  v_seg INTEGER := 0;
  v_ped INTEGER := 0;
  y INTEGER;
  q INTEGER;
  v_qend DATE;
BEGIN
  -- 1) Fim de isenção da Segurança Social
  FOR r IN
    SELECT c.id, c.name, c.seguranca_social_isencao_fim AS fim, c.responsavel_id, col.user_id AS resp_user
      FROM public.clients c
      LEFT JOIN public.collaborators col ON col.id = c.responsavel_id
     WHERE c.active AND COALESCE(c.status, 'ativo') <> 'inativo'
       AND c.seguranca_social_isencao_fim BETWEEN v_today AND v_today + 60
  LOOP
    v_days := r.fim - v_today;
    v_alert := CASE WHEN v_days <= 15 THEN 'ss_isencao_15' ELSE 'ss_isencao_60' END;
    FOREACH u IN ARRAY (SELECT ARRAY(SELECT DISTINCT x FROM unnest(array_append(v_admins, r.resp_user)) x WHERE x IS NOT NULL))
    LOOP
      IF public.notify_once(v_alert || ':' || r.id || ':' || r.fim, u,
           'Isenção SS a terminar – ' || r.name,
           'A isenção da Segurança Social termina a ' || to_char(r.fim, 'DD/MM/YYYY') || ' (faltam ' || v_days || ' dias).',
           'ss_isencao', '/?view=clients&client=' || r.id,
           jsonb_build_object('client_id', r.id, 'alert', v_alert, 'fim', r.fim)) THEN
        v_ss := v_ss + 1;
      END IF;
    END LOOP;
    IF v_alert = 'ss_isencao_15' THEN
      INSERT INTO public.alert_log (alert_key, user_id) VALUES ('ss_isencao_tarefa:' || r.id || ':' || r.fim, NULL) ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      IF v_n > 0 THEN
        INSERT INTO public.tasks (title, description, due_date, category, priority, status, collaborator_id, client_id)
        VALUES ('Fim de isenção SS – ' || r.name,
                'A isenção da Segurança Social termina a ' || to_char(r.fim, 'DD/MM/YYYY') || '. Confirmar o enquadramento e avisar o cliente.',
                r.fim, 'SS_TI', 'alta', 'pendente', COALESCE(r.responsavel_id, v_admin_collab), r.id);
        v_tasks := v_tasks + 1;
      END IF;
    END IF;
  END LOOP;

  -- 2) Mapas trimestrais por enviar: 30 dias após o fim do trimestre (janela de 60 dias).
  FOR y IN (EXTRACT(YEAR FROM v_today)::int - 1)..(EXTRACT(YEAR FROM v_today)::int) LOOP
    FOR q IN 1..4 LOOP
      v_qend := (make_date(y, q * 3, 1) + interval '1 month' - interval '1 day')::date;
      IF v_today < v_qend + 30 OR v_today >= v_qend + 90 THEN CONTINUE; END IF;
      FOR r IN
        SELECT c.responsavel_id, col.user_id AS resp_user, count(*) AS n
          FROM public.client_financial_settings s
          JOIN public.clients c ON c.id = s.client_id
          LEFT JOIN public.collaborators col ON col.id = c.responsavel_id
         WHERE s.year = y AND c.active
           AND NOT COALESCE(CASE q WHEN 1 THEN s.mapa_q1_enviado WHEN 2 THEN s.mapa_q2_enviado
                                   WHEN 3 THEN s.mapa_q3_enviado ELSE s.mapa_q4_enviado END, false)
         GROUP BY c.responsavel_id, col.user_id
      LOOP
        FOREACH u IN ARRAY (CASE WHEN r.resp_user IS NULL THEN v_admins ELSE ARRAY[r.resp_user] END) LOOP
          IF public.notify_once('mapas:' || y || 'Q' || q || ':' || COALESCE(r.responsavel_id::text, 'sem'), u,
               'Mapas do ' || q || 'º trimestre por enviar',
               r.n || CASE WHEN r.n = 1 THEN ' mapa ainda por enviar' ELSE ' mapas ainda por enviar' END
                 || CASE WHEN r.resp_user IS NULL THEN ' (clientes sem responsável)' ELSE '' END
                 || ' — T' || q || ' ' || y || '.',
               'mapas_por_enviar', '/?view=mapas_trimestrais&year=' || y || '&q=' || q,
               jsonb_build_object('year', y, 'quarter', q, 'count', r.n, 'responsavel_id', r.responsavel_id)) THEN
            v_mapas := v_mapas + 1;
          END IF;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;

  -- 3) Novos erros das automações TOConline → admin
  v_n := 0;
  FOR r IN SELECT id, COALESCE(finished_at, updated_at) AS quando FROM public.toconline_jobs WHERE status IN ('erro', 'bloqueada') LOOP
    INSERT INTO public.alert_log (alert_key, user_id) VALUES ('toconline_erro:' || r.id || ':' || r.quando, NULL) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_rc = ROW_COUNT;
    v_n := v_n + v_rc;
  END LOOP;
  IF v_n > 0 THEN
    FOREACH u IN ARRAY v_admins LOOP
      INSERT INTO public.notifications (user_id, title, message, type, link, data)
      VALUES (u, 'Automações TOConline com erro',
              v_n || CASE WHEN v_n = 1 THEN ' tarefa nova com erro ou bloqueada.' ELSE ' tarefas novas com erro ou bloqueadas.' END,
              'toconline_erros', '/?view=toconline_automacoes', jsonb_build_object('count', v_n, 'date', v_today));
    END LOOP;
    v_err := v_n;
  END IF;

  -- 4) Seguimentos de contactos que vencem hoje
  FOR r IN
    SELECT cc.id, cl.name, cc.client_id, cc.resumo, col.user_id
      FROM public.client_contacts cc
      JOIN public.clients cl ON cl.id = cc.client_id
      LEFT JOIN public.collaborators col ON col.id = cc.collaborator_id
     WHERE cc.seguimento_em = v_today
  LOOP
    IF public.notify_once('seguimento:' || r.id, COALESCE(r.user_id, (SELECT created_by FROM public.client_contacts WHERE id = r.id)),
         'Seguimento hoje – ' || r.name, left(r.resumo, 160), 'seguimento_contacto',
         '/?view=clients&client=' || r.client_id || '&tab=historico',
         jsonb_build_object('client_id', r.client_id, 'contact_id', r.id)) THEN
      v_seg := v_seg + 1;
    END IF;
  END LOOP;

  -- Pedidos ao cliente (Gestão mensal) há mais de 5 dias, por responsável (lembrete diário enquanto estiverem em aberto).
  FOR r IN
    SELECT c.responsavel_id, col.user_id AS resp_user, count(*) AS n,
           string_agg(DISTINCT c.name, ', ') AS nomes
      FROM public.monthly_obligations mo
      JOIN public.clients c ON c.id = mo.client_id
      LEFT JOIN public.collaborators col ON col.id = c.responsavel_id
     WHERE mo.pedido_cliente_em IS NOT NULL
       AND mo.pedido_cliente_em <= v_today - 6
       AND COALESCE(mo.status, '') <> 'concluida'
       AND c.active AND COALESCE(c.status, 'ativo') <> 'inativo'
     GROUP BY c.responsavel_id, col.user_id
  LOOP
    FOREACH u IN ARRAY (CASE WHEN r.resp_user IS NULL THEN v_admins ELSE ARRAY[r.resp_user] END) LOOP
      IF public.notify_once('pedidos_cliente:' || COALESCE(r.responsavel_id::text, 'sem') || ':' || v_today, u,
           'Pedidos ao cliente há mais de 5 dias',
           r.n || CASE WHEN r.n = 1 THEN ' pedido sem resposta: ' ELSE ' pedidos sem resposta: ' END || left(r.nomes, 140),
           'pedidos_cliente', '/?view=contabilidades',
           jsonb_build_object('count', r.n, 'responsavel_id', r.responsavel_id)) THEN
        v_ped := v_ped + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('ss_notificacoes', v_ss, 'ss_tarefas', v_tasks, 'mapas', v_mapas,
                            'toconline_erros', v_err, 'seguimentos', v_seg, 'pedidos_cliente', v_ped);
END;
$$;
