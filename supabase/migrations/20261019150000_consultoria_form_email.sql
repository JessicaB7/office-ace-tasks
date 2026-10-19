-- Formulário de consultoria preenchido → além da notificação na app, envia um email
-- a cada admin com as respostas (template "consultoria-form-submitted").
-- O formulário é público (anon), por isso o pedido à edge function sai da própria
-- base de dados com a chave de serviço guardada no vault, como os resumos agendados.

CREATE OR REPLACE FUNCTION public.submit_consultoria_form(_token TEXT, _answers JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
  _lead UUID;
  _name TEXT;
  _lead_row public.leads%ROWTYPE;
  _respostas JSONB;
  _admin RECORD;
BEGIN
  IF length(_token) <> 64
     OR jsonb_typeof(_answers) <> 'object'
     OR length(_answers::text) > 20000 THEN
    RAISE EXCEPTION 'Pedido inválido';
  END IF;

  SELECT id, lead_id INTO _id, _lead
  FROM public.consultoria_forms
  WHERE token = _token AND submitted_at IS NULL
  FOR UPDATE;

  IF _id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.consultoria_forms
  SET answers = _answers, submitted_at = now()
  WHERE id = _id;

  -- Completa a lead com o NIF e o telemóvel indicados (sem apagar o que já lá está)
  UPDATE public.leads
  SET nif = COALESCE(NULLIF(nif, ''), NULLIF(_answers->>'nif', '')),
      phone = COALESCE(NULLIF(phone, ''), NULLIF(_answers->>'telemovel', ''))
  WHERE id = _lead
  RETURNING * INTO _lead_row;

  _name := COALESCE(NULLIF(_answers->>'nome', ''), 'Consultoria');
  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT ur.user_id, 'Formulário de consultoria recebido', _name, 'consultoria_form_submitted'
  FROM public.user_roles ur
  WHERE ur.role = 'admin';

  -- Email: perguntas pela ordem do formulário (consultoriaFormConstants.ts)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('pergunta', q.pergunta, 'resposta', q.resposta) ORDER BY q.ord), '[]'::jsonb)
  INTO _respostas
  FROM (
    VALUES
      (1, 'NIF', _answers->>'nif'),
      (2, 'Telemóvel', _answers->>'telemovel'),
      (3, 'Já tens atividade ou empresa aberta?',
         CASE _answers->>'tem_atividade' WHEN 'sim' THEN 'Sim' WHEN 'nao' THEN 'Não' END),
      (4, 'És trabalhador por conta de outrem?',
         CASE _answers->>'conta_outrem' WHEN 'sim' THEN 'Sim' WHEN 'nao' THEN 'Não' END),
      (5, 'Atividade?',
         CASE _answers->>'tipo_atividade' WHEN 'servicos' THEN 'Prestação de Serviços'
           WHEN 'produtos' THEN 'Venda de Produtos' WHEN 'ambos' THEN 'Ambos' END),
      (6, 'Qual a atividade ou serviço que vais exercer?', _answers->>'atividade'),
      (7, 'Quais as tuas principais dúvidas?', _answers->>'duvidas'),
      (8, 'Informação útil para a reunião', _answers->>'informacoes')
  ) AS q(ord, pergunta, resposta)
  WHERE NULLIF(q.resposta, '') IS NOT NULL;

  -- Falha no envio nunca impede a submissão do formulário
  BEGIN
    FOR _admin IN
      SELECT DISTINCT u.email
      FROM public.user_roles ur
      JOIN auth.users u ON u.id = ur.user_id
      WHERE ur.role = 'admin' AND u.email IS NOT NULL
    LOOP
      PERFORM net.http_post(
        url := 'https://unwzlmdwvpxhigmsqvam.supabase.co/functions/v1/send-transactional-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' ||
            (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')
        ),
        body := jsonb_build_object(
          'templateName', 'consultoria-form-submitted',
          'recipientEmail', _admin.email,
          'idempotencyKey', 'consultoria-form-' || _id || '-' || _admin.email,
          'templateData', jsonb_build_object(
            'nome', _name,
            'sessao', to_char(_lead_row.meeting_date, 'DD/MM/YYYY'),
            'dadaPor', _lead_row.given_by,
            'respostas', _respostas
          )
        )
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Email do formulário de consultoria não enviado: %', SQLERRM;
  END;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_consultoria_form(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_consultoria_form(TEXT, JSONB) TO anon, authenticated, service_role;
