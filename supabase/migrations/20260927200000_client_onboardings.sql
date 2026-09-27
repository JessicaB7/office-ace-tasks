-- Entrada de novos clientes (migrado do Notion "Contratos a realizar").
--
-- Quando uma lead do comercial passa a "ganho" (ou uma lead de consultoria
-- passa a "serviço mensal sim") cria-se automaticamente um
-- processo de onboarding com um link público único (token) para o cliente
-- preencher o formulário com os dados para o contrato. A equipa acompanha a
-- checklist (contrato, pagamento, fatura, grupo, avença, onboarding) na vista
-- "Novos clientes".
--
-- As senhas (Finanças, Segurança Social, programa de faturação) ficam numa
-- tabela à parte que só o admin consegue ler.

CREATE TABLE IF NOT EXISTS public.client_onboardings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  -- 64 caracteres hex aleatórios; é a "chave" do link público do formulário
  token TEXT NOT NULL UNIQUE DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  form_type TEXT NOT NULL DEFAULT 'ti_rs' CHECK (form_type IN ('ti_rs', 'ti_co', 'empresa')),
  -- Respostas do formulário (sem senhas)
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  form_sent_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  -- Checklist
  contrato BOOLEAN NOT NULL DEFAULT false,
  pagamento BOOLEAN NOT NULL DEFAULT false,
  fatura BOOLEAN NOT NULL DEFAULT false,
  grupo BOOLEAN NOT NULL DEFAULT false,
  avenca BOOLEAN NOT NULL DEFAULT false,
  onboarding BOOLEAN NOT NULL DEFAULT false,
  email_anterior_contabilista BOOLEAN NOT NULL DEFAULT false,
  data_inicio DATE,
  responsavel_id UUID REFERENCES public.collaborators(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_onboardings_completed ON public.client_onboardings(completed_at);

DROP TRIGGER IF EXISTS update_client_onboardings_updated_at ON public.client_onboardings;
CREATE TRIGGER update_client_onboardings_updated_at
  BEFORE UPDATE ON public.client_onboardings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.client_onboardings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_onboardings TO authenticated;
GRANT ALL ON public.client_onboardings TO service_role;

DO $$ BEGIN
  CREATE POLICY "Equipa vê os onboardings" ON public.client_onboardings
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Equipa cria onboardings" ON public.client_onboardings
    FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Equipa atualiza onboardings" ON public.client_onboardings
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admin apaga onboardings" ON public.client_onboardings
    FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---- Senhas (só admin) ----
CREATE TABLE IF NOT EXISTS public.client_onboarding_secrets (
  onboarding_id UUID PRIMARY KEY REFERENCES public.client_onboardings(id) ON DELETE CASCADE,
  senha_at TEXT,
  senha_ss TEXT,
  utilizador_faturacao TEXT,
  senha_faturacao TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_onboarding_secrets ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_onboarding_secrets TO authenticated;
GRANT ALL ON public.client_onboarding_secrets TO service_role;

DO $$ BEGIN
  CREATE POLICY "Só admin gere as senhas do onboarding" ON public.client_onboarding_secrets
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---- Lead "ganho" / consultoria "mensal_sim" → cria o onboarding ----
CREATE OR REPLACE FUNCTION public.create_onboarding_for_won_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF ((NEW.segment = 'contabilidade' AND NEW.stage = 'ganho')
      OR (NEW.segment = 'consultoria' AND NEW.stage = 'mensal_sim'))
     AND (TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM NEW.stage) THEN
    INSERT INTO public.client_onboardings (lead_id, form_type)
    VALUES (
      NEW.id,
      CASE WHEN NEW.business_type IN ('ti_rs', 'ti_co', 'empresa') THEN NEW.business_type ELSE 'ti_rs' END
    )
    ON CONFLICT (lead_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_create_onboarding ON public.leads;
CREATE TRIGGER leads_create_onboarding
  AFTER INSERT OR UPDATE OF stage ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.create_onboarding_for_won_lead();

-- ---- Formulário público (sem login) ----
-- O cliente só conhece o token; estas funções são a única porta de entrada
-- para anon e nunca devolvem respostas já submetidas.

CREATE OR REPLACE FUNCTION public.get_onboarding_form(_token TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'form_type', o.form_type,
    'name', l.name,
    'email', l.email,
    'submitted', o.submitted_at IS NOT NULL
  )
  FROM public.client_onboardings o
  LEFT JOIN public.leads l ON l.id = o.lead_id
  WHERE o.token = _token AND length(_token) = 64;
$$;

CREATE OR REPLACE FUNCTION public.submit_onboarding_form(_token TEXT, _answers JSONB, _secrets JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
  _name TEXT;
BEGIN
  IF length(_token) <> 64
     OR jsonb_typeof(_answers) <> 'object'
     OR jsonb_typeof(_secrets) <> 'object'
     OR length(_answers::text) > 20000
     OR length(_secrets::text) > 2000 THEN
    RAISE EXCEPTION 'Pedido inválido';
  END IF;

  SELECT id INTO _id
  FROM public.client_onboardings
  WHERE token = _token AND submitted_at IS NULL
  FOR UPDATE;

  IF _id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.client_onboardings
  SET answers = _answers, submitted_at = now()
  WHERE id = _id;

  INSERT INTO public.client_onboarding_secrets (onboarding_id, senha_at, senha_ss, utilizador_faturacao, senha_faturacao)
  VALUES (
    _id,
    NULLIF(_secrets->>'senha_at', ''),
    NULLIF(_secrets->>'senha_ss', ''),
    NULLIF(_secrets->>'utilizador_faturacao', ''),
    NULLIF(_secrets->>'senha_faturacao', '')
  )
  ON CONFLICT (onboarding_id) DO UPDATE SET
    senha_at = EXCLUDED.senha_at,
    senha_ss = EXCLUDED.senha_ss,
    utilizador_faturacao = EXCLUDED.utilizador_faturacao,
    senha_faturacao = EXCLUDED.senha_faturacao,
    updated_at = now();

  _name := COALESCE(NULLIF(_answers->>'nome', ''), 'Novo cliente');
  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT ur.user_id, 'Formulário de novo cliente recebido', _name, 'onboarding_submitted'
  FROM public.user_roles ur
  WHERE ur.role = 'admin';

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.get_onboarding_form(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_onboarding_form(TEXT, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_onboarding_form(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_onboarding_form(TEXT, JSONB, JSONB) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_onboarding_for_won_lead() FROM PUBLIC;
