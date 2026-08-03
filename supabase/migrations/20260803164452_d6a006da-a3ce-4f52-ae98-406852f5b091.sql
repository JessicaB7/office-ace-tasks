CREATE TABLE public.client_financial_imports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  year integer NOT NULL,
  slot text NOT NULL CHECK (slot IN ('mapa','t1','t2','t3','t4')),
  file_name text NOT NULL,
  entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  imported_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (client_id, year, slot)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_financial_imports TO authenticated;
GRANT ALL ON public.client_financial_imports TO service_role;

ALTER TABLE public.client_financial_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view financial imports"
ON public.client_financial_imports FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert financial imports"
ON public.client_financial_imports FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update financial imports"
ON public.client_financial_imports FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can delete financial imports"
ON public.client_financial_imports FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE TRIGGER set_cfi_updated_at
BEFORE UPDATE ON public.client_financial_imports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();