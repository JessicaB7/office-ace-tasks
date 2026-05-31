
-- 1) Catálogo de contas SNC (global)
CREATE TABLE public.financial_accounts (
  code text PRIMARY KEY,
  name text NOT NULL,
  section text NOT NULL,
  parent_code text,
  sign smallint NOT NULL DEFAULT 1,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.financial_accounts TO authenticated;
GRANT ALL ON public.financial_accounts TO service_role;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated can read financial_accounts"
  ON public.financial_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can modify financial_accounts"
  ON public.financial_accounts FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update financial_accounts"
  ON public.financial_accounts FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can delete financial_accounts"
  ON public.financial_accounts FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2) Lançamentos mensais por cliente
CREATE TABLE public.client_financial_entries (
  client_id uuid NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  account_code text NOT NULL REFERENCES public.financial_accounts(code) ON DELETE CASCADE,
  value numeric(14,2) NOT NULL DEFAULT 0,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, year, month, account_code)
);
CREATE INDEX idx_cfe_client_year ON public.client_financial_entries(client_id, year);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_financial_entries TO authenticated;
GRANT ALL ON public.client_financial_entries TO service_role;
ALTER TABLE public.client_financial_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated can read cfe"
  ON public.client_financial_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Collab or admin can insert cfe"
  ON public.client_financial_entries FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR EXISTS (
    SELECT 1 FROM collaborators c WHERE c.user_id = auth.uid() AND c.active = true));
CREATE POLICY "Collab or admin can update cfe"
  ON public.client_financial_entries FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR EXISTS (
    SELECT 1 FROM collaborators c WHERE c.user_id = auth.uid() AND c.active = true))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR EXISTS (
    SELECT 1 FROM collaborators c WHERE c.user_id = auth.uid() AND c.active = true));
CREATE POLICY "Collab or admin can delete cfe"
  ON public.client_financial_entries FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR EXISTS (
    SELECT 1 FROM collaborators c WHERE c.user_id = auth.uid() AND c.active = true));

-- 3) Definições por cliente × ano
CREATE TABLE public.client_financial_settings (
  client_id uuid NOT NULL,
  year integer NOT NULL,
  corporate_tax_rate numeric(5,4) NOT NULL DEFAULT 0.16,
  ta_representacao numeric(5,4) NOT NULL DEFAULT 0.10,
  ta_kms numeric(5,4) NOT NULL DEFAULT 0.05,
  ta_nao_doc numeric(5,4) NOT NULL DEFAULT 0.50,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_financial_settings TO authenticated;
GRANT ALL ON public.client_financial_settings TO service_role;
ALTER TABLE public.client_financial_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated can read cfs"
  ON public.client_financial_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Collab or admin can insert cfs"
  ON public.client_financial_settings FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR EXISTS (
    SELECT 1 FROM collaborators c WHERE c.user_id = auth.uid() AND c.active = true));
CREATE POLICY "Collab or admin can update cfs"
  ON public.client_financial_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR EXISTS (
    SELECT 1 FROM collaborators c WHERE c.user_id = auth.uid() AND c.active = true))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR EXISTS (
    SELECT 1 FROM collaborators c WHERE c.user_id = auth.uid() AND c.active = true));

-- 4) Seed do catálogo (replica o teu modelo)
INSERT INTO public.financial_accounts (code,name,section,display_order) VALUES
  ('711','Vendas','vendas',10),
  ('721','Prestação de Serviços','vendas',20),
  ('728','Outros rendimentos serviços','vendas',30),
  ('6311','Ordenado sócios','pessoal_socios',110),
  ('6316','Abono para Falha','pessoal_socios',120),
  ('6312','Sub Férias sócios','pessoal_socios',130),
  ('6313','Sub Natal sócios','pessoal_socios',140),
  ('6314','Subsídio Alimentação sócios','pessoal_socios',150),
  ('6351','Segurança Social - 23,75% sócios','pessoal_socios',160),
  ('6321','Ordenado colaboradores','pessoal_colab',210),
  ('6322','Sub Férias colaboradores','pessoal_colab',220),
  ('6323','Sub Natal colaboradores','pessoal_colab',230),
  ('6324','Subsídio Alimentação colaboradores','pessoal_colab',240),
  ('6329','Férias não gozadas','pessoal_colab',250),
  ('6352','Segurança Social - 23,75% colaboradores','pessoal_colab',260),
  ('636','Seguro Acidentes de Trabalho','pessoal_colab',270),
  ('621','Prestadores de Serviços','despesas',310),
  ('6221','Plataformas e Programas','despesas',320),
  ('6222','Publicidade','despesas',330),
  ('6224','Contabilidade','despesas',340),
  ('6226','Conservação e Reparação','despesas',350),
  ('6227','Despesas Bancárias','despesas',360),
  ('6231','Materiais desgaste rápido','despesas',370),
  ('6233','Material de escritório / economato','despesas',380),
  ('6241','Eletricidade e Água','despesas',390),
  ('6242','Combustíveis','despesas',400),
  ('6251','Refeições e estadas','despesas',410),
  ('6261','Rendas','despesas',420),
  ('6262','Comunicações','despesas',430),
  ('6263','Seguros','despesas',440),
  ('6266','Despesas representação','despesas',450),
  ('6267','Limpeza e Higiene','despesas',460),
  ('6315','Ajuda custo Kms','despesas',465),
  ('6888','Despesas não documentadas','despesas',467),
  ('6911','Juros de Financiamento','despesas',470),
  ('31','Compra de Material','compras',510),
  ('24331111','IVA Vendas - 6%','iva_vendas',610),
  ('24333311','IVA Vendas - 23%','iva_vendas',620),
  ('24341331','Notas de Crédito - Vendas','iva_vendas',630),
  ('24323111','IVA Compras - 6%','iva_compras',710),
  ('24323211','IVA Compras - 13%','iva_compras',720),
  ('24323311','IVA Compras - 23%','iva_compras',730),
  ('24342','Notas de Crédito - Compras','iva_compras',740);

-- 5) Trigger updated_at
CREATE TRIGGER set_cfe_updated_at BEFORE UPDATE ON public.client_financial_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_cfs_updated_at BEFORE UPDATE ON public.client_financial_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
