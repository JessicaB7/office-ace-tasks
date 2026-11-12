-- Ligação das obrigações / tarefas da Gestão Mensal aos manuais do Notion.
-- Regra (src/lib/obligationManuals.ts): o match_prefix mais comprido que seja início do
-- obligation_type, com tipo_contabilidade igual ao do cliente ou NULL (qualquer regime).
-- Nota: os tipos reais da Gestão Mensal são "contabilidade_empresas_*" (e o antigo
-- "contabilidade_empresas"), "contabilidade_organizada_*" e "contabilidade_TI_*"
-- (TI_isento, TI_iva_*), por isso os prefixos das empresas/organizada não levam "_" final.

CREATE TABLE IF NOT EXISTS public.obligation_manuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_prefix TEXT NOT NULL DEFAULT '',
  tipo_contabilidade TEXT CHECK (tipo_contabilidade IN ('TI RS', 'TI CO', 'SQ')),
  titulo TEXT NOT NULL,
  notion_url TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_obligation_manuals_unique
  ON public.obligation_manuals(match_prefix, COALESCE(tipo_contabilidade, ''));

DROP TRIGGER IF EXISTS update_obligation_manuals_updated_at ON public.obligation_manuals;
CREATE TRIGGER update_obligation_manuals_updated_at
  BEFORE UPDATE ON public.obligation_manuals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.obligation_manuals ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obligation_manuals TO authenticated;
GRANT ALL ON public.obligation_manuals TO service_role;

DO $$ BEGIN
  CREATE POLICY "Equipa vê os manuais" ON public.obligation_manuals
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admin gere os manuais" ON public.obligation_manuals
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.obligation_manuals (match_prefix, tipo_contabilidade, titulo, notion_url, ordem) VALUES
  ('contabilidade_empresas', 'SQ', 'Gestão mensal · Empresas', 'https://app.notion.com/p/40e6c08f0de08136a907e781e9f5ca30', 10),
  ('contabilidade_organizada', 'TI CO', 'Manual · TI Contabilidade Organizada', 'https://app.notion.com/p/40e6c08f0de0815db14ef54a2b93e0e7', 20),
  ('contabilidade_TI_', 'TI RS', 'Gestão mensal · TI Regime Simplificado', 'https://app.notion.com/p/40e6c08f0de0819c99ecf9bafc3a32bd', 30),
  ('', NULL, 'Manual · Técnica de contabilidade', 'https://app.notion.com/p/40b6c08f0de081ccb69cd9f3d48a0f1c', 999)
ON CONFLICT DO NOTHING;

INSERT INTO public.obligation_manuals (match_prefix, tipo_contabilidade, titulo, notion_url, ordem)
SELECT p.prefix, t.tipo, t.titulo, t.url, 100 + p.ord
  FROM (VALUES ('IVA', 1), ('DMR_', 2), ('SS_TI', 3), ('SAFT', 4), ('retencao_fonte', 5), ('salarios', 6), ('emissao_faturas', 7)) AS p(prefix, ord)
 CROSS JOIN (VALUES
   ('SQ', 'Obrigações fiscais · Empresas', 'https://app.notion.com/p/40e6c08f0de08142b772c9d0e05e7c54'),
   ('TI CO', 'Obrigações fiscais · TI Contabilidade Organizada', 'https://app.notion.com/p/40e6c08f0de08152ad9ae125cdf3752f'),
   ('TI RS', 'Obrigações fiscais · TI Regime Simplificado', 'https://app.notion.com/p/40e6c08f0de08112b270cdfd6171ae09')
 ) AS t(tipo, titulo, url)
ON CONFLICT DO NOTHING;
