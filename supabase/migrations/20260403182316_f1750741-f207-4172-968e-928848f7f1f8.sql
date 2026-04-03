-- Add new columns to clients table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS tipo_contabilidade TEXT,
  ADD COLUMN IF NOT EXISTS saft TEXT,
  ADD COLUMN IF NOT EXISTS salarios TEXT,
  ADD COLUMN IF NOT EXISTS seguranca_social TEXT,
  ADD COLUMN IF NOT EXISTS iva TEXT,
  ADD COLUMN IF NOT EXISTS faturacao TEXT,
  ADD COLUMN IF NOT EXISTS mensalidade NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS responsavel_id UUID REFERENCES public.collaborators(id),
  ADD COLUMN IF NOT EXISTS notas_internas TEXT,
  ADD COLUMN IF NOT EXISTS recapitulativa TEXT;

-- Make NIF optional since CSV data doesn't include it
ALTER TABLE public.clients ALTER COLUMN nif DROP NOT NULL;
ALTER TABLE public.clients ALTER COLUMN nif SET DEFAULT '';