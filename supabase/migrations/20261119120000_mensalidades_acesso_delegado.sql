-- Atualização de mensalidades: a admin pode delegar a vista a colaboradores (ex.: Angela envia as mensagens).
ALTER TABLE public.collaborators ADD COLUMN IF NOT EXISTS acesso_mensalidades boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.pode_gerir_mensalidades(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
      OR EXISTS (SELECT 1 FROM public.collaborators c WHERE c.user_id = _user_id AND c.active AND c.acesso_mensalidades);
$$;
REVOKE ALL ON FUNCTION public.pode_gerir_mensalidades(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_gerir_mensalidades(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Admin gere atualizações de mensalidade" ON public.mensalidade_atualizacoes;
DROP POLICY IF EXISTS "Admin e delegados gerem atualizações de mensalidade" ON public.mensalidade_atualizacoes;
CREATE POLICY "Admin e delegados gerem atualizações de mensalidade" ON public.mensalidade_atualizacoes
  FOR ALL TO authenticated
  USING (public.pode_gerir_mensalidades(auth.uid()))
  WITH CHECK (public.pode_gerir_mensalidades(auth.uid()));

-- Angela (administrativa) envia as mensagens do aumento das mensalidades (19/11/2026, a pedido da admin).
UPDATE public.collaborators SET acesso_mensalidades = true WHERE id = '7c375560-8aaf-4775-98ae-0dc66eda1718';
