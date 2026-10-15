-- Prorrogações de prazos fiscais num mês específico (ex.: IVA de outubro 2026 passa
-- do dia 20 para o dia 27). Sem registo = vale o dia normal definido na app.
-- `month` (1–12) é o mês em que o prazo cai normalmente; `day` é o novo dia nesse mês.
CREATE TABLE IF NOT EXISTS public.fiscal_deadline_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deadline_key TEXT NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  day INT NOT NULL CHECK (day BETWEEN 1 AND 31),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deadline_key, year, month)
);

ALTER TABLE public.fiscal_deadline_overrides ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_deadline_overrides TO authenticated;
GRANT ALL ON public.fiscal_deadline_overrides TO service_role;

DROP POLICY IF EXISTS "Autenticados veem prorrogações" ON public.fiscal_deadline_overrides;
CREATE POLICY "Autenticados veem prorrogações" ON public.fiscal_deadline_overrides
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin gere prorrogações" ON public.fiscal_deadline_overrides;
CREATE POLICY "Admin gere prorrogações" ON public.fiscal_deadline_overrides
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_fiscal_deadline_overrides_updated_at ON public.fiscal_deadline_overrides;
CREATE TRIGGER update_fiscal_deadline_overrides_updated_at
  BEFORE UPDATE ON public.fiscal_deadline_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
