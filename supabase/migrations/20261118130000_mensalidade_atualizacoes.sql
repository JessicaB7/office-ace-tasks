-- Atualização de mensalidades (Gestão de negócio, admin): proposta de nova mensalidade por cliente,
-- registo do envio da mensagem e resposta (aceite / recusado). Ao aceitar, a mensalidade da ficha
-- passa para a nova a partir do mês «a_partir_de» (logo, se a data já chegou; senão pelo cron diário).
CREATE TABLE IF NOT EXISTS public.mensalidade_atualizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  mensalidade_atual numeric,
  mensalidade_nova numeric,
  a_partir_de date NOT NULL,
  mensagem_enviada_em date,
  estado text NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente', 'aceite', 'recusado')),
  estado_em date,
  aplicada_em timestamptz,
  notas text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, a_partir_de)
);

ALTER TABLE public.mensalidade_atualizacoes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensalidade_atualizacoes TO authenticated;
GRANT ALL ON public.mensalidade_atualizacoes TO service_role;

DROP POLICY IF EXISTS "Admin gere atualizações de mensalidade" ON public.mensalidade_atualizacoes;
CREATE POLICY "Admin gere atualizações de mensalidade" ON public.mensalidade_atualizacoes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS update_mensalidade_atualizacoes_updated_at ON public.mensalidade_atualizacoes;
CREATE TRIGGER update_mensalidade_atualizacoes_updated_at
  BEFORE UPDATE ON public.mensalidade_atualizacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Aplica à ficha as propostas aceites cuja data já chegou (hora de Lisboa). Devolve quantas aplicou.
-- p_id: só essa linha (usado pelo trigger); sem argumento: todas (cron diário).
CREATE OR REPLACE FUNCTION public.aplicar_atualizacoes_mensalidade(p_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  n integer := 0;
  hoje date := (now() AT TIME ZONE 'Europe/Lisbon')::date;
BEGIN
  FOR r IN
    SELECT id, client_id, mensalidade_nova
    FROM public.mensalidade_atualizacoes
    WHERE estado = 'aceite'
      AND aplicada_em IS NULL
      AND mensalidade_nova IS NOT NULL
      AND a_partir_de <= hoje
      AND (p_id IS NULL OR id = p_id)
    FOR UPDATE
  LOOP
    UPDATE public.clients SET mensalidade = r.mensalidade_nova WHERE id = r.client_id;
    UPDATE public.mensalidade_atualizacoes SET aplicada_em = now() WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_atualizacoes_mensalidade(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aplicar_atualizacoes_mensalidade(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_atualizacoes_mensalidade(uuid) TO service_role;

-- Aplicação imediata quando a linha fica aceite e a data já chegou. Não reverte se deixar de estar aceite.
CREATE OR REPLACE FUNCTION public.mensalidade_atualizacoes_aplicar_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estado = 'aceite' AND NEW.aplicada_em IS NULL AND NEW.mensalidade_nova IS NOT NULL
     AND NEW.a_partir_de <= (now() AT TIME ZONE 'Europe/Lisbon')::date THEN
    PERFORM public.aplicar_atualizacoes_mensalidade(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.mensalidade_atualizacoes_aplicar_trigger() FROM PUBLIC;

DROP TRIGGER IF EXISTS mensalidade_atualizacoes_aplicar ON public.mensalidade_atualizacoes;
CREATE TRIGGER mensalidade_atualizacoes_aplicar
  AFTER INSERT OR UPDATE OF estado, mensalidade_nova, a_partir_de ON public.mensalidade_atualizacoes
  FOR EACH ROW
  WHEN (NEW.estado = 'aceite' AND NEW.aplicada_em IS NULL)
  EXECUTE FUNCTION public.mensalidade_atualizacoes_aplicar_trigger();

-- Cron diário para as propostas aceites com data futura (00:15 UTC ≈ 00:15/01:15 Lisboa).
DO $$
BEGIN
  PERFORM cron.unschedule('aplicar-atualizacoes-mensalidade');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule('aplicar-atualizacoes-mensalidade', '15 0 * * *',
  $cron$ SELECT public.aplicar_atualizacoes_mensalidade(); $cron$);
