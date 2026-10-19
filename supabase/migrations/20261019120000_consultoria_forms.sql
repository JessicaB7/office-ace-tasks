-- Formulário de preparação da consultoria (migrado do Notion "Formulário Consultorias - DÚVIDAS").
--
-- Cada lead de consultoria tem um link público único (token) que se envia ao
-- cliente depois da marcação da sessão. As respostas ficam ligadas à lead e
-- aparecem também na ficha do cliente (por NIF ou pelo onboarding da lead).

CREATE TABLE IF NOT EXISTS public.consultoria_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  form_sent_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_consultoria_forms_updated_at ON public.consultoria_forms;
CREATE TRIGGER update_consultoria_forms_updated_at
  BEFORE UPDATE ON public.consultoria_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.consultoria_forms ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultoria_forms TO authenticated;
GRANT ALL ON public.consultoria_forms TO service_role;

DO $$ BEGIN
  CREATE POLICY "Equipa vê os formulários de consultoria" ON public.consultoria_forms
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Equipa cria formulários de consultoria" ON public.consultoria_forms
    FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Equipa atualiza formulários de consultoria" ON public.consultoria_forms
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admin apaga formulários de consultoria" ON public.consultoria_forms
    FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---- Lead de consultoria → cria o formulário ----
CREATE OR REPLACE FUNCTION public.create_consultoria_form_for_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.segment = 'consultoria' THEN
    INSERT INTO public.consultoria_forms (lead_id) VALUES (NEW.id)
    ON CONFLICT (lead_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_create_consultoria_form ON public.leads;
CREATE TRIGGER leads_create_consultoria_form
  AFTER INSERT OR UPDATE OF segment ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.create_consultoria_form_for_lead();

REVOKE ALL ON FUNCTION public.create_consultoria_form_for_lead() FROM PUBLIC;

-- Leads de consultoria já existentes
INSERT INTO public.consultoria_forms (lead_id)
SELECT id FROM public.leads WHERE segment = 'consultoria'
ON CONFLICT (lead_id) DO NOTHING;

-- ---- Formulário público (sem login) ----
CREATE OR REPLACE FUNCTION public.get_consultoria_form(_token TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'name', l.name,
    'phone', l.phone,
    'nif', l.nif,
    'meeting_date', l.meeting_date,
    'submitted', f.submitted_at IS NOT NULL
  )
  FROM public.consultoria_forms f
  JOIN public.leads l ON l.id = f.lead_id
  WHERE f.token = _token AND length(_token) = 64;
$$;

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
  WHERE id = _lead;

  _name := COALESCE(NULLIF(_answers->>'nome', ''), 'Consultoria');
  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT ur.user_id, 'Formulário de consultoria recebido', _name, 'consultoria_form_submitted'
  FROM public.user_roles ur
  WHERE ur.role = 'admin';

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.get_consultoria_form(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_consultoria_form(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_consultoria_form(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_consultoria_form(TEXT, JSONB) TO anon, authenticated, service_role;
