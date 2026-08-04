ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS meeting boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS meeting_date date,
  ADD COLUMN IF NOT EXISTS suggested_product text,
  ADD COLUMN IF NOT EXISTS loss_reason text;

UPDATE public.leads SET stage = CASE
  WHEN stage IN ('novo','contactado','reuniao') THEN 'reuniao_agendada'
  WHEN stage = 'proposta' THEN 'proposta_enviada'
  WHEN stage = 'perdido' THEN 'perda'
  WHEN stage = 'ganho' THEN 'ganho'
  ELSE 'reuniao_agendada'
END;

ALTER TABLE public.leads ALTER COLUMN stage SET DEFAULT 'reuniao_agendada';