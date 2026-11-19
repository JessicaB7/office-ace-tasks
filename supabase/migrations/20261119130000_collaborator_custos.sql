-- Custo dos colaboradores (Colaboradores, admin): salário bruto mensal e subsídio de alimentação mensal.
-- O custo mensal e o lucro por colaborador calculam-se em src/lib/custoColaborador.ts.
CREATE TABLE IF NOT EXISTS public.collaborator_custos (
  collaborator_id uuid PRIMARY KEY REFERENCES public.collaborators(id) ON DELETE CASCADE,
  salario_bruto numeric NOT NULL DEFAULT 0,
  subsidio_alimentacao numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.collaborator_custos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collaborator_custos TO authenticated;
GRANT ALL ON public.collaborator_custos TO service_role;
DROP POLICY IF EXISTS "Admin gere custos dos colaboradores" ON public.collaborator_custos;
CREATE POLICY "Admin gere custos dos colaboradores" ON public.collaborator_custos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP TRIGGER IF EXISTS update_collaborator_custos_updated_at ON public.collaborator_custos;
CREATE TRIGGER update_collaborator_custos_updated_at BEFORE UPDATE ON public.collaborator_custos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
