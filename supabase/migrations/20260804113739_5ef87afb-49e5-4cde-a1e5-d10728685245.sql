ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS segment text NOT NULL DEFAULT 'contabilidade';
CREATE INDEX IF NOT EXISTS leads_segment_idx ON public.leads (segment);