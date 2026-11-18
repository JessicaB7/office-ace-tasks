-- Senhas do formulário de novo cliente: toda a equipa as pode ver (pedido da admin, 18/11/2026).
-- Alterar/apagar continua só para a admin (o cliente preenche-as pelo formulário público).
DROP POLICY IF EXISTS "Só admin gere as senhas do onboarding" ON public.client_onboarding_secrets;
DROP POLICY IF EXISTS "Equipa vê as senhas do onboarding" ON public.client_onboarding_secrets;
DROP POLICY IF EXISTS "Admin gere as senhas do onboarding" ON public.client_onboarding_secrets;

CREATE POLICY "Equipa vê as senhas do onboarding" ON public.client_onboarding_secrets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin gere as senhas do onboarding" ON public.client_onboarding_secrets
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
