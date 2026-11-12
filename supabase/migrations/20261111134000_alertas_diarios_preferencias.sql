-- Preferências de notificações (Definições → Notificações) + alertas diários:
--   1) fim de isenção da Segurança Social (60 e 15 dias antes; aos 15 dias cria tarefa);
--   2) mapas trimestrais por enviar (30 dias após o fim do trimestre, por responsável);
--   3) novos erros das automações TOConline (admin);
--   4) seguimentos de contactos que vencem hoje.
-- As preferências controlam o envio para o telemóvel (push): a notificação fica sempre no sino.

-- ============================================================================
-- Preferências
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ss_isencoes BOOLEAN NOT NULL DEFAULT true,
  mapas_por_enviar BOOLEAN NOT NULL DEFAULT true,
  erros_automacoes BOOLEAN NOT NULL DEFAULT true,
  seguimentos_contactos BOOLEAN NOT NULL DEFAULT true,
  tarefas_atribuidas BOOLEAN NOT NULL DEFAULT true,
  -- Versão resumida do relatório semanal (só os clientes da própria pessoa), por email.
  relatorio_semanal_pessoal BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

DO $$ BEGIN
  CREATE POLICY "Cada um vê as suas preferências" ON public.notification_preferences
    FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Cada um cria as suas preferências" ON public.notification_preferences
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Cada um altera as suas preferências" ON public.notification_preferences
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Preferência de um tipo de notificação (tipos sem preferência → sempre).
CREATE OR REPLACE FUNCTION public.notification_pref_enabled(p_user UUID, p_type TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE p_type
      WHEN 'ss_isencao' THEN p.ss_isencoes
      WHEN 'mapas_por_enviar' THEN p.mapas_por_enviar
      WHEN 'toconline_erros' THEN p.erros_automacoes
      WHEN 'seguimento_contacto' THEN p.seguimentos_contactos
      WHEN 'task_assigned' THEN p.tarefas_atribuidas
      ELSE true END
    FROM public.notification_preferences p WHERE p.user_id = p_user), true);
$$;
REVOKE ALL ON FUNCTION public.notification_pref_enabled(UUID, TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_pref_enabled(UUID, TEXT) TO authenticated, service_role;

-- Push: respeita as preferências.
CREATE OR REPLACE FUNCTION public.notify_push_on_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.user_id)
       AND public.notification_pref_enabled(NEW.user_id, NEW.type) THEN
      PERFORM net.http_post(
        url := 'https://unwzlmdwvpxhigmsqvam.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' ||
            (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')
        ),
        body := jsonb_build_object('notification_id', NEW.id)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Push da notificação % não enviado: %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.notify_push_on_notification() FROM PUBLIC, anon, authenticated;

-- Notificação de teste para o próprio utilizador (vai também para os dispositivos ativos).
CREATE OR REPLACE FUNCTION public.send_test_notification()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sem sessão'; END IF;
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (auth.uid(), 'Notificação de teste', 'Se estás a ver isto no telemóvel, as notificações estão a funcionar.', 'teste', '/?view=definicoes_notificacoes')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.send_test_notification() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_test_notification() TO authenticated;

-- Admin: quem tem notificações ativas (nº de dispositivos por utilizador).
CREATE OR REPLACE FUNCTION public.push_devices_by_user()
RETURNS TABLE (user_id UUID, dispositivos INTEGER, ultimo TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  RETURN QUERY SELECT s.user_id, count(*)::int, max(s.created_at) FROM public.push_subscriptions s GROUP BY s.user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.push_devices_by_user() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.push_devices_by_user() TO authenticated;

-- ============================================================================
-- Registo dos alertas já enviados (não depende de as notificações serem apagadas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.alert_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key TEXT NOT NULL,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_log_unique
  ON public.alert_log(alert_key, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE public.alert_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.alert_log TO authenticated;
GRANT ALL ON public.alert_log TO service_role;
DO $$ BEGIN
  CREATE POLICY "Admin vê alertas enviados" ON public.alert_log
    FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Cria a notificação só se o alerta (chave × utilizador) ainda não foi enviado.
CREATE OR REPLACE FUNCTION public.notify_once(p_key TEXT, p_user UUID, p_title TEXT, p_message TEXT, p_type TEXT, p_link TEXT, p_data JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_n INTEGER;
BEGIN
  IF p_user IS NULL THEN RETURN false; END IF;
  INSERT INTO public.alert_log (alert_key, user_id) VALUES (p_key, p_user) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RETURN false; END IF;
  INSERT INTO public.notifications (user_id, title, message, type, link, data)
  VALUES (p_user, p_title, p_message, p_type, p_link, p_data);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_once(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, JSONB) FROM anon, authenticated, PUBLIC;

-- ============================================================================
-- Alertas diários
-- ============================================================================
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

  RETURN jsonb_build_object('ss_notificacoes', v_ss, 'ss_tarefas', v_tasks, 'mapas', v_mapas,
                            'toconline_erros', v_err, 'seguimentos', v_seg);
END;
$$;

REVOKE ALL ON FUNCTION public.run_daily_alerts(DATE) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_daily_alerts(DATE) TO service_role;

-- Todos os dias às 08:00 de Lisboa (o cron corre em UTC às 07:00 e 08:00 e só executa à hora certa).
-- cron.schedule com o mesmo nome substitui o job existente.
SELECT cron.schedule('run-daily-alerts', '0 7,8 * * *', $cron$
  SELECT CASE WHEN to_char(now() AT TIME ZONE 'Europe/Lisbon', 'HH24') = '08' THEN public.run_daily_alerts() END;
$cron$);
