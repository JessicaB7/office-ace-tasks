
CREATE TABLE public.monthly_obligations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  obligation_type text NOT NULL,
  reference_month date NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  completed_at timestamp with time zone,
  completed_by uuid,
  extra_done boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(client_id, obligation_type, reference_month)
);

ALTER TABLE public.monthly_obligations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access"
  ON public.monthly_obligations
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_monthly_obligations_updated_at
  BEFORE UPDATE ON public.monthly_obligations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
